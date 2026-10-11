"""
Jobs router for Job-Finder v2.
Handles listing, filtering, status updates, AI analysis updates, and job management.
"""
from typing import Optional, List, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.api.schemas import (
    JobResponse,
    JobListResponse,
    JobStatusUpdate,
    JobAIAnalysisUpdate,
    StandardMessageResponse,
    CoverLetterRequest,
    CoverLetterResponse,
)
from src.api.dependencies import get_repo, get_analyzer, get_current_user_optional
from src.database.models import ApplicationStatus

router = APIRouter()


@router.get("", response_model=JobListResponse, summary="List jobs with optional filters")
def list_jobs(
    status: Optional[str] = Query(None, description="Filter by status (new, saved, applied, etc.)"),
    min_score: Optional[int] = Query(None, ge=0, le=100, description="Minimum AI match score"),
    source: Optional[str] = Query(None, description="Filter by source (dev.bg, jobs.bg, linkedin, etc.)"),
    search_keyword: Optional[str] = Query(None, description="Filter by search keyword"),
    limit: int = Query(200, ge=1, le=1000, description="Maximum number of positions to retrieve"),
    repo = Depends(get_repo),
):
    """
    Retrieve job positions. If user is authenticated, returns personalized user_jobs
    with scores, statuses and notes. Otherwise, returns public catalog jobs.
    """
    try:
        jobs = repo.get_all_jobs(
            status=status,
            min_score=min_score,
            source=source,
            search_keyword=search_keyword,
            limit=limit,
        )
        job_responses = [
            JobResponse(
                id=j.id,
                source=str(j.source),
                job_id=str(j.job_id),
                title=j.title,
                company=j.company,
                location=j.location,
                url=j.url,
                salary=j.salary,
                posted_date=j.posted_date,
                description=j.description,
                scraped_at=j.scraped_at,
                status=str(j.status.value if hasattr(j.status, "value") else j.status),
                search_keyword=j.search_keyword,
                match_score=j.match_score,
                ai_summary=j.ai_summary,
                matched_skills=j.matched_skills or [],
                missing_skills=j.missing_skills or [],
                cover_letter=j.cover_letter,
                notified=bool(j.notified),
                notified_at=j.notified_at,
            )
            for j in jobs
        ]
        return JobListResponse(jobs=job_responses, total=len(job_responses))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving jobs: {str(e)}"
        )


@router.get("/{job_id}", response_model=JobResponse, summary="Get job details by ID")
def get_job(
    job_id: str,
    repo = Depends(get_repo),
):
    """Retrieve single job details by its database ID."""
    job = repo.get_job_by_id(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with ID '{job_id}' not found."
        )
    return JobResponse(
        id=job.id,
        source=str(job.source),
        job_id=str(job.job_id),
        title=job.title,
        company=job.company,
        location=job.location,
        url=job.url,
        salary=job.salary,
        posted_date=job.posted_date,
        description=job.description,
        scraped_at=job.scraped_at,
        status=str(job.status.value if hasattr(job.status, "value") else job.status),
        search_keyword=job.search_keyword,
        match_score=job.match_score,
        ai_summary=job.ai_summary,
        matched_skills=job.matched_skills or [],
        missing_skills=job.missing_skills or [],
        cover_letter=job.cover_letter,
        notified=bool(job.notified),
        notified_at=job.notified_at,
    )


@router.patch("/{job_id}/status", response_model=StandardMessageResponse, summary="Update job application status")
def update_job_status(
    job_id: str,
    payload: JobStatusUpdate,
    repo = Depends(get_repo),
):
    """
    Update application status (e.g. new -> applied, saved, interview, offer, rejected).
    """
    valid_statuses = [s.value for s in ApplicationStatus]
    status_lower = payload.status.lower()
    if status_lower not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Allowed: {', '.join(valid_statuses)}"
        )

    success = repo.update_status(job_id=job_id, status=ApplicationStatus(status_lower))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update status. Ensure user is authenticated or job exists."
        )
    return StandardMessageResponse(
        success=True,
        message=f"Job {job_id} status updated to {status_lower}.",
        data={"job_id": job_id, "status": status_lower}
    )


