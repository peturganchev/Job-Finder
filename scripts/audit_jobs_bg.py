import os
import sys
import re
from collections import Counter
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from src.database.repository import get_repository

def audit():
    load_dotenv()
    repo = get_repository()

    print("🔍 Извличане на всички записи от public.jobs_bg за пълен одит...")
    # Fetch in pages of 1000 to get all rows
    all_rows = []
    page = 0
    page_size = 1000
    while True:
        res = repo.client.table("jobs_bg").select("id, job_id, url, title, company, location, description, category, skills, created_at").range(page * page_size, (page + 1) * page_size - 1).execute()
        data = res.data or []
        all_rows.extend(data)
        if len(data) < page_size:
            break
        page += 1

    total = len(all_rows)
    print(f"📦 Общо извлечени записи: {total}")

    # 1. Проверка за дублирани URL-и
    url_counts = Counter([r["url"] for r in all_rows if r.get("url")])
    dup_urls = {u: c for u, c in url_counts.items() if c > 1}

    # 2. Проверка за дублирани job_id
    id_counts = Counter([r["job_id"] for r in all_rows if r.get("job_id")])
    dup_ids = {i: c for i, c in id_counts.items() if c > 1}

    # 3. Проверка за дублирано съдържание (Заглавие + Компания)
    def normalize_text(text):
        if not text:
            return ""
        # Махаме препинателни знаци и празни пространства
        cleaned = re.sub(r'[^a-zA-Zа-яА-Я0-9]', '', text.lower())
        return cleaned

    content_map = {}
    for r in all_rows:
        t = normalize_text(r.get("title"))
        c = normalize_text(r.get("company"))
        key = (t, c)
        if key not in content_map:
            content_map[key] = []
        content_map[key].append(r)

    duplicates_by_content = {k: v for k, v in content_map.items() if len(v) > 1 and k[0]}

    print("\n" + "=" * 60)
    print("📋 1. АНАЛИЗ ЗА ДУБЛИКАТИ В БАЗАТА ДАННИ")
    print("=" * 60)
    print(f"• Точно еднакви URL адреси: {len(dup_urls)} (в таблицата има UNIQUE индекс върху url, така че 0 дублирани линка)")
    print(f"• Точно еднакви външни job_id: {len(dup_ids)}")
    print(f"• Позиции с еднакво (Заглавие + Фирма): {len(duplicates_by_content)} групи (общо {sum(len(v) for v in duplicates_by_content.values())} обяви)")

    if duplicates_by_content:
        print("\n🔎 Примери за повторени обяви (фирми, публикували една и съща обява многократно с различен URL/ID):")
        for (t, c), group in list(duplicates_by_content.items())[:6]:
            first = group[0]
            print(f"  • \"{first.get('title')}\" @ {first.get('company')}")
            print(f"    -> Среща се {len(group)} пъти в базата с различни URL-и (напр. {', '.join([g.get('job_id', '') for g in group[:3]])})")

    # 4. Анализ на текста, категориите и детайлите
    print("\n" + "=" * 60)
    print("📝 2. АНАЛИЗ НА СЪДЪРЖАНИЕТО (ТЕКСТ, ОПИСАНИЯ, КАТЕГОРИИ)")
    print("=" * 60)
    
    has_desc = sum(1 for r in all_rows if r.get("description") and len(r["description"].strip()) > 15)
    has_cat = sum(1 for r in all_rows if r.get("category"))
    has_skills = sum(1 for r in all_rows if r.get("skills") and len(r["skills"]) > 0)
    has_salary = sum(1 for r in all_rows if r.get("salary"))

    print(f"• Обяви с пълен/кратък текст и детайли: {has_desc}/{total} ({has_desc/total*100:.1f}%)")
    print(f"• Обяви с разпределена категория: {has_cat}/{total} ({has_cat/total*100:.1f}%)")
    print(f"• Обяви със структурирани умения (Skills tags): {has_skills}/{total} ({has_skills/total*100:.1f}%)")
    print(f"• Обяви с посочена заплата: {has_salary}/{total} ({has_salary/total*100:.1f}%)")

    # Примерни 4 записа за демонстрация
    print("\n🔬 Примерно съдържание на 4 реални записа от Supabase:")
    for i, r in enumerate(all_rows[:4]):
        print(f"\n--- [Запис #{i+1}] ---")
        print(f"  📌 Заглавие:   {r.get('title')}")
        print(f"  🏢 Компания:   {r.get('company')}")
        print(f"  📍 Локация:    {r.get('location')}")
        print(f"  🏷️ Категория:  {r.get('category')}")
        print(f"  🛠️ Умения:     {r.get('skills')}")
        desc = (r.get("description") or "").strip()
        print(f"  📄 Текст/Съмъри ({len(desc)} символа):")
        print(f"     \"{desc[:220]}...\"")

if __name__ == "__main__":
    audit()
