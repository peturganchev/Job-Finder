"""
Jobs.bg Scraper with Cloudflare resilience.
Targets IT and AI categories in Bulgaria.
"""
import time
import random
import re
from typing import List, Dict, Any
from urllib.parse import quote, quote_plus
from bs4 import BeautifulSoup
from src.scrapers.base_scraper import BaseScraper
from src.database.models import Job, JobSource, ApplicationStatus


class JobsBgScraper(BaseScraper):
    def __init__(self, page):
        super().__init__(page, name="jobs.bg")

    def _wait_for_cloudflare(self, timeout_sec: int = 15):
        """Проверява и изчаква автоматичното преминаване на Cloudflare верификацията."""
        start = time.time()
        while time.time() - start < timeout_sec:
            title = self.page.title()
            if "Just a moment" not in title and "Cloudflare" not in title:
                return True
            print("🛡️ [jobs.bg] Засечена Cloudflare проверка, изчакване...")
            time.sleep(2)
        return False

    def search(self, keywords: List[str], max_jobs: int = 25) -> List[Job]:
        """
        Търси в jobs.bg за IT категории (кат. 56 = IT - Софтуер) с ключови думи.
        """
        found_jobs: List[Job] = []
        seen_urls = set()

        for kw in keywords:
            if len(found_jobs) >= max_jobs:
                break

            encoded_kw = quote_plus(kw)
            search_url = f"https://www.jobs.bg/front_job_search.php?keywords%5B%5D={encoded_kw}"

            try:
                print(f"🔍 [jobs.bg] Търсене за '{kw}': {search_url}")
                self.page.goto(search_url, wait_until="domcontentloaded", timeout=25000)
                self._wait_for_cloudflare()
                time.sleep(random.uniform(1.5, 3.0))

                # Скролваме леко за динамично зареждане
                for _ in range(2):
                    self.page.mouse.wheel(0, 400)
                    time.sleep(0.5)

                html = self.page.content()
                soup = BeautifulSoup(html, "html.parser")

                # Търсим линкове към обяви (формат: /job/1234567 или job/...)
                job_links = soup.select("a[href*='/job/'], a[href*='view_job.php']")

                for link in job_links:
                    if len(found_jobs) >= max_jobs:
                        break

                    href = link.get("href", "")
                    if not href:
                        continue

                    if not href.startswith("http"):
                        href = f"https://www.jobs.bg/{href.lstrip('/')}"

                    if href in seen_urls:
                        continue

                    raw_title = link.get_text(strip=True)
                    # Изчистване на икони и допълнителни тагове от jobs.bg (star, location_on, chair и др.)
                    clean_title = re.sub(r'^(?:star)+', '', raw_title).strip()
                    clean_title = re.split(r'(?:location_on|chair|public|phone|Ниво|София;|Заплата|Отпуск)', clean_title)[0].strip()
                    title = clean_title if len(clean_title) >= 3 else raw_title
                    if not title or len(title) < 4:
                        continue

                    # Проверка за черен списък
                    if self.is_blacklisted(title):
                        continue

                    seen_urls.add(href)

                    # Извличане на обявена заплата от картата (ако има)
                    salary = None
                    sal_match = re.search(r'Заплата\s*(?:от)?\s*([0-9\s]+до\s*[0-9\s]+(?:EUR|BGN|лв|€)[^\s;]*)', raw_title, re.IGNORECASE)
                    if sal_match:
                        salary = sal_match.group(1).strip()

                    # Опитваме се да намерим компания и локация от родителския контейнер
                    parent_card = link.find_parent("tr") or link.find_parent("div", class_=lambda c: c and "job" in c)
                    company = "Неизвестна"
                    location = "София / България"

                    if parent_card:
                        # Търсене на компания
                        comp_elem = parent_card.select_one("a[href*='/company/'], .company, [class*='company']")
                        if comp_elem:
                            company = comp_elem.get_text(strip=True)

                        # Търсене на локация
                        loc_elem = parent_card.select_one(".location, [class*='location'], span:contains('София')")
                        if loc_elem:
                            location = loc_elem.get_text(strip=True)

                        # Търсене на заплата ако не е намерена от заглавието
                        if not salary:
                            sal_elem = parent_card.select_one("[class*='salary'], span.text-success, b:contains('BGN')")
                            if sal_elem:
                                salary = sal_elem.get_text(strip=True)

                    if self.is_blacklisted(title, company):
                        continue

                    # Извличане на ID от линка
                    id_match = re.search(r'/job/(\d+)', href) or re.search(r'job_id=(\d+)', href)
                    job_id = id_match.group(1) if id_match else href.split("/")[-1]

                    job = Job(
                        source=JobSource.JOBS_BG,
                        job_id=f"jobsbg_{job_id}",
                        title=title,
                        company=company,
                        location=location,
                        url=href,
                        salary=salary,
                        status=ApplicationStatus.NEW,
                        search_keyword=kw
                    )
                    found_jobs.append(job)

            except Exception as e:
                print(f"⚠️ [jobs.bg] Грешка при търсене на '{kw}': {e}")

        print(f"✅ [jobs.bg] Намерени {len(found_jobs)} подходящи обяви.")
        return found_jobs

    def extract_job_details(self, job_url: str) -> dict:
        """Извлича пълния текст на обявата от jobs.bg."""
        try:
            self.page.goto(job_url, wait_until="domcontentloaded", timeout=20000)
            self._wait_for_cloudflare()
            time.sleep(random.uniform(1.0, 2.0))

            html = self.page.content()
            soup = BeautifulSoup(html, "html.parser")

            # В jobs.bg описанието обикновено е в главния контейнер с текст или таблица
            desc_elem = soup.select_one(".job-description, #job_text, div[class*='text'], .job-details")
            if not desc_elem:
                desc_elem = soup.select_one("article, main, td.job-text")

            description = desc_elem.get_text(separator="\n", strip=True) if desc_elem else ""

            # Търсене на дата на публикуване
            date_elem = soup.select_one(".date, [class*='posted'], span:contains('Публикувана')")
            posted_date = date_elem.get_text(strip=True) if date_elem else None

            # Търсене на заплата на самата страница
            sal_elem = soup.select_one("[class*='salary'], .salary-badge, b:contains('BGN')")
            salary = sal_elem.get_text(strip=True) if sal_elem else None

            return {
                "description": description,
                "posted_date": posted_date,
                "salary": salary
            }
        except Exception as e:
            print(f"⚠️ [jobs.bg] Грешка при четене на детайли за {job_url}: {e}")
            return {"description": "", "posted_date": None, "salary": None}
