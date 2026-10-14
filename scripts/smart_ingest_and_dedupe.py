"""
smart_ingest_and_dedupe.py
--------------------------
Reads jobs from Windows Clipboard (e.g. from Jobs.bg browser scraper),
normalizes titles and descriptions, cleans artifacts, performs strict
pre-ingestion and post-ingestion deduplication, categorizes via rule-based NLP (0 tokens),
and stores clean, unique positions in Supabase public.jobs_bg.
"""

import os
import sys
import json
import re
import subprocess
from datetime import datetime
from collections import Counter
from dotenv import load_dotenv
from supabase import create_client

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from src.scrapers.email_digest_parser import classify_job_rule_based
from scripts.clean_jobs_bg_titles import clean_title_text
from scripts.clean_jobs_bg_descriptions import clean_description

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing SUPABASE_URL or SUPABASE_KEY", flush=True)
    exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_all_existing_jobs():
    """Fetch all existing jobs from public.jobs_bg with pagination."""
    print("📥 Извличане на съществуващи обяви от Supabase за сравнение...", flush=True)
    offset = 0
    batch_size = 1000
    all_jobs = []
    while True:
        res = sb.table("jobs_bg").select("id, job_id, url, title, company, location, is_active").range(offset, offset + batch_size - 1).execute()
        data = res.data or []
        all_jobs.extend(data)
        if len(data) < batch_size:
            break
        offset += batch_size
    print(f"📦 Общо съществуващи записи в Supabase: {len(all_jobs)}", flush=True)
    return all_jobs

