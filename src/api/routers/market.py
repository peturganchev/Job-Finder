"""
Market Intelligence router for Job-Finder v2.
Provides aggregate labor market statistics, in-demand skill analytics, and AI reports.
"""
import re
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, Query, HTTPException, status

from src.api.schemas import (
    MarketStatsResponse,
    MarketSkillItem,
    MarketReportResponse,
    MarketKeywordsResponse,
)
from src.api.dependencies import get_repo, get_analyzer
from src.intelligence.market_insights import MarketInsightsGenerator

router = APIRouter()

TARGET_TECH_CATALOG = [
    "Python", "FastAPI", "Docker", "LangChain", "LlamaIndex", "CrewAI",
    "AutoGen", "RAG", "PostgreSQL", "PyTorch", "Kubernetes", "AWS",
    "TypeScript", "React", "Prompt Engineering", "OpenAI", "Gemini",
    "SQL", "Vector DB", "Linux"
]


@router.get("/stats", response_model=MarketStatsResponse, summary="Get labor market aggregate statistics")
def get_market_stats(
    deduplicate: bool = Query(True, description="Filter out duplicate cross-portal postings"),
    repo = Depends(get_repo),
):
    """
    Returns aggregate counts, average AI match scores, status breakdowns,
    and top 15 in-demand skills extracted from current job descriptions.
    Supports deduplication across portals by (company, title) or unique URL.
    """
    raw_jobs = repo.get_all_jobs(limit=500)

    if deduplicate:
        seen = set()
        jobs = []
        for j in raw_jobs:
            comp = (j.company or "").lower().strip()
            tit = (j.title or "").lower().strip()
            key = (comp, tit) if comp and tit else (j.url or str(j.id))
            if key not in seen:
                seen.add(key)
                jobs.append(j)
    else:
        jobs = raw_jobs

    total_jobs = len(jobs)
    scores = [j.match_score for j in jobs if j.match_score is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    by_status: Dict[str, int] = {}
    by_source: Dict[str, int] = {}

    for j in jobs:
        s = j.status.value if hasattr(j.status, "value") else str(j.status or "new")
        by_status[s] = by_status.get(s, 0) + 1
        src = j.source.value if hasattr(j.source, "value") else str(j.source or "other")
        by_source[src] = by_source.get(src, 0) + 1

    # Calculate skill frequency across descriptions
    tech_counter: Dict[str, int] = {}
    for j in jobs:
        combined = f"{j.title or ''} {j.description or ''}".lower()
        for tech in TARGET_TECH_CATALOG:
            if re.search(r"\b" + re.escape(tech.lower()) + r"\b", combined):
                tech_counter[tech] = tech_counter.get(tech, 0) + 1

    sorted_skills = sorted(tech_counter.items(), key=lambda x: x[1], reverse=True)[:15]

    top_skills_list = [
        MarketSkillItem(
            skill=tech,
            count=cnt,
            percentage=round((cnt / max(1, total_jobs)) * 100, 1)
        )
        for tech, cnt in sorted_skills
    ]

    return MarketStatsResponse(
        total_jobs=total_jobs,
        avg_match_score=avg_score,
        by_status=by_status,
        by_source=by_source,
        top_skills=top_skills_list,
    )


@router.get("/report", response_model=MarketReportResponse, summary="Generate full AI market insight report")
def get_market_report(
    limit: int = Query(40, ge=5, le=100, description="Number of positions to analyze"),
    repo = Depends(get_repo),
    analyzer = Depends(get_analyzer),
):
    """
    Generates an in-depth Markdown market report analyzing AI/ML engineering trends.
    Uses Gemini AI if configured, or heuristic analysis.
    """
    try:
        insights_gen = MarketInsightsGenerator(repo, analyzer)
        report_text = insights_gen.generate_report(limit=limit)
        return MarketReportResponse(
            report=report_text,
            generated_at=datetime.now().isoformat(),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate market report: {str(e)}"
        )


@router.get("/keywords", response_model=MarketKeywordsResponse, summary="Get unique search keywords")
def get_keywords(
    repo = Depends(get_repo),
):
    """Returns unique keywords currently associated with jobs in the database."""
    keywords = repo.get_all_search_keywords()
    return MarketKeywordsResponse(keywords=keywords)
