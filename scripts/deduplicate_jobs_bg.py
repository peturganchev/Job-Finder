"""
Safe deduplication script for public.jobs_bg.
Finds duplicate records with the same Title, Company, and Location,
keeps the most recent/richest record, and safely deletes the older redundant copies.
"""
import os
import sys
import re
from collections import defaultdict
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from src.database.repository import get_repository

def normalize(text: str) -> str:
    if not text:
        return ""
    return re.sub(r'[^a-zA-Zа-яА-Я0-9]', '', text.lower())

def run_deduplication():
    load_dotenv()
    repo = get_repository()

    print("🔍 Извличане на всички записи от jobs_bg за дедупликация...")
    all_rows = []
    page = 0
    page_size = 1000
    while True:
        res = repo.client.table("jobs_bg").select("id, job_id, url, title, company, location, description, category, skills, created_at, last_seen_at").range(page * page_size, (page + 1) * page_size - 1).execute()
        data = res.data or []
        all_rows.extend(data)
        if len(data) < page_size:
            break
        page += 1

    total_initial = len(all_rows)
    print(f"📦 Общо налични записи преди дедупликация: {total_initial}")

    # Групиране по (Заглавие, Фирма, Локация)
    groups = defaultdict(list)
    for r in all_rows:
        t = normalize(r.get("title"))
        c = normalize(r.get("company"))
        l = normalize(r.get("location"))
        if not t:
            continue
        key = (t, c, l)
        groups[key].append(r)

    ids_to_delete = []
    duplicate_groups_count = 0

    for key, items in groups.items():
        if len(items) > 1:
            duplicate_groups_count += 1
            # Сортираме: първо по дължина на описанието (богатство на данните), след това по последно виждане (най-новото)
            items_sorted = sorted(
                items,
                key=lambda x: (
                    len(x.get("skills") or []),
                    len(x.get("description") or ""),
                    x.get("last_seen_at") or x.get("created_at") or ""
                ),
                reverse=True
            )
            # Запазваме items_sorted[0] като най-доброто копие
            keep_record = items_sorted[0]
            # Всички останали отиват за изтриване
            to_remove = items_sorted[1:]
            for r in to_remove:
                ids_to_delete.append(r["id"])

    print(f"\n📊 Намерени дублирани групи: {duplicate_groups_count}")
    print(f"🗑️ Общ брой стари дубликати за изтриване: {len(ids_to_delete)}")

    if not ids_to_delete:
        print("✅ Няма дубликати за изтриване!")
        return

    # Маркираме като неактивни (is_active = False) и правим опит за изтриване
    print("⏳ Деактивиране и изчистване на дубликатите в Supabase...")
    batch_size = 100
    deactivated_count = 0
    for i in range(0, len(ids_to_delete), batch_size):
        batch = ids_to_delete[i:i + batch_size]
        # 1. Update is_active = False (гарантирано разрешено от RLS)
        repo.client.table("jobs_bg").update({"is_active": False}).in_("id", batch).execute()
        # 2. Опит за физическо изтриване ако има DELETE RLS policy
        try:
            repo.client.table("jobs_bg").delete().in_("id", batch).execute()
        except Exception:
            pass
        deactivated_count += len(batch)
        print(f"   • Деактивирани/премахнати {deactivated_count}/{len(ids_to_delete)}...")

    # Финална проверка на активния брой
    active_res = repo.client.table("jobs_bg").select("id", count="exact").eq("is_active", True).execute()
    active_count = active_res.count if hasattr(active_res, "count") and active_res.count is not None else len(active_res.data or [])
    
    print("\n" + "=" * 60)
    print("🎉 ДЕДУПЛИКАЦИЯТА ЗАВЪРШИ УСПЕШНО!")
    print(f"• Начален брой записи: {total_initial}")
    print(f"• Деактивирани/премахнати дубликати: {deactivated_count}")
    print(f"• Активни уникални позиции в търсачката: {active_count}")
    print("=" * 60)

if __name__ == "__main__":
    run_deduplication()