def run():
    print("📋 Четене на данни от Windows Clipboard...", flush=True)
    ps_cmd = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Clipboard"
    proc = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True, encoding="utf-8")
    clip_text = proc.stdout.strip()

    if not clip_text or not clip_text.startswith("["):
        print(f"❌ В Clipboard няма валиден JSON списък от обяви. (Дължина: {len(clip_text)})", flush=True)
        return

    try:
        raw_jobs = json.loads(clip_text)
    except Exception as e:
        print(f"❌ Грешка при парсване на JSON от клипборда: {e}", flush=True)
        return

    total_raw = len(raw_jobs)
    print(f"🚀 Извлечени {total_raw} позиции от клипборда!", flush=True)

    # 1. Backup raw clipboard data
    os.makedirs("data", exist_ok=True)
    backup_file = f"data/jobs_bg_clipboard_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(raw_jobs, f, indent=2, ensure_ascii=False)
    print(f"💾 Резервно копие запазено в {backup_file}", flush=True)

    # 2. Existing records from Supabase
    existing_records = get_all_existing_jobs()
    existing_urls = {r["url"]: r for r in existing_records if r.get("url")}
    existing_sigs = {}
    for r in existing_records:
        t = clean_title_text(r.get("title", "")).lower()
        c = (r.get("company") or "").strip().lower()
        l = (r.get("location") or "").strip().lower()
        if (t, c, l) not in existing_sigs:
            existing_sigs[(t, c, l)] = r

    # 3. Clean and deduplicate within clipboard batch
    print("\n🧹 Почистване на заглавия, описания и филтриране на вътрешни дубликати...", flush=True)
    unique_candidates = {}
    duplicate_in_batch = 0

    for item in raw_jobs:
        raw_title = item.get("title") or ""
        raw_desc = item.get("description") or ""
        clean_t = clean_title_text(raw_title)
        clean_d = clean_description(raw_desc)
        comp = (item.get("company") or "Работодател").strip()
        loc = (item.get("location") or "София").strip()
        url = item.get("url") or ""

        if not clean_t or not url:
            continue

        sig = (clean_t.lower(), comp.lower(), loc.lower())

        # If duplicate in the current batch, keep the richest one
        if sig in unique_candidates:
            duplicate_in_batch += 1
            # If current item has richer description, replace
            if len(clean_d) > len(unique_candidates[sig].get("description", "")):
                item["title"] = clean_t
                item["description"] = clean_d
                item["company"] = comp
                item["location"] = loc
                unique_candidates[sig] = item
        else:
            item["title"] = clean_t
            item["description"] = clean_d
            item["company"] = comp
            item["location"] = loc
            unique_candidates[sig] = item

    print(f"  • Намерени вътрешни дубликати в партидата: {duplicate_in_batch} (премахнати)")
    print(f"  • Уникални позиции за качване/обновяване: {len(unique_candidates)}")

    # 4. Classify and prepare records for upsert
    print("\n🏷️ Категоризиране с локален Rule-Based NLP (0 токена)...", flush=True)
    now_iso = datetime.now().isoformat()
    jobs_to_upsert = []
    reposts_to_deactivate = []

    for sig, item in unique_candidates.items():
        title = item["title"]
        desc = item["description"]
        skills = item.get("skills") or []
        url = item["url"]

        category = classify_job_rule_based(title, desc, skills)

        # Check if this is a repost of an existing job with different URL
        if sig in existing_sigs and url != existing_sigs[sig].get("url"):
            # Deactivate older duplicate record in DB
            reposts_to_deactivate.append(existing_sigs[sig]["id"])

        payload = {
            "job_id": str(item.get("job_id", "")),
            "url": url,
            "title": title,
            "company": item.get("company", "Работодател"),
            "location": item.get("location", "София"),
            "salary": item.get("salary"),
            "description": desc,
            "skills": skills,
            "category": category,
            "posted_date": item.get("posted_date"),
            "is_active": True,
            "last_seen_at": now_iso,
            "updated_at": now_iso,
        }
        jobs_to_upsert.append(payload)

    # 5. Deactivate older reposted duplicates if any
    if reposts_to_deactivate:
        print(f"\n🔄 Деактивиране на {len(reposts_to_deactivate)} по-стари дублирани позиции...", flush=True)
        for i in range(0, len(reposts_to_deactivate), 100):
            batch_ids = reposts_to_deactivate[i:i + 100]
            sb.table("jobs_bg").update({"is_active": False, "updated_at": now_iso}).in_("id", batch_ids).execute()

    # 6. Bulk upsert in batches of 100
    print(f"\n📤 Качване на {len(jobs_to_upsert)} позиции в Supabase на пакети от 100...", flush=True)
    total_saved = 0
    batch_size = 100
    for i in range(0, len(jobs_to_upsert), batch_size):
        chunk = jobs_to_upsert[i:i + batch_size]
        try:
            res = sb.table("jobs_bg").upsert(chunk, on_conflict="url").execute()
            saved_count = len(res.data or [])
            total_saved += saved_count
            print(f"  -> Записани {min(i + batch_size, len(jobs_to_upsert))}/{len(jobs_to_upsert)} обяви...", flush=True)
        except Exception as e:
            print(f"⚠️ Грешка при upsert на пакет {i}: {e}", flush=True)

    # 7. Post-ingestion verification & final counts
    print("\n🔍 Финална проверка на активните обяви в базата данни...", flush=True)
    active_res = sb.table("jobs_bg").select("id", count="exact").eq("is_active", True).execute()
    inactive_res = sb.table("jobs_bg").select("id", count="exact").eq("is_active", False).execute()

    print("\n" + "="*50)
    print("🎉 ОБОБЩЕНИЕ НА ИМПОРТА & ДЕДУПЛИКАЦИЯТА:")
    print("="*50)
    print(f"  • Извлечени сурови обяви: {total_raw}")
    print(f"  • Премахнати дубликати преди импорт: {duplicate_in_batch}")
    print(f"  • По-стари дубликати маркирани като неактивни: {len(reposts_to_deactivate)}")
    print(f"  • Успешно записани/обновени: {total_saved}")
    print(f"  • ОБЩО АКТИВНИ УНИКАЛНИ ОБЯВИ В SUPABASE: {active_res.count}")
    print(f"  • Общо неактивни/дубликати: {inactive_res.count}")
    print(f"  • Изразходвани Gemini токени: 0 ⚡")
    print("="*50)

    # Category distribution of the active catalog
    cat_counts = Counter([j["category"] for j in jobs_to_upsert])
    print("\n📊 Разпределение на новите/обновените обяви по категории:")
    for cat, cnt in cat_counts.most_common():
        print(f"  • {cat}: {cnt}")

if __name__ == "__main__":
    run()
