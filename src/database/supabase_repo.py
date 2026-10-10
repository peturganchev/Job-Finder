"""
Supabase Database Repository for Job Finder.
Handles persistence, multi-user isolation, deduplication, and task queues in PostgreSQL.
"""
import os
import json
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from supabase import create_client, Client
from src.database.models import Job, ApplicationStatus, JobSource


class SupabaseRepository:
    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        user_id: Optional[str] = None
    ):
        self.url = supabase_url or os.getenv("SUPABASE_URL")
        self.key = supabase_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
        self.user_id = user_id
        
        if not self.url or not self.key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be provided or set in environment.")
            
        self.client: Client = create_client(self.url, self.key)

    def set_user_id(self, user_id: str):
        """Задава текущия потребител за изолиране на данните."""
        self.user_id = user_id

    def exists(self, url: str) -> bool:
        """Проверява дали обява с такъв URL съществува в глобалния каталог jobs."""
        res = self.client.table("jobs").select("id").eq("url", url).limit(1).execute()
        return len(res.data) > 0

    def user_has_job(self, url: str) -> bool:
        """Проверява дали обявата вече е свързана с текущия потребител."""
        if not self.user_id:
            return self.exists(url)
        res = self.client.table("jobs").select("id").eq("url", url).limit(1).execute()
        if not res.data:
            return False
        job_db_id = res.data[0]["id"]
        uj_res = self.client.table("user_jobs").select("id").eq("user_id", str(self.user_id)).eq("job_id", job_db_id).limit(1).execute()
        return len(uj_res.data) > 0

    def add_job(self, job: Job) -> Optional[Union[int, str]]:
        """
        Записва нова обява в глобалния пул (jobs).
        Ако потребителят е зададен, създава и първоначален запис в user_jobs.
        """
        job_db_id = None
        if self.exists(job.url):
            # Ако вече съществува в каталога, намираме нейния ID и преизползваме описанието
            res = self.client.table("jobs").select("id, description, salary, posted_date").eq("url", job.url).limit(1).execute()
            if res.data:
                job_db_id = res.data[0]["id"]
                if not job.description and res.data[0].get("description"):
                    job.description = res.data[0]["description"]
                if not job.salary and res.data[0].get("salary"):
                    job.salary = res.data[0]["salary"]
        else:
            job_payload = {
                "source": job.source,
                "job_id": str(job.job_id),
                "title": job.title,
                "company": job.company,
                "location": job.location,
                "url": job.url,
                "salary": job.salary,
                "posted_date": job.posted_date,
                "description": job.description,
                "search_keyword": job.search_keyword,
                "scraped_at": job.scraped_at or datetime.now().isoformat()
            }
            res = self.client.table("jobs").insert(job_payload).execute()
            if res.data:
                job_db_id = res.data[0]["id"]

        if not job_db_id:
            return None

        # Ако има текущ потребител, записваме потребителското състояние
        if self.user_id:
            user_job_payload = {
                "user_id": str(self.user_id),
                "job_id": job_db_id,
                "status": str(job.status.value if hasattr(job.status, "value") else job.status),
                "match_score": job.match_score,
                "ai_summary": job.ai_summary,
                "matched_skills": job.matched_skills or [],
                "missing_skills": job.missing_skills or [],
                "cover_letter": job.cover_letter,
                "updated_at": datetime.now().isoformat()
            }
            self.client.table("user_jobs").upsert(user_job_payload, on_conflict="user_id,job_id").execute()

        return job_db_id

    def update_ai_analysis(
        self,
        job_id: Union[int, str],
        match_score: int,
        ai_summary: str,
        matched_skills: List[str],
        missing_skills: List[str],
        cover_letter: Optional[str] = None
    ) -> bool:
        """Записва AI анализа за конкретна обява."""
        if self.user_id:
            payload = {
                "user_id": str(self.user_id),
                "job_id": str(job_id),
                "match_score": match_score,
                "ai_summary": ai_summary,
                "matched_skills": matched_skills or [],
                "missing_skills": missing_skills or [],
                "cover_letter": cover_letter,
                "updated_at": datetime.now().isoformat()
            }
            res = self.client.table("user_jobs").upsert(payload, on_conflict="user_id,job_id").execute()
            return len(res.data) > 0
        return False

    def update_status(self, job_id: Union[int, str], status: ApplicationStatus) -> bool:
        """Променя статуса на кандидатурата за дадения потребител."""
        if not self.user_id:
            return False
            
        status_str = status.value if hasattr(status, "value") else str(status)
        payload = {
            "user_id": str(self.user_id),
            "job_id": str(job_id),
            "status": status_str,
            "updated_at": datetime.now().isoformat()
        }
        res = self.client.table("user_jobs").upsert(payload, on_conflict="user_id,job_id").execute()
        return len(res.data) > 0

    def mark_as_notified(self, job_id: Union[int, str]) -> bool:
        """Маркира обявата като успешно изпратена в Discord/Telegram за текущия потребител."""
        if not self.user_id:
            return False
        payload = {
            "user_id": str(self.user_id),
            "job_id": str(job_id),
            "notified": True,
            "notified_at": datetime.now().isoformat()
        }
        res = self.client.table("user_jobs").upsert(payload, on_conflict="user_id,job_id").execute()
        return len(res.data) > 0

    def get_jobs_without_ai_analysis(self) -> List[Job]:
        """Връща обяви, които нямат Gemini AI анализ или имат само базов евристичен анализ."""
        if not self.user_id:
            return []
        try:
            res = self.client.table("user_jobs").select("*, jobs(*)").eq("user_id", str(self.user_id)).is_("match_score", "null").limit(100).execute()
            jobs = []
            for item in res.data:
                job_data = item.get("jobs")
                if not job_data:
                    continue
                job_data["id"] = item["job_id"]
                job_data["status"] = item.get("status", "new")
                jobs.append(self._format_job(job_data))
            return jobs
        except Exception as e:
            print(f"⚠️ Грешка при извличане на обяви без AI анализ: {e}")
            return []

    def get_all_jobs_for_reanalysis(self) -> List[Job]:
        """Връща всички обяви на потребителя за цялостно преоценяване."""
        if not self.user_id:
            return []
        return self.get_all_jobs(limit=500)

    def get_job_by_id(self, job_id: Union[int, str]) -> Optional[Job]:
        """Връща обява по ID."""
        res = self.client.table("jobs").select("*").eq("id", str(job_id)).limit(1).execute()
        if not res.data:
            return None
        row = res.data[0]
        return self._format_job(row)

    def get_all_jobs(
        self,
        status: Optional[str] = None,
        min_score: Optional[int] = None,
        source: Optional[str] = None,
        search_keyword: Optional[str] = None,
        limit: int = 200
    ) -> List[Job]:
        """
        Извлича обяви за дашборда с опционални филтри.
        Ако има user_id, взима персоналните статуси и оценки от user_jobs.
        """
        if self.user_id:
            # Query user_jobs with joined job details
            query = self.client.table("user_jobs").select("*, jobs(*)").eq("user_id", str(self.user_id))
            if status:
                query = query.eq("status", status)
            if min_score is not None:
                query = query.gte("match_score", min_score)
            
            res = query.order("match_score", desc=True).limit(limit).execute()
            
            jobs: List[Job] = []
            for item in res.data:
                job_data = item.get("jobs")
                if not job_data:
                    continue
                # Merge user-specific overrides into the job object
                job_data["id"] = item["job_id"]
                job_data["status"] = item.get("status", "new")
                job_data["match_score"] = item.get("match_score")
                job_data["ai_summary"] = item.get("ai_summary")
                job_data["matched_skills"] = item.get("matched_skills") or []
                job_data["missing_skills"] = item.get("missing_skills") or []
                job_data["cover_letter"] = item.get("cover_letter")
                
                if source and job_data.get("source") != source:
                    continue
                if search_keyword and search_keyword != "Всички" and job_data.get("search_keyword") != search_keyword:
                    continue
                    
                jobs.append(self._format_job(job_data))
            return jobs
        else:
            # Global view if not logged in
            query = self.client.table("jobs").select("*")
            if source:
                query = query.eq("source", source)
            if search_keyword and search_keyword != "Всички":
                query = query.eq("search_keyword", search_keyword)
            res = query.order("created_at", desc=True).limit(limit).execute()
            return [self._format_job(r) for r in res.data]

    def get_stats(self) -> Dict[str, Any]:
        """Статистика за събраните обяви."""
        if self.user_id:
            res = self.client.table("user_jobs").select("status, match_score").eq("user_id", str(self.user_id)).execute()
            data = res.data
            total = len(data)
            scores = [d["match_score"] for d in data if d.get("match_score") is not None]
            avg_score = round(sum(scores) / len(scores), 1) if scores else 0
            
            by_status = {}
            for d in data:
                s = d.get("status", "new")
                by_status[s] = by_status.get(s, 0) + 1
                
            return {
                "total_jobs": total,
                "avg_match_score": avg_score,
                "by_status": by_status,
                "by_source": {}
            }
        else:
            res = self.client.table("jobs").select("id", count="exact").execute()
            return {
                "total_jobs": res.count or 0,
                "avg_match_score": 0,
                "by_status": {},
                "by_source": {}
            }

    def delete_job(self, job_id: Union[int, str]) -> bool:
        """Изтрива обява от списъка на потребителя."""
        if self.user_id:
            res = self.client.table("user_jobs").delete().eq("user_id", str(self.user_id)).eq("job_id", str(job_id)).execute()
            return len(res.data) > 0
        return False

    def delete_all_jobs(self, only_new: bool = False) -> int:
        """Изчиства обявите за дадения потребител."""
        if not self.user_id:
            return 0
        query = self.client.table("user_jobs").delete().eq("user_id", str(self.user_id))
        if only_new:
            query = query.eq("status", "new")
        res = query.execute()
        return len(res.data)

    def get_all_descriptions_for_market_analysis(self, limit: int = 100) -> List[Dict[str, str]]:
        """Връща заглавия и описания на обяви за извличане на пазарни инсайти с Gemini."""
        try:
            res = (
                self.client.table("jobs")
                .select("id, title, company, location, description")
                .not_.is_("description", "null")
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            out = []
            for row in (res.data or []):
                desc = row.get("description") or ""
                if len(desc) > 50:
                    out.append({
                        "id": row.get("id"),
                        "title": row.get("title", ""),
                        "company": row.get("company", ""),
                        "location": row.get("location", ""),
                        "description": desc
                    })
            return out
        except Exception as e:
            print(f"⚠️ Грешка при извличане на пазарни данни от Supabase: {e}")
            return []

    def import_catalog_jobs_to_user(self, limit: int = 100) -> int:
        """
        Копира/свързва наличните обяви от общия каталог `jobs` към `user_jobs`
        за текущо логнатия потребител, ако все още не са добавени.
        """
        if not self.user_id:
            return 0
        try:
            # Взимаме вече съществуващите за потребителя
            existing_res = self.client.table("user_jobs").select("job_id").eq("user_id", str(self.user_id)).execute()
            existing_ids = {r["job_id"] for r in (existing_res.data or [])}

            # Взимаме обяви от глобалния каталог
            catalog_res = self.client.table("jobs").select("id").order("created_at", desc=True).limit(limit).execute()
            catalog_jobs = catalog_res.data or []

            new_entries = []
            now_str = datetime.now().isoformat()
            for j in catalog_jobs:
                jid = j["id"]
                if jid not in existing_ids:
                    new_entries.append({
                        "user_id": str(self.user_id),
                        "job_id": jid,
                        "status": "new",
                        "updated_at": now_str
                    })

            if new_entries:
                res = self.client.table("user_jobs").upsert(new_entries, on_conflict="user_id,job_id").execute()
                return len(res.data or [])
            return 0
        except Exception as e:
            print(f"⚠️ Грешка при импортиране на обяви от каталога: {e}")
            return 0

    def get_all_search_keywords(self) -> List[str]:
        """Уникални ключови думи в базата."""
        res = self.client.table("jobs").select("search_keyword").execute()
        keywords = {r["search_keyword"] for r in res.data if r.get("search_keyword")}
        return sorted(list(keywords))

    def _format_job(self, data: dict) -> Job:
        """Преобразува dictionary от Supabase в Job обект."""
        return Job(
            id=data.get("id"),
            source=data.get("source", JobSource.OTHER),
            job_id=str(data.get("job_id", "")),
            title=data.get("title", ""),
            company=data.get("company", ""),
            location=data.get("location", ""),
            url=data.get("url", ""),
            salary=data.get("salary"),
            posted_date=data.get("posted_date"),
            description=data.get("description", ""),
            scraped_at=data.get("scraped_at", datetime.now().isoformat()),
            status=ApplicationStatus(data.get("status", "new")),
            search_keyword=data.get("search_keyword"),
            match_score=data.get("match_score"),
            ai_summary=data.get("ai_summary"),
            matched_skills=data.get("matched_skills") or [],
            missing_skills=data.get("missing_skills") or [],
            cover_letter=data.get("cover_letter")
        )
