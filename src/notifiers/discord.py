"""
Discord Webhook Notifier for Job Finder.
Sends rich embed notifications directly to the user's private Discord channel.
"""
import os
import httpx
from typing import Optional
from dotenv import load_dotenv
from src.database.models import Job

load_dotenv()


class DiscordNotifier:
    def __init__(self, webhook_url: Optional[str] = None):
        self.webhook_url = webhook_url or os.getenv("DISCORD_WEBHOOK_URL")

    def is_configured(self) -> bool:
        return bool(self.webhook_url and self.webhook_url.startswith("https://discord.com/api/webhooks/"))

    def send_job_alert(self, job: Job) -> bool:
        """
        Изпраща красиво форматирано Rich Embed съобщение за нова обява в Discord.
        """
        if not self.is_configured():
            return False

        score = job.match_score or 50

        # Цвят на ембеда според съвпадението
        if score >= 80:
            color = 0x2ECC71  # Зелен (много висок мач)
        elif score >= 65:
            color = 0xF1C40F  # Златен / жълт (добър мач)
        else:
            color = 0x3498DB  # Син (стандартен)

        matched_str = ", ".join(job.matched_skills) if job.matched_skills else "Python, AI"
        missing_str = ", ".join(job.missing_skills) if job.missing_skills else "Няма критични"

        fields = [
            {"name": "🎯 AI Съвпадение", "value": f"**{score}%**", "inline": True},
            {"name": "📍 Локация", "value": job.location or "София / Remote", "inline": True},
            {"name": "🌐 Източник", "value": f"`{job.source}`", "inline": True},
        ]

        if job.salary:
            fields.append({"name": "💰 Заплата", "value": f"**{job.salary}**", "inline": True})

        if job.ai_summary:
            fields.append({"name": "🧠 AI Резюме на позицията", "value": job.ai_summary[:500], "inline": False})

        fields.append({"name": "✅ Налични умения", "value": matched_str[:250], "inline": False})

        if job.missing_skills:
            fields.append({"name": "📚 Умения за добавяне към портфолиото", "value": missing_str[:250], "inline": False})

        embed = {
            "title": f"🚀 {job.title} @ {job.company}",
            "url": job.url,
            "description": f"Намерена е нова релевантна позиция! [Кликни тук за преглед и кандидатстване]({job.url})",
            "color": color,
            "fields": fields,
            "footer": {
                "text": "Job Finder • Agentic AI Assistant"
            }
        }

        payload = {
            "username": "Job Finder AI",
            "avatar_url": "https://cdn-icons-png.flaticon.com/512/8649/8649607.png",
            "embeds": [embed]
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(self.webhook_url, json=payload)
                if res.status_code in (200, 204):
                    print(f"📢 [Discord] Изпратено известие за '{job.title}'")
                    return True
                else:
                    print(f"⚠️ [Discord] Грешка ({res.status_code}): {res.text}")
                    return False
        except Exception as e:
            print(f"⚠️ [Discord] Грешка при изпращане: {e}")
            return False
