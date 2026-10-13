"""
Utility to ingest exported jobs from browser JSON into Supabase jobs_bg.
"""
import os
import sys
import json
import glob
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from src.database.repository import get_repository
from src.scrapers.email_digest_parser import classify_job_rule_based

def ingest_json(file_path: str = None):
    load_dotenv()
    repo = get_repository()

    if not file_path:
        # Check Downloads or data/ specifically for jobs_bg
        candidates = glob.glob("data/jobs_bg*.json") + glob.glob(os.path.expanduser("~/Downloads/jobs_bg*.json"))
        if not candidates:
            print("ℹ️ Няма намерен JSON файл за импортиране (очаква се файл от тип jobs_bg_*.json).")
            return
        file_path = candidates[-1]

    print(f"📄 Зареждане на файл: {file_path}")
    with open(file_path, "r", encoding="utf-8") as f:
        jobs = json.load(f)

    if not isinstance(jobs, list):
        print("❌ JSON файлът не съдържа списък от обяви.")
        return

    print(f"📦 Намерени {len(jobs)} обяви. Класифициране с 0 токена...")
    for j in jobs:
        if not j.get("category"):
            j["category"] = classify_job_rule_based(j.get("title", ""), j.get("description", ""), j.get("skills", []))
        j["is_active"] = True

    print("💾 Записване в Supabase public.jobs_bg...")
    saved = repo.upsert_jobs_bg(jobs)
    print(f"🎉 Успешно записани/актуализирани {saved} позиции в Supabase!")

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else None
    ingest_json(path)
