"""
clean_jobs_bg_descriptions.py
-----------------------------
Clean up raw DOM artifacts (such as 'star', 'language', 'business', multiple empty lines)
from job descriptions / card summaries in public.jobs_bg to make them clean, human-readable snippets.
"""

import os
import sys
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing SUPABASE_URL or SUPABASE_KEY", flush=True)
    exit(1)

thread_local = threading.local()

def get_client():
    if not hasattr(thread_local, "client"):
        thread_local.client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return thread_local.client

ICONS = [
    r'\bstar\b',
    r'\blanguage\b',
    r'\blocation_on\b',
    r'\bbusiness\b',
    r'\bschedule\b',
    r'\bwork\b',
    r'\beuro\b',
    r'\bpayments\b',
    r'\bcheck_circle\b',
    r'\bvisibility\b',
]

def clean_description(desc: str) -> str:
    if not desc:
        return ""
    
    text = desc
    for pat in ICONS:
        text = re.sub(pat, '', text, flags=re.IGNORECASE)
    
    # Split into lines and strip
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Deduplicate adjacent identical lines if any
    deduped_lines = []
    for l in lines:
        if not deduped_lines or deduped_lines[-1] != l:
            deduped_lines.append(l)
            
    return "\n".join(deduped_lines)

def update_single_job(job):
    jid = job["id"]
    orig_desc = job.get("description") or ""
    cleaned = clean_description(orig_desc)
    if cleaned != orig_desc:
        client = get_client()
        client.table("jobs_bg").update({"description": cleaned}).eq("id", jid).execute()
        return True
    return False

def main():
    main_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("🧹 Fetching all active jobs from public.jobs_bg...", flush=True)
    
    offset = 0
    batch_size = 1000
    all_jobs = []
    
    while True:
        resp = main_client.table("jobs_bg").select("id, description").eq("is_active", True).range(offset, offset + batch_size - 1).execute()
        data = resp.data or []
        all_jobs.extend(data)
        if len(data) < batch_size:
            break
        offset += batch_size
        
    print(f"📊 Total active jobs retrieved: {len(all_jobs)}", flush=True)
    
    cleaned_count = 0
    with ThreadPoolExecutor(max_workers=6) as executor:
        results = list(executor.map(update_single_job, all_jobs))
        cleaned_count = sum(1 for r in results if r)
                
    print(f"✅ Finished! Cleaned {cleaned_count} job summaries out of {len(all_jobs)}.", flush=True)

if __name__ == "__main__":
    main()
