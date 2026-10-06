"""
LinkedIn Job Scraper.
Leverages persistent session (cookies) to bypass authwalls and rate limits,
targeting Agentic AI / LLM / Python engineering roles in Sofia & Remote.
"""
import time
import random
import re
from typing import List, Dict, Any
from urllib.parse import quote
from bs4 import BeautifulSoup
from src.scrapers.base_scraper import BaseScraper
from src.database.models import Job, JobSource, ApplicationStatus


class LinkedInScraper(BaseScraper):
    def __init__(self, page):
        super().__init__(page, name="linkedin")

    def search(self, keywords: List[str], max_jobs: int = 25) -> List[Job]:
        """
        Търси в LinkedIn обяви за България/София от последните 7 дни.
        """
        found_jobs: List[Job] = []
        seen_urls = set()

        for kw in keywords[:4]:
            if len(found_jobs) >= max_jobs:
                break

            encoded_kw = quote(kw)
            # f_TPR=r604800 = последните 7 дни (604800 сек)
            search_url = f"https://www.linkedin.com/jobs/search/?keywords={encoded_kw}&location=Bulgaria&f_TPR=r604800"

            try:
                print(f"🔍 [LinkedIn] Търсене за '{kw}': {search_url}")
                self.page.goto(search_url, wait_until="domcontentloaded", timeout=25000)
                time.sleep(random.uniform(2.0, 3.5))

                # Плавно скролваме за зареждане на обявите в списъка
                for _ in range(4):
                    self.page.mouse.wheel(0, 600)
                    time.sleep(random.uniform(0.7, 1.2))

                html = self.page.content()
                soup = BeautifulSoup(html, "html.parser")

                # Търсим контейнери на обявите
                job_cards = soup.select(
                    "li.jobs-search-results__list-item, div.job-card-container, div.base-card, div.base-search-card"
                )

                if not job_cards:
                    # Резервен вариант: търсим директно линковете към обяви
                    links = soup.select("a[href*='/jobs/view/']")
                    for a in links:
                        if len(found_jobs) >= max_jobs:
                            break
                        href = a.get("href", "").split("?")[0]
                        if not href or href in seen_urls:
                            continue

                        title = a.get_text(strip=True)
                        if not title or len(title) < 4:
                            continue

                        if self.is_blacklisted(title):
                            continue

                        seen_urls.add(href)
                        job_id_match = re.search(r'/jobs/view/(\d+)', href)
                        job_id = job_id_match.group(1) if job_id_match else href.split("/")[-1]

                        found_jobs.append(Job(
                            source=JobSource.LINKEDIN,
                            job_id=f"li_{job_id}",
                            title=title,
                            company="LinkedIn Company",
                            location="Sofia / Remote",
                            url=href,
                            status=ApplicationStatus.NEW
                        ))
                    continue

                for card in job_cards:
                    if len(found_jobs) >= max_jobs:
                        break

                    # Търсене на заглавие и линк
                    title_elem = card.select_one(
                        "a.job-card-list__title, a.base-card__full-link, h3.base-search-card__title, a[href*='/jobs/view/']"
                    )
                    if not title_elem:
                        continue

                    title = title_elem.get_text(strip=True)
                    href = title_elem.get("href", "").split("?")[0]
                    if not href or not href.startswith("http"):
                        continue

                    if href in seen_urls:
                        continue

                    # Компания
                    comp_elem = card.select_one(
                        ".job-card-container__primary-description, h4.base-search-card__subtitle, a[data-tracking-control-name*='company']"
                    )
                    company = comp_elem.get_text(strip=True) if comp_elem else "Неизвестна"

                    if self.is_blacklisted(title, company):
                        continue

                    seen_urls.add(href)

                    # Локация
                    loc_elem = card.select_one(
                        ".job-card-container__metadata-item, span.job-search-card__location"
                    )
                    location = loc_elem.get_text(strip=True) if loc_elem else "София / Remote"

                    # Извличане на ID
                    job_id_match = re.search(r'/jobs/view/(\d+)', href)
                    job_id = job_id_match.group(1) if job_id_match else href.split("/")[-1]

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

            except Exception as e:
                print(f"⚠️ [LinkedIn] Грешка при търсене за '{kw}': {e}")

        print(f"✅ [LinkedIn] Намерени {len(found_jobs)} подходящи обяви.")
        return found_jobs

    def extract_job_details(self, job_url: str) -> dict:
        """Извлича пълния текст на обявата от LinkedIn."""
        try:
            self.page.goto(job_url, wait_until="domcontentloaded", timeout=20000)
            time.sleep(random.uniform(1.5, 2.5))

            # Скролваме малко за зареждане на тялото
            self.page.mouse.wheel(0, 400)
            time.sleep(1.0)

            # Опитваме да кликнем "Show more" бутона ако има
            try:
                show_more_btn = self.page.query_selector(
                    "button.show-more-less-html__button, button[aria-label*='Show more'], button[aria-label*='повече']"
                )
                if show_more_btn and show_more_btn.is_visible():
                    show_more_btn.click()
                    time.sleep(0.5)
            except Exception:
                pass

            html = self.page.content()
            soup = BeautifulSoup(html, "html.parser")

            desc_elem = soup.select_one(
                ".jobs-description__content, .show-more-less-html__markup, .description__text, article"
            )
            description = desc_elem.get_text(separator="\n", strip=True) if desc_elem else ""

            # Дата на публикуване
            date_elem = soup.select_one(
                "span.jobs-unified-top-card__posted-date, time.job-search-card__listdate, time"
            )
            posted_date = date_elem.get_text(strip=True) if date_elem else None

            # Заплата (ако има посочена в горния панел)
            sal_elem = soup.select_one(
                "li.job-details-jobs-unified-top-card__job-insight:contains('€'), span:contains('$')"
            )
            salary = sal_elem.get_text(strip=True) if sal_elem else None

            return {
                "description": description,
                "posted_date": posted_date,
                "salary": salary
            }
        except Exception as e:
            print(f"⚠️ [LinkedIn] Грешка при четене на детайли за {job_url}: {e}")
            return {"description": "", "posted_date": None, "salary": None}
