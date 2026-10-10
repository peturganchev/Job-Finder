"""
Settings router for Job-Finder v2.
Manages user settings, Gemini API key validation, model selection, blacklists, and roadmap progress.
"""
import os
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status

from src.api.schemas import (
    SettingsResponse,
    SettingsUpdateRequest,
    GeminiVerifyRequest,
    GeminiVerifyResponse,
    StandardMessageResponse,
)
from src.api.dependencies import (
    get_current_user_optional,
    get_supabase_client,
)
from src.settings_manager import SettingsManager, AVAILABLE_MODELS
from src.intelligence.gemini_analyzer import get_available_gemini_models

router = APIRouter()


def _mask_key(key: Optional[str]) -> Optional[str]:
    if not key:
        return None
    if len(key) <= 8:
        return "***"
    return f"{key[:6]}...{key[-4:]}"


@router.get("", response_model=SettingsResponse, summary="Get current application and user settings")
def get_settings(user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    sm = SettingsManager()
    local_settings = sm.load()

    user_id = user["id"] if user else None
    client = get_supabase_client()

    db_settings = {}
    if client and user_id:
        try:
            res = client.table("user_settings").select("*").eq("user_id", user_id).limit(1).execute()
            if res.data:
                db_settings = res.data[0]
        except Exception:
            pass

    # Resolve active API key
    raw_api_key = (
        db_settings.get("gemini_api_key")
        or local_settings.ai.gemini_api_key
        or os.getenv("GEMINI_API_KEY")
    )

    gemini_model = (
        db_settings.get("gemini_model")
        or local_settings.ai.gemini_model
        or os.getenv("GEMINI_MODEL")
        or "gemini-3.5-flash"
    )

    available_models = get_available_gemini_models(raw_api_key)

    blacklist_title = (
        db_settings.get("blacklist_titles")
        or local_settings.blacklist_title
        or []
    )
    blacklist_companies = (
        db_settings.get("blacklist_companies")
        or local_settings.blacklist_companies
        or []
    )
    search_keywords = (
        db_settings.get("keywords")
        or local_settings.search.keywords
        or []
    )
    active_sources = sm.enabled_sources()

    roadmap_progress = (
        db_settings.get("roadmap_progress")
        or local_settings.roadmap_progress
        or {}
    )

    return SettingsResponse(
        gemini_api_key_masked=_mask_key(raw_api_key),
        gemini_model=gemini_model,
        available_models=available_models,
        blacklist_title=blacklist_title,
        blacklist_companies=blacklist_companies,
        search_keywords=search_keywords,
        active_sources=active_sources,
        max_jobs_per_source=local_settings.search.max_jobs_per_source,
        location=local_settings.search.location,
        remote_location=local_settings.search.remote_location,
        roadmap_progress=roadmap_progress,
    )


@router.post("", response_model=StandardMessageResponse, summary="Update user and application settings")
def update_settings(
    req: SettingsUpdateRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    sm = SettingsManager()
    local_settings = sm.load()

    # Update local settings
    if req.gemini_api_key is not None:
        local_settings.ai.gemini_api_key = req.gemini_api_key.strip() or None
    if req.gemini_model is not None:
        local_settings.ai.gemini_model = req.gemini_model.strip()
    if req.blacklist_title is not None:
        local_settings.blacklist_title = [t.strip() for t in req.blacklist_title if t.strip()]
    if req.blacklist_companies is not None:
        local_settings.blacklist_companies = [c.strip() for c in req.blacklist_companies if c.strip()]
    if req.search_keywords is not None:
        local_settings.search.keywords = [k.strip() for k in req.search_keywords if k.strip()]
    if req.max_jobs_per_source is not None:
        local_settings.search.max_jobs_per_source = req.max_jobs_per_source
    if req.location is not None:
        local_settings.search.location = req.location.strip()
    if req.remote_location is not None:
        local_settings.search.remote_location = req.remote_location.strip()
    if req.roadmap_progress is not None:
        local_settings.roadmap_progress = req.roadmap_progress

    sm.save(local_settings)

    # Sync to Supabase user_settings table if authenticated
    user_id = user["id"] if user else None
    client = get_supabase_client()
    if client and user_id:
        try:
            update_payload: Dict[str, Any] = {
                "user_id": user_id,
            }
            if req.gemini_api_key is not None:
                update_payload["gemini_api_key"] = req.gemini_api_key.strip() or None
            if req.gemini_model is not None:
                update_payload["gemini_model"] = req.gemini_model.strip()
            if req.blacklist_title is not None:
                update_payload["blacklist_titles"] = local_settings.blacklist_title
            if req.blacklist_companies is not None:
                update_payload["blacklist_companies"] = local_settings.blacklist_companies
            if req.search_keywords is not None:
                update_payload["keywords"] = local_settings.search.keywords
            if req.roadmap_progress is not None:
                update_payload["roadmap_progress"] = req.roadmap_progress

            client.table("user_settings").upsert(update_payload, on_conflict="user_id").execute()
        except Exception as e:
            # Continue even if Supabase sync fails
            pass

    return StandardMessageResponse(
        success=True,
        message="Настройките бяха обновени успешно!",
    )


@router.post("/verify-gemini", response_model=GeminiVerifyResponse, summary="Verify Google Gemini API Key")
def verify_gemini_key(req: GeminiVerifyRequest):
    key = req.api_key.strip()
    if not key:
        return GeminiVerifyResponse(
            valid=False,
            models=[],
            message="Моля, въведете API ключ.",
        )

    try:
        from google import genai
        client = genai.Client(api_key=key)
        extracted = []
        # Calling models.list() triggers network auth check
        for m in client.models.list():
            name = getattr(m, "name", "").replace("models/", "").strip()
            lower = name.lower()
            if any(k in lower for k in ["flash", "pro", "antigravity"]) and not any(k in lower for k in ["tts", "image", "embedding", "live", "transcribe", "robotics"]):
                extracted.append(name)

        if not extracted:
            extracted = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-pro"]

        preferred_order = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-pro", "antigravity-preview-latest"]
        final_list = [p for p in preferred_order if p in extracted]
        for m in sorted(extracted):
            if m not in final_list:
                final_list.append(m)

        return GeminiVerifyResponse(
            valid=True,
            models=final_list,
            message=f"Успешна верификация! Достъпни са {len(final_list)} Gemini модела.",
        )
    except Exception as e:
        err_msg = str(e)
        if "API_KEY_INVALID" in err_msg or "400" in err_msg:
            err_msg = "Невалиден Google Gemini API ключ. Моля, проверете ключа в Google AI Studio."
        return GeminiVerifyResponse(
            valid=False,
            models=[],
            message=f"Грешка: {err_msg}",
        )

