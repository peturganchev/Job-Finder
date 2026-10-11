"""
Search and Scraping router for Job-Finder v2.
Manages asynchronous scraping tasks, live progress tracking, and log streaming.
"""
import uuid
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from src.api.schemas import (
    SearchRequest,
    SearchTaskStatusResponse,
    SearchTaskListResponse,
    StandardMessageResponse,
)
from src.api.dependencies import (
    get_current_user_optional,
    get_supabase_client,
)
from src.database.repository import get_repository
from src.settings_manager import SettingsManager
from src.intelligence.gemini_analyzer import GeminiJobAnalyzer
from src.browser import BrowserManager
from src.scrapers.dev_bg import DevBgScraper
from src.scrapers.jobs_bg import JobsBgScraper
from src.scrapers.linkedin import LinkedInScraper
from src.scrapers.himalayas import HimalayasScraper
from src.scrapers.euremotejobs import EURemoteJobsScraper
from src.scrapers.hackernews import HackerNewsScraper

router = APIRouter()

# In-memory storage for active search tasks
TASK_REGISTRY: Dict[str, Dict[str, Any]] = {}


def _update_task(
    task_id: str,
    status_str: Optional[str] = None,
    progress: Optional[int] = None,
    log_msg: Optional[str] = None,
    jobs_found: Optional[int] = None,
    error: Optional[str] = None,
    user_id: Optional[str] = None,
):
    """Synchronizes task state in memory and optionally in Supabase."""
    now_str = datetime.now().isoformat()
    task = TASK_REGISTRY.setdefault(task_id, {
        "task_id": task_id,
        "status": "pending",
        "progress": 0,
        "logs": [],
        "jobs_found": 0,
        "error": None,
        "created_at": now_str,
        "updated_at": now_str,
        "user_id": user_id,
    })

    if status_str:
        task["status"] = status_str
    if progress is not None:
        task["progress"] = max(0, min(100, progress))
    if log_msg:
        task["logs"].append(f"[{datetime.now().strftime('%H:%M:%S')}] {log_msg}")
    if jobs_found is not None:
        task["jobs_found"] = jobs_found
    if error is not None:
        task["error"] = error
    task["updated_at"] = now_str

    # Sync to Supabase scrape_tasks table if client exists
    client = get_supabase_client()
    if client and user_id:
        try:
            client.table("scrape_tasks").upsert({
                "task_id": task_id,
                "user_id": user_id,
                "status": task["status"],
                "progress": task["progress"],
                "logs": task["logs"][-50:],  # keep last 50 logs in DB
                "updated_at": now_str,
            }, on_conflict="task_id").execute()
        except Exception:
            pass


