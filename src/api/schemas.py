"""
Pydantic v2 schemas for Job-Finder v2 REST API.
Defines strict request and response schemas for all endpoints.
"""
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field


class JobResponse(BaseModel):
    id: Optional[Union[int, str]] = None
    source: str = "other"
    job_id: str
    title: str
    company: str
    location: str
    url: str
    salary: Optional[str] = None
    posted_date: Optional[str] = None
    description: Optional[str] = ""
    scraped_at: Optional[str] = None
    status: str = "new"
    search_keyword: Optional[str] = None
    match_score: Optional[int] = None
    ai_summary: Optional[str] = None
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    cover_letter: Optional[str] = None
    notified: Optional[bool] = False
    notified_at: Optional[str] = None

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    jobs: List[JobResponse]
    total: int


class JobStatusUpdate(BaseModel):
    status: str = Field(
        ...,
        description="New application status, e.g. new, saved, applied, interview, offer, rejected, archived"
    )


class JobAIAnalysisUpdate(BaseModel):
    match_score: int = Field(..., ge=0, le=100)
    ai_summary: str
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    cover_letter: Optional[str] = None


class SearchRequest(BaseModel):
    keywords: Optional[List[str]] = Field(
        default=None,
        description="List of job keywords to search for. If omitted, uses default settings."
    )
    sources: Optional[List[str]] = Field(
        default=None,
        description="List of portal sources (dev.bg, jobs.bg, linkedin, himalayas, euremotejobs, hackernews) or ['all']"
    )
    max_jobs: Optional[int] = Field(
        default=15,
        ge=1,
        le=100,
        description="Maximum number of positions to fetch per portal"
    )
    clear_new: Optional[bool] = Field(
        default=False,
        description="Clear positions with status 'new' before scraping"
    )
    clear_all: Optional[bool] = Field(
        default=False,
        description="Clear all existing user positions before scraping"
    )


class SearchTaskStatusResponse(BaseModel):
    task_id: str
    status: str = Field(description="'pending' | 'running' | 'completed' | 'failed'")
    progress: int = Field(default=0, ge=0, le=100)
    logs: List[str] = Field(default_factory=list)
    jobs_found: int = 0
    error: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SearchTaskListResponse(BaseModel):
    tasks: List[SearchTaskStatusResponse]
    total: int


class CoverLetterRequest(BaseModel):
    job_id: Optional[Union[int, str]] = Field(
        default=None,
        description="ID of existing job in database. If provided, title, company, description are auto-filled."
    )
    title: Optional[str] = Field(default=None, description="Job title if not loaded from job_id")
    company: Optional[str] = Field(default=None, description="Company name if not loaded from job_id")
    description: Optional[str] = Field(default=None, description="Job description text if not loaded from job_id")
    profile_data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional custom candidate profile data overrides"
    )


class CoverLetterResponse(BaseModel):
    job_id: Optional[Union[int, str]] = None
    cover_letter: str
    success: bool = True


class CVParseResponse(BaseModel):
    name: Optional[str] = None
    current_title: Optional[str] = None
    summary: Optional[str] = None
    current_skills: List[str] = Field(default_factory=list)
    experience_years: Optional[int] = 0
    target_roles: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    raw_text: Optional[str] = None
    success: bool = True


class CVTextParseRequest(BaseModel):
    text: str = Field(..., description="Raw CV plain text to parse")


class MarketSkillItem(BaseModel):
    skill: str
    count: int
    percentage: float


class MarketStatsResponse(BaseModel):
    total_jobs: int
    avg_match_score: float
    by_status: Dict[str, int] = Field(default_factory=dict)
    by_source: Dict[str, int] = Field(default_factory=dict)
    top_skills: List[MarketSkillItem] = Field(default_factory=list)


class MarketReportResponse(BaseModel):
    report: str
    generated_at: str


class MarketKeywordsResponse(BaseModel):
    keywords: List[str]


class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str
    database: str


class StandardMessageResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
