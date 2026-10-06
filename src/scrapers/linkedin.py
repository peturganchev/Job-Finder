"""
LinkedIn Job Scraper.
Uses resilient HTTP client with desktop browser headers to query
LinkedIn's public guest jobs portal (Bulgaria & Sofia).
Bypasses authwalls and redirect loops without requiring cookies.
"""
import time
import random
import re
import httpx
from typing import List, Dict, Any
from urllib.parse import quote
from bs4 import BeautifulSoup
from src.scrapers.base_scraper import BaseScraper
from src.database.models import Job, JobSource, ApplicationStatus


class LinkedInScraper(BaseScraper):
    def __init__(self, page=None):
        super().__init__(page, name="linkedin")
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,bg;q=0.8",
            "Cache-Control": "max-age=0",
            "Sec-Ch-Ua": '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1"
        }
        self.client = httpx.Client(headers=self.headers, follow_redirects=True, timeout=18.0)

    def search(self, keywords: List[str], max_jobs: int = 25) -> List[Job]:
        """
        Търси в публичния портал на LinkedIn за свободни позиции в България (последни 7 дни).
        """
        found_jobs: List[Job] = []
        seen_urls = set()

        for kw in keywords[:4]:
            if len(found_jobs) >= max_jobs:
                break

            encoded_kw = quote(kw)
            search_url = f"https://www.linkedin.com/jobs/search?keywords={encoded_kw}&location=Bulgaria&f_TPR=r604800"

            try:
                print(f"🔍 [LinkedIn] Търсене за '{kw}': {search_url}")
                response = self.client.get(search_url)

                if response.status_code != 200:
                    print(f"⚠️ [LinkedIn] Статус код {response.status_code} за '{kw}'. Опит за резервен вариант...")
                    # Опит без филтър за дата
                    fallback_url = f"https://www.linkedin.com/jobs/search?keywords={encoded_kw}&location=Bulgaria"
                    response = self.client.get(fallback_url)

                if response.status_code != 200:
                    print(f"⚠️ [LinkedIn] Неуспешно извличане (HTTP {response.status_code})")
                    continue

                soup = BeautifulSoup(response.text, "html.parser")
                job_cards = soup.select(".base-card, .base-search-card, li.jobs-search-results__list-item")

                for card in job_cards:
                    if len(found_jobs) >= max_jobs:
                        break

                    title_elem = card.select_one(".base-search-card__title, h3, a.base-card__full-link")
                    if not title_elem:
                        continue

                    title = title_elem.get_text(strip=True)
                    if not title or len(title) < 4:
                        continue

                    link_elem = card.select_one("a.base-card__full-link, a[href*='/jobs/view/']")
                    href = link_elem["href"].split("?")[0] if link_elem and link_elem.get("href") else ""
                    if not href or href in seen_urls:
                        continue

                    comp_elem = card.select_one(".base-search-card__subtitle, a[data-tracking-control-name*='company']")
                    company = comp_elem.get_text(strip=True) if comp_elem else "Неизвестна"

                    if self.is_blacklisted(title, company):
                        continue

                    seen_urls.add(href)

                    loc_elem = card.select_one(".job-search-card__location")
                    location = loc_elem.get_text(strip=True) if loc_elem else "София / България"

                    id_match = re.search(r'/jobs/view/.*?(\d+)', href) or re.search(r'-(\d+)$', href)
                    job_id = id_match.group(1) if id_match else href.split("/")[-1]

                    job = Job(
                        source=JobSource.LINKEDIN,
                        job_id=f"li_{job_id}",
                        title=title,
                        company=company,
                        location=location,
                        url=href,
                        status=ApplicationStatus.NEW
                    )
                    found_jobs.append(job)

                time.sleep(random.uniform(1.2, 2.5))

            except Exception as e:
                print(f"⚠️ [LinkedIn] Грешка при търсене за '{kw}': {e}")

        print(f"✅ [LinkedIn] Намерени {len(found_jobs)} подходящи обяви.")
        return found_jobs

    def extract_job_details(self, job_url: str) -> dict:
        """Извлича пълния текст на обявата от публичната страница в LinkedIn."""
        try:
            time.sleep(random.uniform(0.8, 1.8))
            response = self.client.get(job_url)

            if response.status_code != 200:
                return {"description": "", "posted_date": None, "salary": None}

            soup = BeautifulSoup(response.text, "html.parser")

            desc_elem = soup.select_one(
                ".show-more-less-html__markup, .description__text, section.show-more-less-html, main article"
            )
            description = desc_elem.get_text(separator="\n", strip=True) if desc_elem else ""

            date_elem = soup.select_one(".posted-time-ago__text, time")
            posted_date = date_elem.get_text(strip=True) if date_elem else None

            sal_elem = soup.select_one("span:contains('€'), span:contains('$'), span:contains('BGN')")
            salary = sal_elem.get_text(strip=True) if sal_elem else None

            return {
                "description": description,
                "posted_date": posted_date,
                "salary": salary
            }
        except Exception as e:
            print(f"⚠️ [LinkedIn] Грешка при извличане на детайли: {e}")
            return {"description": "", "posted_date": None, "salary": None}
