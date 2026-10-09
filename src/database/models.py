"""
Data models for Job Finder.
"""
from enum import Enum
from typing import Optional, List, Union
from datetime import datetime
from pydantic import BaseModel, Field


class ApplicationStatus(str, Enum):
    NEW = "new"              # Току-що намерена
    SAVED = "saved"          # Запазена за преглед
    APPLIED = "applied"      # Подадена кандидатура
    INTERVIEW = "interview"  # Поканен на интервю
    OFFER = "offer"          # Получена оферта
    REJECTED = "rejected"    # Отказана / неактуална
    ARCHIVED = "archived"    # Архивирана


class JobSource(str, Enum):
    DEV_BG = "dev.bg"
    JOBS_BG = "jobs.bg"
    LINKEDIN = "linkedin"
    HIMALAYAS = "himalayas"
    EUREMOTE = "euremotejobs"
    HACKERNEWS = "hackernews"
    OTHER = "other"


class Job(BaseModel):
    id: Optional[Union[int, str]] = None
    source: str = JobSource.OTHER
    job_id: str  # Външен идентификатор или хеш на URL
    title: str
    company: str
    location: str
    url: str
    salary: Optional[str] = None
    posted_date: Optional[str] = None
    description: str = ""
    scraped_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    status: ApplicationStatus = ApplicationStatus.NEW
    search_keyword: Optional[str] = None

    # AI анализ от Google Gemini
    match_score: Optional[int] = None
    ai_summary: Optional[str] = None
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    cover_letter: Optional[str] = None

    # Нотификация
    notified: bool = False
    notified_at: Optional[str] = None

    class Config:
        use_enum_values = True