@router.patch("/{job_id}/ai", response_model=StandardMessageResponse, summary="Update AI match analysis for a job")
def update_job_ai_analysis(
    job_id: str,
    payload: JobAIAnalysisUpdate,
    repo = Depends(get_repo),
):
    """Updates AI match score, summary, and skills for a specific position."""
    success = repo.update_ai_analysis(
        job_id=job_id,
        match_score=payload.match_score,
        ai_summary=payload.ai_summary,
        matched_skills=payload.matched_skills,
        missing_skills=payload.missing_skills,
        cover_letter=payload.cover_letter,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update AI analysis. Ensure user is authenticated."
        )
    return StandardMessageResponse(
        success=True,
        message=f"AI analysis for job {job_id} updated successfully.",
        data={"job_id": job_id, "match_score": payload.match_score}
    )


@router.post("/cover-letter", response_model=CoverLetterResponse, summary="Generate tailored cover letter")
def generate_cover_letter(
    payload: CoverLetterRequest,
    repo = Depends(get_repo),
    analyzer = Depends(get_analyzer),
):
    """
    Generates a tailored cover letter using Google Gemini AI.
    Can supply either an existing job_id or explicit title, company, description.
    """
    title = payload.title
    company = payload.company
    description = payload.description

    if payload.job_id:
        job = repo.get_job_by_id(payload.job_id)
        if job:
            title = title or job.title
            company = company or job.company
            description = description or job.description

    if not title or not company:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job title and company name are required to generate a cover letter."
        )

    letter = analyzer.generate_full_cover_letter(
        title=title,
        company=company,
        description=description or ""
    )

    # If job_id was given and user is authenticated, update the job in repo
    if payload.job_id and letter:
        try:
            job = repo.get_job_by_id(payload.job_id)
            if job:
                repo.update_ai_analysis(
                    job_id=payload.job_id,
                    match_score=job.match_score or 50,
                    ai_summary=job.ai_summary or "",
                    matched_skills=job.matched_skills or [],
                    missing_skills=job.missing_skills or [],
                    cover_letter=letter
                )
        except Exception:
            pass

    return CoverLetterResponse(
        job_id=payload.job_id,
        cover_letter=letter,
        success=True
    )


@router.delete("/{job_id}", response_model=StandardMessageResponse, summary="Delete job from user's list")
def delete_job(
    job_id: str,
    repo = Depends(get_repo),
):
    """Removes a position from the user's dashboard."""
    success = repo.delete_job(job_id)
    return StandardMessageResponse(
        success=success,
        message=f"Job {job_id} removed." if success else f"Could not remove job {job_id}.",
        data={"job_id": job_id}
    )


@router.delete("", response_model=StandardMessageResponse, summary="Delete all or new jobs")
def delete_all_jobs(
    only_new: bool = Query(False, description="If true, deletes only jobs with status 'new'"),
    repo = Depends(get_repo),
):
    """Bulk clears positions for the authenticated user."""
    count = repo.delete_all_jobs(only_new=only_new)
    return StandardMessageResponse(
        success=True,
        message=f"Deleted {count} positions.",
        data={"deleted_count": count, "only_new": only_new}
    )


@router.post("/import-catalog", response_model=StandardMessageResponse, summary="Import catalog jobs to user")
def import_catalog_jobs(
    limit: int = Query(100, ge=1, le=500),
    repo = Depends(get_repo),
):
    """Links global catalog jobs to the authenticated user's workspace."""
    if hasattr(repo, "import_catalog_jobs_to_user"):
        count = repo.import_catalog_jobs_to_user(limit=limit)
        return StandardMessageResponse(
            success=True,
            message=f"Imported {count} jobs from the global catalog.",
            data={"imported_count": count}
        )
    return StandardMessageResponse(
        success=True,
        message="Local repository does not require catalog import.",
        data={"imported_count": 0}
    )
