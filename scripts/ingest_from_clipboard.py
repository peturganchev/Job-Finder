"""
Ingest jobs directly from Windows clipboard into Supabase jobs_bg.
"""
import os
import sys
import json
import subprocess
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from src.database.repository import get_repository
from src.scrapers.email_digest_parser import classify_job_rule_based

def ingest_from_clipboard():
    load_dotenv()
    repo = get_repository()

    print("📋 Четене на данни от Windows Clipboard...")
    ps_cmd = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Clipboard"
    proc = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True, encoding="utf-8")
    clip_text = proc.stdout.strip()

    if not clip_text or not clip_text.startswith("["):
        print(f"❌ В Clipboard няма валиден JSON списък от обяви. (Дължина: {len(clip_text)})")
        return False

    try:
        jobs = json.loads(clip_text)
    except Exception as e:
        print(f"❌ Грешка при парсване на JSON от клипборда: {e}")
        return False

    print(f"📦 Намерени {len(jobs)} позиции в клипборда! Започвам обработка...")
    os.makedirs("data", exist_ok=True)
    with open("data/jobs_bg_clipboard_backup.json", "w", encoding="utf-8") as f:
        json.dump(jobs, f, indent=2, ensure_ascii=False)

    for j in jobs:
        if not j.get("category"):
            j["category"] = classify_job_rule_based(j.get("title", ""), j.get("description", ""), j.get("skills", []))
        j["is_active"] = True

    print("💾 Записване в Supabase public.jobs_bg...")
    saved = repo.upsert_jobs_bg(jobs)
    print(f"🎉 УСПЕХ! Записани/актуализирани {saved} позиции в Supabase с 0 токена!")

    from collections import Counter
    c = Counter([j.get("category", "N/A") for j in jobs])
    print("\n📊 Разпределение по категории:")
    for cat, cnt in c.most_common():
        print(f"  • {cat}: {cnt}")
    return True

if __name__ == "__main__":
    ingest_from_clipboard()
