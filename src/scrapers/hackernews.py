import httpx
import re
from typing import List
from bs4 import BeautifulSoup
from src.scrapers.base_scraper import BaseScraper
from src.database.models import Job, JobSource, ApplicationStatus

class HackerNewsScraper(BaseScraper):
    def __init__(self, page=None):
        super().__init__(page, name="hackernews")
        self.client = httpx.Client(timeout=15.0)

    def search(self, keywords: List[str], max_jobs: int = 50) -> List[Job]:
        found_jobs: List[Job] = []
        seen_urls = set()

        # Step 1: Find the latest "Ask HN: Who is hiring?" thread
        try:
            print("🔍 [HackerNews] Търсене на най-новата тема 'Who is hiring?'...")
            search_url = "https://hn.algolia.com/api/v1/search_by_date?query=Ask%20HN:%20Who%20is%20hiring?&tags=story&restrictSearchableAttributes=title"
            r = self.client.get(search_url)
            if r.status_code != 200:
                print(f"⚠️ [HackerNews] Грешка при търсене: HTTP {r.status_code}")
                return []
            
            data = r.json()
            hits = data.get("hits", [])
            if not hits:
                print("⚠️ [HackerNews] Не е намерена тема 'Who is hiring?'.")
                return []
                
            latest_thread = hits[0]
            thread_id = latest_thread["objectID"]
            print(f"✅ [HackerNews] Открита тема: {latest_thread['title']} (ID: {thread_id})")
            
            # Step 2: Fetch all comments for this thread
            comments_url = f"https://hn.algolia.com/api/v1/search?tags=comment,story_{thread_id}&hitsPerPage=1000"
            cr = self.client.get(comments_url)
            cdata = cr.json()
            comments = cdata.get("hits", [])
            print(f"✅ [HackerNews] Изтеглени {len(comments)} коментара. Започва филтриране...")
            
            for comment in comments:
                if len(found_jobs) >= max_jobs:
                    break
                    
                text = comment.get("comment_text", "")
                if not text:
                    continue
                    
                # Clean HTML
                soup = BeautifulSoup(text, "html.parser")
                clean_text = soup.get_text(separator="\n", strip=True)
                
                text_lower = clean_text.lower()
                
                # Step 3: Filter for Remote + EU/UTC (or based on remote_location)
                # HN users usually format like "Company | Title | Location | REMOTE"
                is_remote = "remote" in text_lower
                
                # Check region if specified in remote_location
                user_loc = self.remote_location.lower()
                valid_region = True
                if user_loc != "worldwide":
                    if "eu" not in text_lower and "utc" not in text_lower and user_loc not in text_lower:
                        valid_region = False
                        
                if not is_remote or not valid_region:
                    continue
                    
                # Step 4: Keyword matching for AI
                kw_match = None
                for kw in keywords:
                    if kw.lower() in text_lower:
                        kw_match = kw
                        break
                        
                if not kw_match:
                    continue
                    
                # Extract first line as title/company
                first_line = clean_text.split("\n")[0].strip()
                # Try to split by '|' or '-'
                parts = first_line.split("|")
                if len(parts) >= 2:
                    company = parts[0].strip()
                    title = parts[1].strip()
                else:
                    company = "HN Poster"
                    title = first_line[:60] + "..." if len(first_line) > 60 else first_line
                    
                if self.is_blacklisted(title, company):
                    continue
                    
                comment_id = comment["objectID"]
                url = f"https://news.ycombinator.com/item?id={comment_id}"
                
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                
                job = Job(
                    job_id=str(comment_id),
                    title=title,
                    company=company,
                    location="Remote (HackerNews)",
                    url=url,
                    source=JobSource.HACKERNEWS,
                    status=ApplicationStatus.NEW,
                    search_keyword=kw_match,
                    description=clean_text
                )
                found_jobs.append(job)
                
        except Exception as e:
            print(f"⚠️ [HackerNews] Грешка: {e}")

        return found_jobs

    def extract_job_details(self, job_url: str) -> dict:
        # Description is fully populated during search step
        return {}
