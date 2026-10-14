"""
Waitlist & Access Request Router for Job-Finder v2.
Handles waitlist review, approval notifications, invite links, and registration whitelisting.
"""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr

from src.api.dependencies import get_current_user_optional, get_supabase_client

router = APIRouter()

ADMIN_EMAILS = ["peturganchev93@gmail.com"]


class WaitlistActionRequest(BaseModel):
    id: str
    email: Optional[str] = None
    full_name: Optional[str] = None


class WaitlistResponse(BaseModel):
    success: bool
    message: str
    invite_url: Optional[str] = None
    email_sent: bool = False


class WhitelistCheckResponse(BaseModel):
    allowed: bool
    status: str
    message: str


def _send_approval_email(email: str, full_name: str, invite_url: str) -> bool:
    """Attempts to send an approval email via SMTP if configured in environment."""
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM") or smtp_user or "no-reply@archevyn.dev"

    if not (smtp_host and smtp_user and smtp_password):
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "🎉 Вашият достъп до Job-Finder v2 е одобрен!"
        msg["From"] = f"Job-Finder AI <{sender}>"
        msg["To"] = email

        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #090d16; color: #f1f5f9; padding: 24px;">
            <div style="max-width: 540px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; text-align: center;">
              <h2 style="color: #10b981; margin-bottom: 12px;">Поздравления, {full_name or 'Колега'}!</h2>
              <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
                Вашата заявка за ранен достъп до <strong>Job-Finder v2</strong> беше одобрена.
              </p>
              <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 24px;">
                Кликнете на бутона по-долу, за да създадете своята парола и да активирате профила си.
              </p>
              <a href="{invite_url}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #14b8a6); color: #022c22; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 14px;">
                Завърши регистрацията →
              </a>
              <p style="color: #64748b; font-size: 11px; margin-top: 24px;">
                Или отворете директно следния линк в браузъра:<br>
                <a href="{invite_url}" style="color: #38bdf8;">{invite_url}</a>
              </p>
            </div>
          </body>
        </html>
        """
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"⚠️ Грешка при изпращане на имейл: {e}")
        return False


@router.get("/requests", summary="List all waitlist requests (Admin only)")
def list_waitlist_requests(
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """Returns all access requests. Restricted to administrators."""
    client = get_supabase_client()
    if not client:
        raise HTTPException(status_code=500, detail="Database not configured")

    user_email = user.get("email", "").lower() if user else ""
    if user_email not in ADMIN_EMAILS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to platform administrators."
        )

    try:
        res = client.table("access_requests").select("*").order("created_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading requests: {e}")


@router.post("/approve", response_model=WaitlistResponse, summary="Approve waitlist candidate")
def approve_request(
    payload: WaitlistActionRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """
    Approves candidate, updates DB status, generates invitation link,
    and optionally sends an email if SMTP is configured.
    """
    client = get_supabase_client()
    if not client:
        raise HTTPException(status_code=500, detail="Database not configured")

    user_email = user.get("email", "").lower() if user else ""
    if user_email not in ADMIN_EMAILS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to platform administrators."
        )

    # 1. Update status to approved
    try:
        update_res = client.table("access_requests").update({
            "status": "approved",
            "updated_at": datetime.now().isoformat()
        }).eq("id", payload.id).execute()

        # If email was not passed in payload, fetch from DB
        target_email = payload.email
        target_name = payload.full_name or ""
        if (not target_email) and update_res.data:
            target_email = update_res.data[0].get("email")
            target_name = update_res.data[0].get("full_name") or target_name

        if not target_email:
            # Query row
            row_res = client.table("access_requests").select("email, full_name").eq("id", payload.id).limit(1).execute()
            if row_res.data:
                target_email = row_res.data[0].get("email")
                target_name = row_res.data[0].get("full_name") or target_name
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database update failed: {e}")

    if not target_email:
        raise HTTPException(status_code=404, detail="Request not found or has no email")

    # 2. Build invite URL
    invite_url = f"https://job-finder.archevyn.dev/#register?email={target_email}"

    # 3. Send email if possible
    email_sent = _send_approval_email(target_email, target_name, invite_url)

    return WaitlistResponse(
        success=True,
        message=f"Кандидатът {target_email} беше успешно одобрен." + (" Имейлът е изпратен." if email_sent else " Копирайте линка с поканата."),
        invite_url=invite_url,
        email_sent=email_sent
    )


@router.post("/reject", response_model=WaitlistResponse, summary="Reject waitlist candidate")
def reject_request(
    payload: WaitlistActionRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """Rejects waitlist applicant."""
    client = get_supabase_client()
    if not client:
        raise HTTPException(status_code=500, detail="Database not configured")

    user_email = user.get("email", "").lower() if user else ""
    if user_email not in ADMIN_EMAILS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to platform administrators."
        )

    try:
        client.table("access_requests").update({
            "status": "rejected",
            "updated_at": datetime.now().isoformat()
        }).eq("id", payload.id).execute()
        return WaitlistResponse(
            success=True,
            message="Заявката беше отказана.",
            invite_url=None,
            email_sent=False
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database update failed: {e}")


@router.get("/check/{email}", response_model=WhitelistCheckResponse, summary="Check if email is whitelisted for signup")
def check_whitelist(email: str):
    """
    Public check before registration to verify that the user was approved in the waitlist.
    """
    clean_email = email.strip().lower()

    # Admin is always allowed
    if clean_email in ADMIN_EMAILS:
        return WhitelistCheckResponse(
            allowed=True,
            status="approved",
            message="Администраторски акаунт."
        )

    client = get_supabase_client()
    if not client:
        # Fallback to allowed if database cannot be reached
        return WhitelistCheckResponse(
            allowed=True,
            status="approved",
            message="Проверката премина успешно."
        )

    try:
        res = client.table("access_requests").select("status").eq("email", clean_email).limit(1).execute()
        if not res.data:
            return WhitelistCheckResponse(
                allowed=False,
                status="not_found",
                message="Този имейл не е намерен в списъка с чакащи. Моля, първо заявете достъп."
            )

        st = res.data[0].get("status")
        if st == "approved":
            return WhitelistCheckResponse(
                allowed=True,
                status="approved",
                message="Вашият достъп е одобрен!"
            )
        elif st == "rejected":
            return WhitelistCheckResponse(
                allowed=False,
                status="rejected",
                message="Заявката за този имейл е отказана от администратора."
            )
        else:
            return WhitelistCheckResponse(
                allowed=False,
                status="pending",
                message="Вашата заявка все още се преглежда от екипа. Ще получите известие, когато бъдете одобрен."
            )
    except Exception as e:
        print(f"⚠️ Грешка при проверка на whitelist: {e}")
        # Graceful fallback: allow signup if table is unavailable
        return WhitelistCheckResponse(
            allowed=True,
            status="approved",
            message="Проверката премина успешно."
        )