def execute_search_job(
    task_id: str,
    request: SearchRequest,
    user_id: Optional[str],
    access_token: Optional[str],
):
    """
    Background worker that runs the multi-portal scraper pipeline.
    """
    _update_task(task_id, status_str="running", progress=5, log_msg="🚀 Стартиране на фоновата задача за търсене...", user_id=user_id)

    repo = get_repository(user_id=user_id, access_token=access_token)
    sm = SettingsManager()
    settings = sm.load()

    # Pre-cleaning if requested
    if request.clear_all:
        cnt = repo.delete_all_jobs(only_new=False)
        _update_task(task_id, log_msg=f"🗑️ Изчистени {cnt} съществуващи позиции от списъка.", user_id=user_id)
    elif request.clear_new:
        cnt = repo.delete_all_jobs(only_new=True)
        _update_task(task_id, log_msg=f"🗑️ Изчистени {cnt} позиции със статус 'нови'.", user_id=user_id)

    keywords = request.keywords or settings.search.keywords or ["AI Engineer", "LLM", "Python"]
    max_jobs = request.max_jobs or settings.search.max_jobs_per_source or 15

    # Determine sources
    if request.sources and "all" not in request.sources:
        active_sources = request.sources
    elif request.sources and "all" in request.sources:
        active_sources = ["dev.bg", "jobs.bg", "linkedin", "euremotejobs", "hackernews", "himalayas"]
    else:
        active_sources = sm.enabled_sources()

    _update_task(
        task_id,
        progress=10,
        log_msg=f"📋 Активни източници: {', '.join(active_sources)} | Ключови думи: {', '.join(keywords)}",
        user_id=user_id
    )

    # Browser setup
    browser_mgr = BrowserManager(headless=True)
    page = None
    try:
        if any(s in active_sources for s in ["jobs.bg", "himalayas"]):
            _playwright, _context, page = browser_mgr.launch_session(headless=True)
    except Exception as e:
        _update_task(task_id, log_msg=f"⚠️ Браузърът не е наличен: {e}. Продължаваме в HTTP режим.", user_id=user_id)

    # Scrapers
    scrapers = []
    if "dev.bg" in active_sources:
        scrapers.append(DevBgScraper(page))
    if "jobs.bg" in active_sources:
        scrapers.append(JobsBgScraper(page))
    if "linkedin" in active_sources:
        scrapers.append(LinkedInScraper(page))
    if "euremotejobs" in active_sources:
        scrapers.append(EURemoteJobsScraper(page))
    if "hackernews" in active_sources:
        scrapers.append(HackerNewsScraper(page))
    if "himalayas" in active_sources and page is not None:
        scrapers.append(HimalayasScraper(page))

    new_jobs = []
    total_found = 0
    step_increment = 60 / max(1, len(scrapers))
    current_prog = 15.0

    try:
        for scraper in scrapers:
            _update_task(task_id, log_msg=f"🔍 Обхождане на {scraper.name}...", user_id=user_id)
            try:
                found = scraper.search(keywords=keywords, max_jobs=max_jobs)
                for job in found:
                    if repo.user_has_job(job.url):
                        continue

                    # Details extraction
                    if not repo.exists(job.url):
                        details = scraper.extract_job_details(job.url)
                        if details.get("description"):
                            job.description = details["description"]
                        if details.get("salary"):
                            job.salary = details["salary"]
                        if details.get("posted_date"):
                            job.posted_date = details["posted_date"]

                    job_db_id = repo.add_job(job)
                    if job_db_id:
                        job.id = job_db_id
                        new_jobs.append(job)
                        total_found += 1
                        _update_task(
                            task_id,
                            jobs_found=total_found,
                            log_msg=f"   ✨ Намерена: {job.title} @ {job.company}",
                            user_id=user_id
                        )

            except Exception as scraper_err:
                _update_task(task_id, log_msg=f"⚠️ Грешка при {scraper.name}: {scraper_err}", user_id=user_id)

            current_prog += step_increment
            _update_task(task_id, progress=int(current_prog), user_id=user_id)

        # Batch AI Scoring
        if new_jobs:
            _update_task(task_id, progress=80, log_msg=f"🧠 AI Оценка на {len(new_jobs)} нови обяви с Gemini...", user_id=user_id)
            analyzer = GeminiJobAnalyzer()
            batch_size = 8
            for i in range(0, len(new_jobs), batch_size):
                batch = new_jobs[i:i + batch_size]
                batch_payload = [
                    {
                        "job_id": j.job_id,
                        "title": j.title,
                        "company": j.company,
                        "location": j.location,
                        "description": j.description,
                    }
                    for j in batch
                ]
                try:
                    analysis_res = analyzer.analyze_jobs_batch(batch_payload)
                    for j in batch:
                        res = analysis_res.get(j.job_id, {})
                        score = res.get("match_score", 50)
                        repo.update_ai_analysis(
                            job_id=j.id,
                            match_score=score,
                            ai_summary=res.get("ai_summary", ""),
                            matched_skills=res.get("matched_skills", []),
                            missing_skills=res.get("missing_skills", []),
                            cover_letter=res.get("cover_letter", ""),
                        )
                        _update_task(task_id, log_msg=f"   📊 Мач {score}%: {j.title} @ {j.company}", user_id=user_id)
                except Exception as ai_err:
                    _update_task(task_id, log_msg=f"⚠️ Грешка при AI анализ: {ai_err}", user_id=user_id)

        _update_task(
            task_id,
            status_str="completed",
            progress=100,
            log_msg=f"🎉 Търсенето приключи успешно! Добавени {total_found} нови обяви.",
            jobs_found=total_found,
            user_id=user_id
        )

    except Exception as e:
        _update_task(
            task_id,
            status_str="failed",
            error=str(e),
            log_msg=f"❌ Фатална грешка при търсенето: {e}",
            user_id=user_id
        )
    finally:
        try:
            browser_mgr.close()
        except Exception:
            pass


