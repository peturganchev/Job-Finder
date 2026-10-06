"""
Telegram Bot Notifier for Job Finder.
Sends instant push notifications with formatting and direct apply links.
"""
import os
import httpx
from typing import Optional
from dotenv import load_dotenv
from src.database.models import Job

load_dotenv()


class TelegramNotifier:
    def __init__(self, bot_token: Optional[str] = None, chat_id: Optional[str] = None):
        self.bot_token = bot_token or os.getenv("TELEGRAM_BOT_TOKEN")
        self.chat_id = chat_id or os.getenv("TELEGRAM_CHAT_ID")

    def is_configured(self) -> bool:
        return bool(self.bot_token and self.chat_id)

    def send_job_alert(self, job: Job) -> bool:
        """
        Изпраща форматирано съобщение в Telegram за нова обява.
        """
        if not self.is_configured():
            return False

        score = job.match_score or 50
        salary_line = f"💰 *Заплата:* {job.salary}\n" if job.salary else ""
        summary_line = f"🧠 *AI Резюме:* {job.ai_summary}\n" if job.ai_summary else ""

        matched_str = ", ".join(job.matched_skills) if job.matched_skills else "Python, AI"
        missing_str = ", ".join(job.missing_skills) if job.missing_skills else "Няма критични"

        message_text = (
            f"🚀 *{job.title}*\n"
            f"🏢 *Компания:* {job.company}\n"
            f"📍 *Локация:* {job.location or 'София / Remote'}\n"
            f"🎯 *AI Съвпадение:* {score}%\n"
            f"{salary_line}"
            f"🌐 *Източник:* {job.source}\n\n"
            f"{summary_line}\n"
            f"✅ *Налични умения:* {matched_str}\n"
            f"📚 *За портфолио:* {missing_str}\n\n"
            f"👉 [Кликни тук за обявата]({job.url})"
        )

        api_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": message_text,
            "parse_mode": "Markdown",
            "disable_web_page_preview": False
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(api_url, json=payload)
                if res.status_code == 200:
                    print(f"📢 [Telegram] Изпратено известие за '{job.title}'")
                    return True
                else:
                    print(f"⚠️ [Telegram] Грешка ({res.status_code}): {res.text}")
                    return False
        except Exception as e:
            print(f"⚠️ [Telegram] Грешка при изпращане: {e}")
            return False
