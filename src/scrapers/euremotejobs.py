import httpx
from typing import List
from urllib.parse import quote
from bs4 import BeautifulSoup
from src.scrapers.base_scraper import BaseScraper
from src.database.models import Job, JobSource, ApplicationStatus

class EURemoteJobsScraper(BaseScraper):
    def __init__(self, page=None):
        super().__init__(page, name="euremotejobs")
        self.client = httpx.Client(timeout=15.0)

    def search(self, keywords: List[str], max_jobs: int = 25) -> List[Job]:
        found_jobs: List[Job] = []
        seen_urls = set()

        for kw in keywords:
            if len(found_jobs) >= max_jobs:
                break
                
            self.set_search_context([kw])
            search_url = f"https://euremotejobs.com/?s={quote(kw)}"
            print(f"🔍 [EU Remote Jobs] Търсене за '{kw}': {search_url}")
            
            try:
                response = self.client.get(search_url)
                if response.status_code != 200:
                    continue
                    
                soup = BeautifulSoup(response.text, "html.parser")
                job_items = soup.find_all("article", class_="job_listing")
                
                for item in job_items:
                    if len(found_jobs) >= max_jobs:
                        break
                        
                    title_elem = item.find("h2", class_="entry-title")
                    if not title_elem:
                        continue
                    
                    link_elem = title_elem.find("a", href=True)
                    if not link_elem:
                        continue
                        
                    title = title_elem.get_text(strip=True)
                    company = "Неизвестна (EU Remote)"
                    url = link_elem["href"]
                    
                    if not url or url in seen_urls:
                        continue
                        
                    if self.is_blacklisted(title, company):
                        continue
                        
                    seen_urls.add(url)
                    
                    location = "EU Remote"
                    
                    job = Job(
                        job_id=url.split("/")[-2] if url.endswith("/") else url.split("/")[-1],
                        title=title,
                        company=company,
                        location=location,
                        url=url,
                        source=JobSource.EUREMOTE,
                        status=ApplicationStatus.NEW,
                        search_keyword=kw
                    )
                    found_jobs.append(job)
                    
            except Exception as e:
                print(f"⚠️ [EU Remote Jobs] Грешка: {e}")

        return found_jobs

    def extract_job_details(self, job_url: str) -> dict:
        try:
            response = self.client.get(job_url)
            if response.status_code != 200:
                return {}
                
            soup = BeautifulSoup(response.text, "html.parser")
            desc_elem = soup.select_one(".job_listing-description, .job-description, article")
            description = desc_elem.get_text(separator="\n", strip=True) if desc_elem else ""
            
            return {"description": description}
        except Exception:
            return {}
