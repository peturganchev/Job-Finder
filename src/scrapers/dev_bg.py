"""
Dev.bg Scraper for IT, AI, and Python positions.
Focused on verified tech roles in Bulgaria (Sofia & Remote).
Supports both direct lightweight HTTP (Cloud) and Playwright fallback.
"""
import time
import random
import re
import httpx
from typing import List, Dict, Any, Optional
from urllib.parse import quote, quote_plus
from bs4 import BeautifulSoup
from src.scrapers.base_scraper import BaseScraper
from src.database.models import Job, JobSource, ApplicationStatus


class DevBgScraper(BaseScraper):
    def __init__(self, page=None):
        super().__init__(page, name="dev.bg")
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "bg,en-US;q=0.9,en;q=0.8"
        }
        self.client = httpx.Client(headers=self.headers, follow_redirects=True, timeout=15.0)

    def search(self, keywords: List[str], max_jobs: int = 25) -> List[Job]:
        """
        Търси в dev.bg по ключови думи и основните категории за изкуствен интелект и Python.
        """
        found_jobs: List[Job] = []
        seen_urls = set()

        category_urls = []
        for kw in keywords:
            encoded = quote_plus(kw)
            category_urls.append((f"https://dev.bg/?s={encoded}&post_type=job_listing", kw))

        for cat in self.dev_bg_categories:
            category_urls.append((f"https://dev.bg/company/jobs/{cat}/", cat))

        for target_url, kw in category_urls:
            if len(found_jobs) >= max_jobs:
                break

            try:
                print(f"🔍 [dev.bg] Зареждане на: {target_url}")
                if self.page:
                    self.page.goto(target_url, wait_until="domcontentloaded", timeout=25000)
                    time.sleep(random.uniform(1.0, 2.0))
                    html = self.page.content()
                else:
                    resp = self.client.get(target_url)
                    if resp.status_code != 200:
                        continue
                    html = resp.text

                soup = BeautifulSoup(html, "html.parser")
                job_cards = soup.select("div.job-list-item")

                for card in job_cards:
                    if len(found_jobs) >= max_jobs:
                        break

                    link_elem = card.select_one("a[href*='/company/jobads/'], a[href*='/jobads/']")
                    if not link_elem:
                        link_elem = card.find("a", href=True)
                    if not link_elem or not link_elem.get("href"):
                        continue

                    url = link_elem.get("href")
                    if not url.startswith("http"):
                        url = f"https://dev.bg{url}"

                    if url in seen_urls:
                        continue

                    heading = card.find(["h2", "h3", "h4", "h5", "h6"])
                    title = heading.get_text(strip=True) if heading else link_elem.get_text(strip=True)

                    if not title or len(title) < 3:
                        continue

                    company_elem = card.select_one("span.company-name, .company-name, a.company-link")
                    company = company_elem.get_text(strip=True) if company_elem else "Неизвестна"

                    if self.is_blacklisted(title, company):
                        continue

                    seen_urls.add(url)

                    loc_elems = card.select("span[class*='suffix'], span.location, span.badge-location")
                    location_parts = [le.get_text(strip=True) for le in loc_elems if le.get_text(strip=True)]
                    location = " / ".join(location_parts) if location_parts else "София / Remote"

                    salary_elem = card.select_one(".salary, .badge-salary, [class*='salary']")
                    salary = salary_elem.get_text(strip=True) if salary_elem else None

                    date_elem = card.select_one("span.date, time")
                    posted_date = date_elem.get_text(strip=True) if date_elem else None

                    job_id_match = re.search(r'/jobads/([^/]+)/?', url)
                    job_id = job_id_match.group(1) if job_id_match else url.strip("/").split("/")[-1]

                    job = Job(
                        source=JobSource.DEV_BG,
                        job_id=f"devbg_{job_id}",
                        title=title,
                        company=company,
                        location=location,
                        url=url,
                        salary=salary,
                        posted_date=posted_date,
                        status=ApplicationStatus.NEW,
                        search_keyword=kw
                    )
                    found_jobs.append(job)

            except Exception as e:
                print(f"⚠️ [dev.bg] Грешка при обхождане на {target_url}: {e}")

        print(f"✅ [dev.bg] Намерени {len(found_jobs)} подходящи обяви.")
        return found_jobs

    def extract_job_details(self, job_url: str) -> dict:
        """Извлича пълния текст на обявата от dev.bg."""
        try:
            if self.page:
                self.page.goto(job_url, wait_until="domcontentloaded", timeout=20000)
                time.sleep(random.uniform(1.0, 1.5))
                html = self.page.content()
            else:
                resp = self.client.get(job_url)
                if resp.status_code != 200:
                    return {"description": "", "posted_date": None, "salary": None}
                html = resp.text

            soup = BeautifulSoup(html, "html.parser")
            desc_elem = soup.select_one("div.container-single-job .box, div.box, div.job-description, article")
            description = desc_elem.get_text(separator="\n", strip=True) if desc_elem else ""

            date_elem = soup.select_one("time, span.posted-date, span.date")
            posted_date = date_elem.get_text(strip=True) if date_elem else None

            salary_elem = soup.select_one("div.salary, span.salary-range")
            salary = salary_elem.get_text(strip=True) if salary_elem else None

            return {
                "description": description,
                "posted_date": posted_date,
                "salary": salary
            }
        except Exception as e:
            print(f"⚠️ [dev.bg] Неуспешно четене на детайли за {job_url}: {e}")
            return {"description": "", "posted_date": None, "salary": None}
