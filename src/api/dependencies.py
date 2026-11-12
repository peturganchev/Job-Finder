"""
FastAPI Dependencies for Job-Finder v2.
Handles Supabase JWT validation, user context extraction, and repository injection.
"""
import hmac
import os
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, Depends, status
from src.database.repository import get_repository
from src.intelligence.gemini_analyzer import GeminiJobAnalyzer

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = None


def get_supabase_client() -> Optional[Any]:
    """Returns a Supabase client if URL and Anon/Service key are set."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
    if url and key and create_client:
        try:
            return create_client(url, key)
        except Exception as e:
            print(f"⚠️ Error initializing Supabase client: {e}")
    return None


def get_service_role_client() -> Optional[Any]:
    """Returns a privileged Supabase client using service role key if available."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if url and key and create_client:
        try:
            return create_client(url, key)
        except Exception as e:
            print(f"⚠️ Error initializing Supabase service client: {e}")
    return None


async def get_current_user_optional(
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Optional[Dict[str, Any]]:
    """
    Extracts user details from Supabase Bearer JWT.
    Returns None if no valid authentication is provided.
    """
    access_token = None
    if authorization:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            access_token = parts[1]
        elif len(parts) == 1:
            access_token = parts[0]

    if access_token:
        client = get_supabase_client()
        if client:
            try:
                user_resp = client.auth.get_user(access_token)
                if user_resp and user_resp.user:
                    u = user_resp.user
                    return {
                        "id": str(u.id),
                        "email": getattr(u, "email", None),
                        "access_token": access_token
                    }
            except Exception as e:
                print(f"⚠️ JWT verification failed: {e}")

    return None


async def get_current_user_required(
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
) -> Dict[str, Any]:
    """Requires an authenticated user, raises HTTP 401 otherwise."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer JWT in the Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def verify_ingest_secret(
    x_ingest_secret: Optional[str] = Header(None, alias="X-Ingest-Secret"),
) -> bool:
    """Validates shared ingest secret for passive webhook endpoints."""
    expected = os.getenv("INGEST_SECRET")
    if not expected or not x_ingest_secret or not hmac.compare_digest(x_ingest_secret, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing ingest secret.",
        )
    return True


def get_repo(
    user: Dict[str, Any] = Depends(get_current_user_required)
):
    """
    Injects Job Repository configured for the current authenticated user.
    """
    return get_repository(user_id=user["id"], access_token=user.get("access_token"))


def get_analyzer(
    user: Dict[str, Any] = Depends(get_current_user_required)
) -> GeminiJobAnalyzer:
    """
    Injects configured GeminiJobAnalyzer with user-specific keys and profile.
    """
    user_id = user["id"]
    access_token = user.get("access_token")

    user_key = None
    user_model = None
    user_profile = None

    if user_id:
        client = get_supabase_client()
        if client:
            try:
                if access_token:
                    client.postgrest.auth(access_token)
                res = client.table("user_settings").select("*").eq("user_id", str(user_id)).limit(1).execute()
                if res.data:
                    settings_row = res.data[0]
                    user_key = settings_row.get("gemini_api_key")
                    user_model = settings_row.get("gemini_model")
                    user_profile = settings_row.get("profile_data")
            except Exception as e:
                print(f"⚠️ Error fetching user settings for Gemini: {e}")

    return GeminiJobAnalyzer(
        api_key=user_key,
        model_name=user_model,
        profile_data=user_profile,
        use_local_fallback=False,
    )
