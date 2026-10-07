"""
Job Validity and Expiry Validator.
Verifies whether saved job postings are still active or have expired/closed.
Supports dev.bg, LinkedIn, and jobs.bg.
"""
import re
import time
from typing import Tuple, Dict, Any, List, Optional, Callable
import httpx
from src.database.models import Job, JobSource
from src.database.repository import JobRepository
from src.browser import BrowserManager

DESKTOP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "bg-BG,bg;q=0.9,en-US;q=0.8,en;q=0.7",
}


class JobValidator:
    def __init__(self, timeout: float = 10.0):
        self.timeout = timeout
        self.client = httpx.Client(
            headers=DESKTOP_HEADERS,
            follow_redirects=True,
            timeout=self.timeout
        )

    def check_dev_bg(self, url: str) -> Tuple[bool, str]:
        """Проверява статус на обява в dev.bg през HTTP."""
        try:
            resp = self.client.get(url)
            if resp.status_code in (404, 410):
                return False, f"Обявата е премахната (HTTP {resp.status_code})"
            
            # Проверка дали е редиректнала към начална страница
            final_url = str(resp.url).rstrip("/")
            if final_url in ("https://dev.bg", "https://dev.bg/company/jobads"):
                return False, "Редирект към началната страница на обявите"

            text = resp.text.lower()
            if "тази позиция вече не е активна" in text or "тази обява е изтекла" in text:
                return False, "Позицията вече не е активна"
            if "страницата не е намерена" in text or "page not found" in text:
                return False, "Страницата не е намерена"

            return True, "Активна"
        except Exception as e:
            return True, f"Неуспешна проверка ({e}), маркирана като активна"

    def check_linkedin(self, url: str) -> Tuple[bool, str]:
        """Проверява статус на публична LinkedIn обява през HTTP."""
        try:
            resp = self.client.get(url)
            if resp.status_code in (404, 410):
                return False, f"Обявата не съществува (HTTP {resp.status_code})"

            text = resp.text.lower()
            if "no longer accepting applications" in text:
                return False, "Вече не приема кандидатури (затворена)"
            if "тази обява за работа вече не приема кандидати" in text:
                return False, "Вече не приема кандидатури (затворена)"
            if "closed to applications" in text or "this job is no longer available" in text:
                return False, "Обявата е свалена"

            return True, "Активна"
        except Exception as e:
            return True, f"Неуспешна проверка ({e}), маркирана като активна"

    def check_jobs_bg(self, url: str, page) -> Tuple[bool, str]:
        """Проверява статус на обява в jobs.bg през Playwright (заобикаляйки DataDome)."""
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=15000)
            time.sleep(0.5)

            current_url = page.url.lower()
            if "front_job_search.php" in current_url or current_url.rstrip("/") == "https://www.jobs.bg":
                return False, "Редирект към търсачката (обявата е затворена)"

            content = page.content().lower()
            if "обявата е архивирана" in content or "обявата вече не е активна" in content:
                return False, "Обявата е архивирана"
            if "не съществува или е архивирана" in content:
                return False, "Обявата не съществува или е архивирана"

            return True, "Активна"
        except Exception as e:
            return True, f"Грешка при зареждане ({e}), маркирана като активна"

    def validate_and_cleanup(
        self,
        repo: JobRepository,
        jobs: Optional[List[Job]] = None,
        on_progress: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Проверява всички обяви и изтрива неактивните от базата данни.
        Връща обобщен репорт.
        """
        if jobs is None:
            jobs = repo.get_all_jobs(limit=1000)

        total = len(jobs)
        removed_jobs = []
        active_count = 0

        # Разделяне на обявите: jobs.bg се проверяват през Playwright, останалите през httpx
        jobs_bg_list = [j for j in jobs if j.source == JobSource.JOBS_BG or "jobs.bg" in (j.url or "")]
        fast_jobs = [j for j in jobs if j not in jobs_bg_list]

        idx = 0

        # 1. Бърза проверка на dev.bg и LinkedIn
        for job in fast_jobs:
            idx += 1
            if on_progress:
                on_progress(idx, total, f"Проверка на {job.source}: {job.title} @ {job.company}")

            if job.source == JobSource.DEV_BG or "dev.bg" in (job.url or ""):
                is_active, reason = self.check_dev_bg(job.url)
            elif job.source == JobSource.LINKEDIN or "linkedin.com" in (job.url or ""):
                is_active, reason = self.check_linkedin(job.url)
            else:
                is_active, reason = True, "Неизвестен източник"

            if not is_active:
                repo.delete_job(job.id)
                removed_jobs.append({
                    "id": job.id,
                    "title": job.title,
                    "company": job.company,
                    "source": job.source,
                    "reason": reason,
                    "url": job.url
                })
            else:
                active_count += 1

        # 2. Проверка на jobs.bg през Playwright (само ако има такива)
        if jobs_bg_list:
            bm = BrowserManager(headless=True)
            playwright, context, page = bm.launch_session(headless=True)
            try:
                for job in jobs_bg_list:
                    idx += 1
                    if on_progress:
                        on_progress(idx, total, f"Проверка на jobs.bg: {job.title} @ {job.company}")

                    is_active, reason = self.check_jobs_bg(job.url, page)
                    if not is_active:
                        repo.delete_job(job.id)
                        removed_jobs.append({
                            "id": job.id,
                            "title": job.title,
                            "company": job.company,
                            "source": job.source,
                            "reason": reason,
                            "url": job.url
                        })
                    else:
                        active_count += 1
            finally:
                context.close()
                playwright.stop()

        return {
            "total_checked": total,
            "expired_count": len(removed_jobs),
            "active_count": active_count,
            "removed_jobs": removed_jobs
        }
