"""
Search and Scraping router for Job-Finder v2.
Manages asynchronous scraping tasks, live progress tracking, and log streaming.
"""
import uuid
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
    get_current_user_required,
    get_supabase_client,
)
from src.database.repository import get_repository
from src.intelligence.gemini_analyzer import GeminiJobAnalyzer
from src.scrapers.dev_bg import DevBgScraper
from src.scrapers.linkedin import LinkedInScraper
from src.scrapers.euremotejobs import EURemoteJobsScraper
from src.scrapers.hackernews import HackerNewsScraper

router = APIRouter()

# In-memory storage for active search tasks
TASK_REGISTRY: Dict[str, Dict[str, Any]] = {}


DEFAULT_SEARCH_SOURCES = ["dev_bg", "jobs_bg", "linkedin", "euremotejobs", "hackernews"]


def _update_task(
    task_id: str,
    status_str: Optional[str] = None,
    progress: Optional[int] = None,
    log_msg: Optional[str] = None,
    jobs_found: Optional[int] = None,
    error: Optional[str] = None,
    user_id: Optional[str] = None,
    access_token: Optional[str] = None,
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

    client = get_supabase_client()
    if client and user_id:
        try:
            if access_token:
                client.postgrest.auth(access_token)
            client.table("scrape_tasks").upsert({
                "task_id": task_id,
                "user_id": user_id,
                "status": task["status"],
                "progress": task["progress"],
                "logs": task["logs"][-50:],
                "jobs_found": task["jobs_found"],
                "updated_at": now_str,
            }, on_conflict="task_id").execute()
        except Exception:
            pass


def _load_user_settings(user_id: Optional[str], access_token: Optional[str]) -> Dict[str, Any]:
    client = get_supabase_client()
    if not (client and user_id):
        return {}
    try:
        if access_token:
            client.postgrest.auth(access_token)
        res = client.table("user_settings").select("*").eq("user_id", str(user_id)).limit(1).execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        print(f"⚠️ Error fetching user settings for search: {e}")
    return {}


def execute_search_job(
    task_id: str,
    request: SearchRequest,
    user_id: Optional[str],
    access_token: Optional[str],
):
    """
    Background worker that runs the multi-portal scraper pipeline.
    """
    _update_task(task_id, status_str="running", progress=5, log_msg="🚀 Стартиране на фоновата задача за търсене...", user_id=user_id, access_token=access_token)

    repo = get_repository(user_id=user_id, access_token=access_token)
    db_settings = _load_user_settings(user_id, access_token)

    user_key = db_settings.get("gemini_api_key")
    user_model = db_settings.get("gemini_model")
    user_profile = db_settings.get("profile_data")
    user_keywords = db_settings.get("keywords") or []
    user_sources = db_settings.get("sources")
    user_max_jobs = db_settings.get("max_jobs_per_source")
    user_blacklist_titles = db_settings.get("blacklist_titles") or []
    user_blacklist_companies = db_settings.get("blacklist_companies") or []

    if request.clear_all:
        cnt = repo.delete_all_jobs(only_new=False)
        _update_task(task_id, log_msg=f"🗑️ Изчистени {cnt} съществуващи позиции от списъка.", user_id=user_id, access_token=access_token)
    elif request.clear_new:
        cnt = repo.delete_all_jobs(only_new=True)
        _update_task(task_id, log_msg=f"🗑️ Изчистени {cnt} позиции със статус 'нови'.", user_id=user_id, access_token=access_token)

    keywords = request.keywords or user_keywords or ["AI Engineer", "LLM", "Python"]
    max_jobs = request.max_jobs or user_max_jobs or 15

    if request.sources and "all" not in request.sources:
        active_sources = request.sources
    elif request.sources and "all" in request.sources:
        active_sources = list(DEFAULT_SEARCH_SOURCES)
    elif isinstance(user_sources, dict):
        active_sources = [k for k, v in user_sources.items() if v and k != "himalayas"]
    elif isinstance(user_sources, list):
        active_sources = [s for s in user_sources if s != "himalayas"]
    else:
        active_sources = list(DEFAULT_SEARCH_SOURCES)

    normalized_sources = set()
    for s in active_sources:
        s_clean = str(s).strip().lower()
        if s_clean == "himalayas":
            continue
        normalized_sources.add(s_clean)
        normalized_sources.add(s_clean.replace(".", "_"))
        normalized_sources.add(s_clean.replace("_", "."))

    _update_task(
        task_id,
        progress=10,
        log_msg=f"📋 Активни източници: {', '.join(active_sources)} | Ключови думи: {', '.join(keywords)}",
        user_id=user_id,
        access_token=access_token,
    )

    page = None
    scrapers = []
    if "dev.bg" in normalized_sources or "dev_bg" in normalized_sources:
        scrapers.append(DevBgScraper(page))
    if "linkedin" in normalized_sources:
        scrapers.append(LinkedInScraper(page))
    if "euremotejobs" in normalized_sources or "eu_remote_jobs" in normalized_sources:
        scrapers.append(EURemoteJobsScraper(page))
    if "hackernews" in normalized_sources or "hacker_news" in normalized_sources:
        scrapers.append(HackerNewsScraper(page))

    for scraper in scrapers:
        if user_blacklist_titles:
            scraper.blacklist_titles = [str(w).lower() for w in user_blacklist_titles]
        if user_blacklist_companies:
            scraper.blacklist_companies = [str(c).lower() for c in user_blacklist_companies]
        if db_settings.get("location"):
            scraper.location = db_settings["location"]
        if db_settings.get("remote_location"):
            scraper.remote_location = db_settings["remote_location"]

    new_jobs = []
    total_found = 0

    if "jobs.bg" in normalized_sources or "jobs_bg" in normalized_sources:
        _update_task(task_id, log_msg="🔍 Търсене в каталога на jobs.bg...", user_id=user_id, access_token=access_token)
        try:
            bg_jobs = repo.search_jobs_bg(keywords=keywords, limit=max_jobs * 2)
            bg_added = 0
            bg_skipped = 0
            for job in bg_jobs:
                if bg_added >= max_jobs:
                    break
                if repo.user_has_job(job.url):
                    bg_skipped += 1
                    continue
                job_db_id = repo.add_job(job)
                if job_db_id:
                    job.id = job_db_id
                    new_jobs.append(job)
                    total_found += 1
                    bg_added += 1
                    _update_task(
                        task_id,
                        jobs_found=total_found,
                        log_msg=f"   ✨ jobs.bg: {job.title} @ {job.company}",
                        user_id=user_id,
                        access_token=access_token,
                    )
            if bg_added > 0:
                _update_task(task_id, log_msg=f"   ✅ jobs.bg: Добавени {bg_added} позиции от каталога.", user_id=user_id, access_token=access_token)
            elif bg_skipped > 0:
                _update_task(task_id, log_msg=f"   ℹ️ jobs.bg: Всички {bg_skipped} съответстващи позиции вече са в списъка ви.", user_id=user_id, access_token=access_token)
            else:
                _update_task(task_id, log_msg="   ℹ️ jobs.bg: Няма намерени позиции в каталога за тези ключови думи.", user_id=user_id, access_token=access_token)
        except Exception as e:
            _update_task(task_id, log_msg=f"   ⚠️ Грешка при търсене в каталога на jobs.bg: {e}", user_id=user_id, access_token=access_token)

    step_increment = 60 / max(1, len(scrapers) if scrapers else 1)
    current_prog = 15.0

    try:
        for scraper in scrapers:
            _update_task(task_id, log_msg=f"🔍 Обхождане на {scraper.name}...", user_id=user_id, access_token=access_token)
            try:
                found = scraper.search(keywords=keywords, max_jobs=max_jobs)
                scraper_added = 0
                scraper_skipped = 0
                for job in found:
                    if repo.user_has_job(job.url):
                        scraper_skipped += 1
                        continue

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
                        scraper_added += 1
                        _update_task(
                            task_id,
                            jobs_found=total_found,
                            log_msg=f"   ✨ Намерена: {job.title} @ {job.company}",
                            user_id=user_id,
                            access_token=access_token,
                        )

                if len(found) == 0:
                    last_err = getattr(scraper, "last_error", None)
                    if last_err:
                        _update_task(
                            task_id,
                            log_msg=f"   ⚠️ {scraper.name}: 0 нови позиции. {last_err}.",
                            user_id=user_id,
                            access_token=access_token,
                        )
                        if "DataDome" in last_err or "Cloudflare" in last_err or "Datacenter" in last_err:
                            _update_task(
                                task_id,
                                log_msg=f"   💡 {scraper.name}: Защитата блокира облачни хостинги (Render). Стартирайте локалния уъркър ('python run.py --search') от домашния си компютър – той синхронизира автоматично с Supabase!",
                                user_id=user_id,
                                access_token=access_token,
                            )
                    else:
                        _update_task(
                            task_id,
                            log_msg=f"   ℹ️ {scraper.name}: 0 нови позиции (няма намерени резултати за зададените филтри).",
                            user_id=user_id,
                            access_token=access_token,
                        )
                elif scraper_added == 0 and scraper_skipped > 0:
                    _update_task(
                        task_id,
                        log_msg=f"   ℹ️ {scraper.name}: Всички {scraper_skipped} намерени позиции вече са в каталога ви (пропуснати като дубликати).",
                        user_id=user_id,
                        access_token=access_token,
                    )
                elif scraper_skipped > 0:
                    _update_task(
                        task_id,
                        log_msg=f"   ✅ {scraper.name}: {scraper_added} нови добавени ({scraper_skipped} съществуващи пропуснати).",
                        user_id=user_id,
                        access_token=access_token,
                    )
                else:
                    _update_task(
                        task_id,
                        log_msg=f"   ✅ {scraper.name}: {scraper_added} нови позиции успешно добавени.",
                        user_id=user_id,
                        access_token=access_token,
                    )

            except Exception as scraper_err:
                _update_task(task_id, log_msg=f"⚠️ Грешка при {scraper.name}: {scraper_err}", user_id=user_id, access_token=access_token)

            current_prog += step_increment
            _update_task(task_id, progress=int(current_prog), user_id=user_id, access_token=access_token)

        if new_jobs:
            _update_task(task_id, progress=80, log_msg=f"🧠 AI Оценка на {len(new_jobs)} нови обяви с Gemini...", user_id=user_id, access_token=access_token)
            analyzer = GeminiJobAnalyzer(api_key=user_key, model_name=user_model, profile_data=user_profile)
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
                        _update_task(task_id, log_msg=f"   📊 Мач {score}%: {j.title} @ {j.company}", user_id=user_id, access_token=access_token)
                except Exception as ai_err:
                    _update_task(task_id, log_msg=f"⚠️ Грешка при AI анализ: {ai_err}", user_id=user_id, access_token=access_token)

        _update_task(
            task_id,
            status_str="completed",
            progress=100,
            log_msg=f"🎉 Търсенето приключи успешно! Добавени {total_found} нови обяви.",
            jobs_found=total_found,
            user_id=user_id,
            access_token=access_token,
        )

    except Exception as e:
        _update_task(
            task_id,
            status_str="failed",
            error=str(e),
            log_msg=f"❌ Фатална грешка при търсенето: {e}",
            user_id=user_id,
            access_token=access_token,
        )


@router.post("/start", response_model=SearchTaskStatusResponse, summary="Start background job search")
def start_search(
    request: SearchRequest,
    background_tasks: BackgroundTasks,
    user: Dict[str, Any] = Depends(get_current_user_required),
):
    """
    Starts an autonomous scraping session in the background.
    Returns task_id for tracking progress and live logs.
    """
    task_id = str(uuid.uuid4())
    user_id = user["id"]
    access_token = user.get("access_token")

    _update_task(
        task_id=task_id,
        status_str="pending",
        progress=0,
        log_msg=f"Инициализирана задача {task_id}",
        user_id=user_id,
        access_token=access_token,
    )

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
    user: Dict[str, Any] = Depends(get_current_user_required),
):
    """
    Returns live progress, percentage, and log messages for the given task_id.
    """
    if task_id in TASK_REGISTRY:
        t = TASK_REGISTRY[task_id]
        if t.get("user_id") != user["id"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Search task not found."
            )
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

    client = get_supabase_client()
    if client:
        try:
            if user.get("access_token"):
                client.postgrest.auth(user["access_token"])
            res = (
                client.table("scrape_tasks")
                .select("*")
                .eq("task_id", task_id)
                .eq("user_id", user["id"])
                .limit(1)
                .execute()
            )
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
    user: Dict[str, Any] = Depends(get_current_user_required),
):
    """Lists recent in-memory search tasks for the authenticated user."""
    user_id = user["id"]
    tasks = []
    for t in TASK_REGISTRY.values():
        if t.get("user_id") != user_id:
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


