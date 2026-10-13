"""
clean_jobs_bg_titles.py
-----------------------
Clean and normalize job titles and categories in public.jobs_bg across all records.
"""
import os
import sys
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from src.scrapers.email_digest_parser import classify_job_rule_based

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing SUPABASE_URL or SUPABASE_KEY")
    exit(1)

thread_local = threading.local()

def get_client():
    if not hasattr(thread_local, "client"):
        thread_local.client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return thread_local.client

def clean_title_text(raw: str) -> str:
    if not raw:
        return ""
    lines = [line.strip() for line in raw.split("\n") if line.strip()]
    if not lines:
        return raw.strip()
    
    clean_lines = []
    icon_words = {"star", "language", "location_on", "phone", "home", "chair", "3p", "public"}
    for l in lines:
        words = l.split()
        if len(words) == 1 and words[0].lower() in icon_words:
            continue
        clean_lines.append(l)
        
    candidate = clean_lines[0] if clean_lines else lines[0]
    candidate = re.sub(r'^(?:star\s*)+', '', candidate, flags=re.IGNORECASE)
    candidate = re.sub(r'^(?:language\s*)+', '', candidate, flags=re.IGNORECASE)
    candidate = re.sub(r'^(?:location_on\s*)+', '', candidate, flags=re.IGNORECASE)
    
    # Remove trailing city if merged
    candidate = re.split(r'\s+(?:София|Пловдив|Варна|Бургас)\b', candidate)[0]
    candidate = candidate.split(";")[0].strip()
    return ' '.join(candidate.split())

def update_single_job(row):
    jid = row["id"]
    old_title = row.get("title") or ""
    old_cat = row.get("category") or ""
    description = row.get("description") or ""
    
    new_title = clean_title_text(old_title)
    
    # Re-evaluate category if title changed or old category was Other/empty
    new_cat = old_cat
    if (new_title != old_title) or (old_cat in ["Other", "", None]):
        calculated_cat = classify_job_rule_based(new_title, description)
        if calculated_cat:
            new_cat = calculated_cat

    updates = {}
    if new_title and new_title != old_title:
        updates["title"] = new_title
    if new_cat and new_cat != old_cat:
        updates["category"] = new_cat
        
    if updates:
        client = get_client()
        client.table("jobs_bg").update(updates).eq("id", jid).execute()
        return True
    return False

def run_cleanup():
    main_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("🧹 Започвам пълно почистване и нормализиране на заглавията и категориите в jobs_bg...", flush=True)
    
    offset = 0
    batch_size = 1000
    all_rows = []
    
    while True:
        res = main_client.table("jobs_bg").select("id, title, category, description").range(offset, offset + batch_size - 1).execute()
        data = res.data or []
        all_rows.extend(data)
        if len(data) < batch_size:
            break
        offset += batch_size
        
    print(f"📦 Общо позиции за проверка: {len(all_rows)}", flush=True)
    
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(update_single_job, all_rows))
        updated_count = sum(1 for r in results if r)
        
    print(f"🎉 Почистването завърши успешно! Обновени {updated_count} от {len(all_rows)} позиции.", flush=True)

if __name__ == "__main__":
    run_cleanup()
