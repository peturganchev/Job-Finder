import time
import random
from typing import List
from urllib.parse import quote
from bs4 import BeautifulSoup
from src.scrapers.base_scraper import BaseScraper
from src.database.models import Job, JobSource, ApplicationStatus

try:
    from seleniumbase import SB
except ImportError:
    SB = None

class HimalayasScraper(BaseScraper):
    def __init__(self, page=None):
        # We don't need Playwright's page anymore, we will use SeleniumBase
        super().__init__(page, name="himalayas")

    def search(self, keywords: List[str], max_jobs: int = 25) -> List[Job]:
        if not SB:
            print("⚠️ [Himalayas] SeleniumBase не е инсталиран!")
            return []

        found_jobs: List[Job] = []
        seen_urls = set()

        try:
            with SB(uc=True, headless=True) as sb:
                for kw in keywords:
                    if len(found_jobs) >= max_jobs:
                        break
                        
                    self.set_search_context([kw])
                    search_url = f"https://himalayas.app/jobs?keyword={quote(kw)}"
                    print(f"🔍 [Himalayas] Търсене за '{kw}': {search_url}")
                    
                    try:
                        # UC Open with reconnect handles Cloudflare bypass automatically
                        sb.uc_open_with_reconnect(search_url, 4)
                        time.sleep(random.uniform(2, 4))
                        
                        # Scroll to load dynamic jobs
                        sb.execute_script("window.scrollBy(0, 800);")
                        time.sleep(1)
                        sb.execute_script("window.scrollBy(0, 800);")
                        time.sleep(1)
                        sb.execute_script("window.scrollBy(0, 800);")
                        time.sleep(1)
                        
                        html = sb.get_page_source()
                        soup = BeautifulSoup(html, "html.parser")
                        job_items = soup.select("article")
                        
                        for item in job_items:
                            if len(found_jobs) >= max_jobs:
                                break
                                
                            # The title is an <a> tag with classes text-xl font-medium text-gray-900
                            title_elem = item.find("a", class_="text-xl")
                            if not title_elem:
                                continue
                                
                            title = title_elem.get_text(strip=True)
                            url = title_elem["href"]
                            if url.startswith("/"):
                                url = f"https://himalayas.app{url}"
                                
                            if not url or url in seen_urls:
                                continue
                                
                            # find company - usually an <a> tag pointing to /companies/...
                            company_elem = item.select_one("a[href^='/companies/']")
                            company = company_elem.get_text(strip=True) if company_elem else "Неизвестна"
                            
                            # Clean up company if it's the logo
                            if not company and company_elem:
                                img = company_elem.find("img")
                                if img:
                                    company = img.get("alt", "").replace(" logo", "")
                                    
                            if self.is_blacklisted(title, company):
                                continue
                                
                            seen_urls.add(url)
                            
                            # Extract location or tags
                            location = "Remote"
                            tags = item.select("button, .inline-flex")
                            for t in tags:
                                txt = t.get_text(strip=True).lower()
                                if "time zone" in txt or "region" in txt:
                                    location += f" ({t.get_text(strip=True)})"
                            
                            job = Job(
                                job_id=url.split("/")[-1],
                                title=title,
                                company=company,
                                location=location,
                                url=url,
                                source=JobSource.HIMALAYAS,
                                status=ApplicationStatus.NEW,
                                search_keyword=kw
                            )
                            found_jobs.append(job)
                            
                    except Exception as e:
                        print(f"⚠️ [Himalayas] Грешка при ключова дума '{kw}': {e}")
        except Exception as e:
            print(f"⚠️ [Himalayas] Критична грешка при инициализация на SeleniumBase: {e}")

        return found_jobs

    def extract_job_details(self, job_url: str) -> dict:
        if not SB:
            return {}
            
        try:
            with SB(uc=True, headless=True) as sb:
                sb.uc_open_with_reconnect(job_url, 4)
                time.sleep(random.uniform(1.5, 2.5))
                html = sb.get_page_source()
                soup = BeautifulSoup(html, "html.parser")
                
                desc_elem = soup.select_one(".prose")
                description = desc_elem.get_text(separator="\n", strip=True) if desc_elem else ""
                
                return {"description": description}
        except Exception:
            return {}
