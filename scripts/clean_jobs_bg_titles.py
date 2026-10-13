"""
Clean and normalize job titles and companies in public.jobs_bg.
"""
import os
import sys
import re
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from src.database.repository import get_repository

def clean_title_text(raw: str) -> str:
    if not raw:
        return ""
    # Split by newlines
    lines = [line.strip() for line in raw.split("\n") if line.strip()]
    if not lines:
        return raw.strip()
    
    # Filter out icon words
    clean_lines = []
    icon_words = {"star", "language", "location_on", "phone", "home", "chair", "3p", "public"}
    for l in lines:
        words = l.split()
        if len(words) == 1 and words[0].lower() in icon_words:
            continue
        clean_lines.append(l)
        
    candidate = clean_lines[0] if clean_lines else lines[0]
    # Remove leading repeat icons
    candidate = re.sub(r'^(?:star\s*)+', '', candidate, flags=re.IGNORECASE)
    candidate = re.sub(r'^(?:language\s*)+', '', candidate, flags=re.IGNORECASE)
    candidate = re.sub(r'^(?:location_on\s*)+', '', candidate, flags=re.IGNORECASE)
    
    # Remove trailing city if merged
    candidate = re.split(r'\s+(?:София|Пловдив|Варна|Бургас)\b', candidate)[0]
    candidate = candidate.split(";")[0].strip()
    return ' '.join(candidate.split())

def run_cleanup():
    load_dotenv()
    repo = get_repository()
    print("🧹 Започвам почистване и нормализиране на заглавията в jobs_bg...")
    
    res = repo.client.table("jobs_bg").select("id, title").execute()
    rows = res.data or []
    print(f"📦 Общо позиции за проверка: {len(rows)}")
    
    updates = []
    for r in rows:
        old_title = r.get("title", "")
        new_title = clean_title_text(old_title)
        if new_title and new_title != old_title:
            updates.append({"id": r["id"], "title": new_title})
            
    print(f"🔧 Намерени {len(updates)} заглавия за обновяване...")
    batch_size = 100
    for i in range(0, len(updates), batch_size):
        batch = updates[i:i + batch_size]
        for item in batch:
            repo.client.table("jobs_bg").update({"title": item["title"]}).eq("id", item["id"]).execute()
        print(f"   ✅ Обновени {min(i + batch_size, len(updates))}/{len(updates)}")
        
    print("🎉 Почистването завърши успешно!")

if __name__ == "__main__":
    run_cleanup()
