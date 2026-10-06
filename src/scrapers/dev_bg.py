"""
Dev.bg Scraper for IT, AI, and Python positions.
Focused on verified tech roles in Bulgaria (Sofia & Remote).
"""
import time
import random
import re
from typing import List, Dict, Any
from urllib.parse import quote
from bs4 import BeautifulSoup
from src.scrapers.base_scraper import BaseScraper
from src.database.models import Job, JobSource, ApplicationStatus


class DevBgScraper(BaseScraper):
    def __init__(self, page):
        super().__init__(page, name="dev.bg")

    def search(self, keywords: List[str], max_jobs: int = 25) -> List[Job]:
        """
        Търси в dev.bg по ключови думи и основните категории за изкуствен интелект и Python.
        """
        found_jobs: List[Job] = []
        seen_urls = set()

        # 1. Точни актуални категории в dev.bg
        category_urls = [
            "https://dev.bg/company/jobs/ml-ai-data/",
            "https://dev.bg/company/jobs/python/",
            "https://dev.bg/company/jobs/data-science/"
        ]

        # 2. Търсене по конкретни ключови думи
        for kw in keywords[:2]:
            encoded = quote(kw)
            category_urls.append(f"https://dev.bg/jobs/?_keyword={encoded}")

        for target_url in category_urls:
            if len(found_jobs) >= max_jobs:
                break

            try:
                print(f"🔍 [dev.bg] Зареждане на: {target_url}")
                self.page.goto(target_url, wait_until="domcontentloaded", timeout=25000)
                time.sleep(random.uniform(1.5, 2.5))

                # Скролване за зареждане на обяви
                for _ in range(2):
                    self.page.mouse.wheel(0, 500)
                    time.sleep(0.5)

                html = self.page.content()
                soup = BeautifulSoup(html, "html.parser")

                # Намиране на блоковете с обяви в dev.bg
                job_cards = soup.select("div.job-list-item")

                for card in job_cards:
                    if len(found_jobs) >= max_jobs:
                        break

                    # Намиране на линк
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

                    # Намиране на заглавие от заглавните тагове
                    heading = card.find(["h2", "h3", "h4", "h5", "h6"])
                    title = heading.get_text(strip=True) if heading else link_elem.get_text(strip=True)

                    if not title or len(title) < 3:
                        continue

                    # Компания
                    company_elem = card.select_one("span.company-name, .company-name, a.company-link")
                    company = company_elem.get_text(strip=True) if company_elem else "Неизвестна"

                    # Проверка за черен списък
                    if self.is_blacklisted(title, company):
                        continue

                    seen_urls.add(url)

                    # Локация / Тип
                    loc_elems = card.select("span[class*='suffix'], span.location, span.badge-location")
                    location_parts = [le.get_text(strip=True) for le in loc_elems if le.get_text(strip=True)]
                    location = " / ".join(location_parts) if location_parts else "София / Remote"

                    # Заплата (ако е обявена)
                    salary_elem = card.select_one(".salary, .badge-salary, [class*='salary']")
                    salary = salary_elem.get_text(strip=True) if salary_elem else None

                    # Дата
                    date_elem = card.select_one("span.date, time")
                    posted_date = date_elem.get_text(strip=True) if date_elem else None

                    # Извличане на ID от URL
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
                        status=ApplicationStatus.NEW
                    )
                    found_jobs.append(job)

            except Exception as e:
                print(f"⚠️ [dev.bg] Грешка при обхождане на {target_url}: {e}")

        print(f"✅ [dev.bg] Намерени {len(found_jobs)} подходящи обяви.")
        return found_jobs

    def extract_job_details(self, job_url: str) -> dict:
        """Извлича пълния текст на обявата от dev.bg."""
        try:
            self.page.goto(job_url, wait_until="domcontentloaded", timeout=20000)
            time.sleep(random.uniform(1.0, 2.0))

            html = self.page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Контейнерът с описанието (в dev.bg е div.box в рамките на единичната обява)
            desc_elem = soup.select_one("div.container-single-job .box, div.box, div.job-description, article")
            description = desc_elem.get_text(separator="\n", strip=True) if desc_elem else ""

            # Дата на публикуване
            date_elem = soup.select_one("time, span.posted-date, span.date")
            posted_date = date_elem.get_text(strip=True) if date_elem else None

            # Заплата ако не е била намерена от картата
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