@router.get("/debug-jobs-bg", summary="Diagnose direct jobs.bg response from Render")
def debug_jobs_bg(
    user: Dict[str, Any] = Depends(get_current_user_required),
):
    """
    Direct HTTP diagnostic request to jobs.bg from the hosting server (Render).
    Restricted to platform administrator.
    """
    if (user.get("email") or "").lower() != "peturganchev93@gmail.com":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to platform administrators."
        )

    import httpx
    target_url = "https://www.jobs.bg/front_job_search.php?keywords%5B%5D=Python"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "bg,en-US;q=0.9,en;q=0.8",
    }

    try:
        with httpx.Client(headers=headers, follow_redirects=True, timeout=15.0) as client:
            resp = client.get(target_url)
            body = resp.text
            return {
                "target_url": target_url,
                "status_code": resp.status_code,
                "headers": dict(resp.headers),
                "server_header": resp.headers.get("server"),
                "x_datadome_header": resp.headers.get("x-datadome"),
                "x_datadome_cid": resp.headers.get("x-datadome-cid"),
                "has_captcha_delivery": "captcha-delivery.com" in body or "geo.captcha-delivery.com" in body,
                "has_datadome_script": "datadome" in body.lower(),
                "body_snippet_300": body[:300],
                "body_length": len(body),
            }
    except Exception as e:
        return {
            "error": str(e),
        }

