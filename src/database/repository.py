"""
SQLite Database Repository for Job Finder.
Handles persistence, deduplication, search, and status tracking.
"""
import sqlite3
import json
import os
from typing import Optional, List, Dict, Any
from datetime import datetime
from src.database.models import Job, ApplicationStatus


class JobRepository:
    def __init__(self, db_path: str = "data/jobs.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Създава таблиците и индексите, ако все още не съществуват."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT NOT NULL,
                    job_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    company TEXT NOT NULL,
                    location TEXT NOT NULL,
                    url TEXT UNIQUE NOT NULL,
                    salary TEXT,
                    posted_date TEXT,
                    description TEXT,
                    scraped_at TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'new',
                    match_score INTEGER,
                    ai_summary TEXT,
                    matched_skills TEXT,
                    missing_skills TEXT,
                    cover_letter TEXT,
                    notified INTEGER NOT NULL DEFAULT 0,
                    notified_at TEXT
                )
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_jobs_url ON jobs (url);
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_jobs_notified ON jobs (notified);
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_jobs_score ON jobs (match_score);
            """)
            conn.commit()

    def exists(self, url: str) -> bool:
        """Проверява дали обява с такъв URL вече съществува в базата."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM jobs WHERE url = ? LIMIT 1", (url,))
            return cursor.fetchone() is not None

    def add_job(self, job: Job) -> Optional[int]:
        """
        Записва нова обява в базата.
        Ако обявата вече съществува по URL, връща None (дедупликация).
        """
        if self.exists(job.url):
            return None

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO jobs (
                    source, job_id, title, company, location, url, salary,
                    posted_date, description, scraped_at, status, match_score,
                    ai_summary, matched_skills, missing_skills, cover_letter,
                    notified, notified_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                job.source,
                job.job_id,
                job.title,
                job.company,
                job.location,
                job.url,
                job.salary,
                job.posted_date,
                job.description,
                job.scraped_at,
                job.status,
                job.match_score,
                job.ai_summary,
                json.dumps(job.matched_skills or [], ensure_ascii=False),
                json.dumps(job.missing_skills or [], ensure_ascii=False),
                job.cover_letter,
                1 if job.notified else 0,
                job.notified_at
            ))
            conn.commit()
            return cursor.lastrowid

    def update_ai_analysis(
        self,
        job_id: int,
        match_score: int,
        ai_summary: str,
        matched_skills: List[str],
        missing_skills: List[str],
        cover_letter: Optional[str] = None
    ) -> bool:
        """Записва резултатите от анализа на Google Gemini за конкретна обява."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE jobs
                SET match_score = ?,
                    ai_summary = ?,
                    matched_skills = ?,
                    missing_skills = ?,
                    cover_letter = ?
                WHERE id = ?
            """, (
                match_score,
                ai_summary,
                json.dumps(matched_skills or [], ensure_ascii=False),
                json.dumps(missing_skills or [], ensure_ascii=False),
                cover_letter,
                job_id
            ))
            conn.commit()
            return cursor.rowcount > 0

    def mark_as_notified(self, job_id: int) -> bool:
        """Маркира обявата като успешно изпратена в Discord/Telegram."""
        now_str = datetime.now().isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE jobs
                SET notified = 1, notified_at = ?
                WHERE id = ?
            """, (now_str, job_id))
            conn.commit()
            return cursor.rowcount > 0

    def update_status(self, job_id: int, status: ApplicationStatus) -> bool:
        """Променя статуса на кандидатурата (applied, interview, rejected, etc.)."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE jobs
                SET status = ?
                WHERE id = ?
            """, (str(status), job_id))
            conn.commit()
            return cursor.rowcount > 0

    def get_job_by_id(self, job_id: int) -> Optional[Job]:
        """Връща обява по ID."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_job(row)

    def get_unnotified_jobs(self, min_score: int = 0) -> List[Job]:
        """Връща всички все още неизпратени обяви с оценка над min_score."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM jobs
                WHERE notified = 0
                  AND (match_score IS NULL OR match_score >= ?)
                ORDER BY match_score DESC, id DESC
            """, (min_score,))
            return [self._row_to_job(row) for row in cursor.fetchall()]

    def get_jobs_without_ai_analysis(self) -> List[Job]:
        """Връща обяви, които нямат Gemini AI анализ или имат само базов евристичен анализ."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM jobs
                WHERE ai_summary IS NULL
                   OR ai_summary LIKE '%Базов евристичен%'
                   OR match_score IS NULL
                ORDER BY id ASC
            """)
            return [self._row_to_job(row) for row in cursor.fetchall()]

    def get_all_jobs_for_reanalysis(self) -> List[Job]:
        """Връща абсолютно всички обяви в базата данни за цялостно преоценяване."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM jobs ORDER BY id ASC")
            return [self._row_to_job(row) for row in cursor.fetchall()]

    def get_all_jobs(
        self,
        status: Optional[str] = None,
        min_score: Optional[int] = None,
        source: Optional[str] = None,
        limit: int = 200
    ) -> List[Job]:
        """Извлича обяви за дашборда с опционални филтри."""
        query = "SELECT * FROM jobs WHERE 1=1"
        params: List[Any] = []

        if status:
            query += " AND status = ?"
            params.append(status)
        if min_score is not None:
            query += " AND match_score >= ?"
            params.append(min_score)
        if source:
            query += " AND source = ?"
            params.append(source)

        query += " ORDER BY match_score DESC NULLS LAST, id DESC LIMIT ?"
        params.append(limit)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [self._row_to_job(row) for row in cursor.fetchall()]

    def get_stats(self) -> Dict[str, Any]:
        """Връща статистика за събраните обяви."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM jobs")
            total = cursor.fetchone()[0]

            cursor.execute("SELECT source, COUNT(*) FROM jobs GROUP BY source")
            by_source = dict(cursor.fetchall())

            cursor.execute("SELECT status, COUNT(*) FROM jobs GROUP BY status")
            by_status = dict(cursor.fetchall())

            cursor.execute("SELECT COUNT(*) FROM jobs WHERE notified = 1")
            notified_count = cursor.fetchone()[0]

            cursor.execute("SELECT AVG(match_score) FROM jobs WHERE match_score IS NOT NULL")
            avg_score = cursor.fetchone()[0] or 0

            return {
                "total_jobs": total,
                "by_source": by_source,
                "by_status": by_status,
                "notified_count": notified_count,
                "avg_match_score": round(avg_score, 1)
            }

    def get_all_descriptions_for_market_analysis(self, limit: int = 100) -> List[Dict[str, str]]:
        """Връща заглавия и описания на обяви за извличане на пазарни инсайти с Gemini."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, title, company, location, description
                FROM jobs
                WHERE description IS NOT NULL AND LENGTH(description) > 50
                ORDER BY id DESC
                LIMIT ?
            """, (limit,))
            return [
                {
                    "id": row["id"],
                    "title": row["title"],
                    "company": row["company"],
                    "location": row["location"],
                    "description": row["description"]
                }
                for row in cursor.fetchall()
            ]

    def _row_to_job(self, row: sqlite3.Row) -> Job:
        """Помощна функция за конвертиране на SQLite ред към Pydantic обект Job."""
        matched = []
        missing = []
        try:
            if row["matched_skills"]:
                matched = json.loads(row["matched_skills"])
            if row["missing_skills"]:
                missing = json.loads(row["missing_skills"])
        except Exception:
            pass

        return Job(
            id=row["id"],
            source=row["source"],
            job_id=row["job_id"],
            title=row["title"],
            company=row["company"],
            location=row["location"],
            url=row["url"],
            salary=row["salary"],
            posted_date=row["posted_date"],
            description=row["description"] or "",
            scraped_at=row["scraped_at"],
            status=ApplicationStatus(row["status"]) if row["status"] in ApplicationStatus._value2member_map_ else ApplicationStatus.NEW,
            match_score=row["match_score"],
            ai_summary=row["ai_summary"],
            matched_skills=matched,
            missing_skills=missing,
            cover_letter=row["cover_letter"],
            notified=bool(row["notified"]),
            notified_at=row["notified_at"]
        )