@router.post("/start", response_model=SearchTaskStatusResponse, summary="Start background job search")
def start_search(
    request: SearchRequest,
    background_tasks: BackgroundTasks,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """
    Starts an autonomous scraping session in the background.
    Returns task_id for tracking progress and live logs.
    """
    task_id = str(uuid.uuid4())
    user_id = user["id"] if user else None
    access_token = user.get("access_token") if user else None

    # Register initial task
    _update_task(
        task_id=task_id,
        status_str="pending",
        progress=0,
        log_msg=f"Инициализирана задача {task_id}",
        user_id=user_id
    )

    # Schedule background worker
    background_tasks.add_task(
        execute_search_job,
        task_id=task_id,
        request=request,
        user_id=user_id,
        access_token=access_token,
    )

    return SearchTaskStatusResponse(
        task_id=task_id,
        status="pending",
        progress=0,
        logs=TASK_REGISTRY[task_id]["logs"],
        jobs_found=0,
        created_at=TASK_REGISTRY[task_id]["created_at"],
        updated_at=TASK_REGISTRY[task_id]["updated_at"],
    )


@router.get("/status/{task_id}", response_model=SearchTaskStatusResponse, summary="Get search task status and logs")
def get_task_status(
    task_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """
    Returns live progress, percentage, and log messages for the given task_id.
    """
    if task_id in TASK_REGISTRY:
        t = TASK_REGISTRY[task_id]
        return SearchTaskStatusResponse(
            task_id=t["task_id"],
            status=t["status"],
            progress=t["progress"],
            logs=t["logs"],
            jobs_found=t.get("jobs_found", 0),
            error=t.get("error"),
            created_at=t.get("created_at"),
            updated_at=t.get("updated_at"),
        )

    # Fallback to Supabase scrape_tasks table
    client = get_supabase_client()
    if client:
        try:
            res = client.table("scrape_tasks").select("*").eq("task_id", task_id).limit(1).execute()
            if res.data:
                row = res.data[0]
                return SearchTaskStatusResponse(
                    task_id=row["task_id"],
                    status=row.get("status", "unknown"),
                    progress=row.get("progress", 0),
                    logs=row.get("logs") or [],
                    jobs_found=row.get("jobs_found", 0),
                    created_at=row.get("created_at"),
                    updated_at=row.get("updated_at"),
                )
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Search task '{task_id}' not found."
    )


@router.get("/tasks", response_model=SearchTaskListResponse, summary="List all search tasks")
def list_tasks(
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """Lists recent in-memory search tasks."""
    user_id = user["id"] if user else None
    tasks = []
    for t in TASK_REGISTRY.values():
        if user_id and t.get("user_id") and t.get("user_id") != user_id:
            continue
        tasks.append(
            SearchTaskStatusResponse(
                task_id=t["task_id"],
                status=t["status"],
                progress=t["progress"],
                logs=t["logs"][-10:],
                jobs_found=t.get("jobs_found", 0),
                error=t.get("error"),
                created_at=t.get("created_at"),
                updated_at=t.get("updated_at"),
            )
        )
    return SearchTaskListResponse(tasks=tasks, total=len(tasks))
