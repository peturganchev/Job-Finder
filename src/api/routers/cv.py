"""
CV intelligence and Cover Letter generation router for Job-Finder v2.
Handles PDF uploading, text extraction, structured profile parsing, and cover letter generation.
"""
import io
import re
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from pydantic import BaseModel

from src.api.schemas import (
    CVParseResponse,
    CVTextParseRequest,
    CoverLetterRequest,
    CoverLetterResponse,
)
from src.api.dependencies import get_repo, get_analyzer, get_current_user_optional
from src.intelligence.cv_parser import CVAIExtractor
from src.settings_manager import SettingsManager

router = APIRouter()


def _extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extracts text from PDF bytes using pypdf or PyPDF2."""
    extracted_text = []
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            t = page.extract_text()
            if t:
                extracted_text.append(t)
    except Exception:
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    extracted_text.append(t)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not read PDF file: {e}"
            )
    return "\n".join(extracted_text).strip()


def _heuristic_cv_extract(text: str) -> Dict[str, Any]:
    """Fallback extraction when Gemini key is not configured."""
    lower = text.lower()
    skills_catalog = [
        "python", "langchain", "llamaindex", "crewai", "autogen", "rag",
        "fastapi", "docker", "kubernetes", "aws", "azure", "gcp",
        "pytorch", "tensorflow", "sql", "postgresql", "react", "typescript",
        "git", "linux", "prompt engineering", "openai", "gemini"
    ]
    detected_skills = [s.title() for s in skills_catalog if re.search(r"\b" + re.escape(s) + r"\b", lower)]

    # Years of experience heuristic
    years = 2
    y_match = re.search(r"(\d+)\+?\s*(?:years?|години)\b", lower)
    if y_match:
        try:
            years = int(y_match.group(1))
        except ValueError:
            pass

    # Guess name from first non-empty line
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    guessed_name = lines[0] if lines and len(lines[0]) < 40 else "AI Engineer Candidate"

    return {
        "name": guessed_name,
        "current_title": "Software Engineer / AI Enthusiast",
        "summary": "Experienced software practitioner focusing on Agentic AI workflows, LLM applications, and modern backend architectures.",
        "current_skills": detected_skills or ["Python", "FastAPI", "Prompt Engineering"],
        "experience_years": years,
        "target_roles": ["Agentic AI Engineer", "LLM Systems Engineer", "Python Backend Developer"],
        "languages": ["English", "Bulgarian"],
    }


@router.post("/parse", response_model=CVParseResponse, summary="Parse CV from PDF file or text")
async def parse_cv(
    file: Optional[UploadFile] = File(None, description="Uploaded CV in PDF format"),
    text: Optional[str] = Form(None, description="Optional raw text input"),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """
    Parses candidate CV. Accepts either a PDF upload or raw text.
    Extracts candidate profile, skills, experience, and target roles using Gemini AI.
    """
    raw_text = ""
    if file:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty."
            )
        raw_text = _extract_text_from_pdf_bytes(content)
    elif text:
        raw_text = text.strip()

    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No content provided. Please upload a PDF file or provide CV text."
        )

    sm = SettingsManager()
    api_key = sm.get_api_key()
    parsed_data = {}

    if api_key:
        try:
            extractor = CVAIExtractor(api_key=api_key)
            parsed_data = extractor.parse_cv(raw_text)
        except Exception as e:
            print(f"⚠️ Gemini CV extraction failed, using heuristic: {e}")

    if not parsed_data:
        parsed_data = _heuristic_cv_extract(raw_text)

    return CVParseResponse(
        name=parsed_data.get("name"),
        current_title=parsed_data.get("current_title"),
        summary=parsed_data.get("summary"),
        current_skills=parsed_data.get("current_skills") or [],
        experience_years=parsed_data.get("experience_years") or 0,
        target_roles=parsed_data.get("target_roles") or [],
        languages=parsed_data.get("languages") or [],
        raw_text=raw_text[:2000],
        success=True
    )


@router.post("/parse-text", response_model=CVParseResponse, summary="Parse CV from JSON text body")
def parse_cv_json(
    body: CVTextParseRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """Alternative JSON body endpoint for parsing CV plain text."""
    raw_text = body.text.strip()
    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CV text cannot be empty."
        )

    sm = SettingsManager()
    api_key = sm.get_api_key()
    parsed_data = {}

    if api_key:
        try:
            extractor = CVAIExtractor(api_key=api_key)
            parsed_data = extractor.parse_cv(raw_text)
        except Exception:
            pass

    if not parsed_data:
        parsed_data = _heuristic_cv_extract(raw_text)

    return CVParseResponse(
        name=parsed_data.get("name"),
        current_title=parsed_data.get("current_title"),
        summary=parsed_data.get("summary"),
        current_skills=parsed_data.get("current_skills") or [],
        experience_years=parsed_data.get("experience_years") or 0,
        target_roles=parsed_data.get("target_roles") or [],
        languages=parsed_data.get("languages") or [],
        raw_text=raw_text[:2000],
        success=True
    )


@router.post("/cover-letter", response_model=CoverLetterResponse, summary="Generate customized cover letter")
def generate_cover_letter(
    payload: CoverLetterRequest,
    repo = Depends(get_repo),
    analyzer = Depends(get_analyzer),
):
    """
    Generates tailored cover letter using Google Gemini AI.
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
            detail="Job title and company name are required."
        )

    letter = analyzer.generate_full_cover_letter(
        title=title,
        company=company,
        description=description or ""
    )

    return CoverLetterResponse(
        job_id=payload.job_id,
        cover_letter=letter,
        success=True
    )
