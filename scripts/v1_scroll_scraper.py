"""
V1-Style Incremental Infinite-Scroll Scraper for Jobs.bg.
Extracts visible jobs on every scroll before DOM virtualization unmounts them,
with relaxed human delays, zero-token classification, and real-time upsert to Supabase.
"""
import os
import sys
import time
import json
import random
import argparse
from datetime import datetime
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from src.database.repository import get_repository
from src.browser import BrowserManager
from src.scrapers.email_digest_parser import classify_job_rule_based

CHECKPOINT_FILE = os.path.join("data", "v1_scroll_checkpoint.json")


def load_checkpoint() -> dict:
    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"total_saved": 0, "processed_urls": []}


def save_checkpoint(total_saved: int, processed_urls: list):
    os.makedirs(os.path.dirname(CHECKPOINT_FILE), exist_ok=True)
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "total_saved": total_saved,
            "processed_urls": processed_urls[-15000:],
            "updated_at": datetime.now().isoformat()
        }, f, indent=2, ensure_ascii=False)


def extract_visible_jobs(page, seen_urls: set) -> list:
    """Извлича обявите, които са налични в DOM дървото в текущия момент."""
    html = page.content()
    soup = BeautifulSoup(html, "html.parser")
    links = soup.select("a[href*='/job/'], a[href*='view_job.php']")
    new_jobs = []

    for link in links:
        href = link.get("href", "")
        if not href or href.startswith("#") or "javascript:" in href:
            continue
        if not href.startswith("http"):
            href = f"https://www.jobs.bg/{href.lstrip('/')}"

        if href in seen_urls:
            continue
        seen_urls.add(href)

        raw_title = link.get_text(strip=True)
        if not raw_title or len(raw_title) < 3:
            continue

        import re
        clean_title = re.sub(r'^(?:star)+', '', raw_title).strip()
        title = clean_title if len(clean_title) >= 3 else raw_title

        card = link.find_parent("td") or link.find_parent("div") or link.parent
        company = "Работодател"
        comp_elem = card.select_one("a[href*='company/']") if card else None
        if comp_elem:
            company = comp_elem.get_text(strip=True)

        location = "София"
        loc_text = card.get_text(" ", strip=True) if card else ""
        for city in ["София", "Пловдив", "Варна", "Бургас", "Русе", "Стара Загора"]:
            if city in loc_text:
                location = city
                break

        if any(r in loc_text.lower() for r in ["home office", "remote", "дистанционно", "от вкъщи"]):
            location += " (Remote / Хибридно)"

        job_id = href.rstrip("/").split("/")[-1]

        new_jobs.append({
            "job_id": job_id,
            "url": href,
            "title": title,
            "company": company,
            "location": location,
            "salary": None,
            "description": loc_text[:1000],
            "skills": [],
            "category": None,
            "is_active": True,
        })

    return new_jobs


def run_scroll_scraper(
    target_url: str = "https://www.jobs.bg/front_job_search.php?subm=1&location_sid=1",
    max_jobs: int = 200,
    min_delay: float = 2.5,
    max_delay: float = 4.5,
    headless: bool = False
):
    load_dotenv()
    repo = get_repository()
    checkpoint = load_checkpoint()
    total_saved = checkpoint.get("total_saved", 0)
    seen_urls = set(checkpoint.get("processed_urls", []))

    print("=" * 65)
    print("🚀 [Jobs.bg V1 Scroll Scraper] Стартиране на инкрементално скролване")
    print(f"🎯 URL: {target_url}")
    print(f"📊 Цел: {max_jobs} позиции | Досега в чекпойнта: {total_saved}")
    print(f"⏱️ Забавяне между скроловете: {min_delay}s - {max_delay}s (човешки интервал)")
    print("=" * 65)

    browser_mgr = BrowserManager(headless=headless)
    try:
        _pw, _ctx, page = browser_mgr.launch_session(headless=headless)
    except Exception as e:
        print(f"⚠️ Грешка при стартиране на браузъра: {e}")
        return

    try:
        print(f"\n🌐 Зареждане на началната страница...")
        page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
        time.sleep(3.0)

        collected_this_run = 0
        scroll_count = 0
        no_new_streak = 0

        while collected_this_run < max_jobs and no_new_streak < 8:
            scroll_count += 1

            # 1. Извличане на текущо видимите обяви преди виртуализацията да ги скрие
            batch_jobs = extract_visible_jobs(page, seen_urls)

            if batch_jobs:
                no_new_streak = 0
                for j in batch_jobs:
                    j["category"] = classify_job_rule_based(j["title"], j["description"])

                saved = repo.upsert_jobs_bg(batch_jobs)
                total_saved += saved
                collected_this_run += len(batch_jobs)

                print(f"📜 [Скрол {scroll_count}] +{len(batch_jobs)} нови обяви (Тази сесия: {collected_this_run}/{max_jobs} | Общо в Supabase: {total_saved})")
                for j in batch_jobs[:2]:
                    print(f"   • {j['title']} @ {j['company']} ({j['category']})")

                save_checkpoint(total_saved, list(seen_urls))
            else:
                no_new_streak += 1
                print(f"📜 [Скрол {scroll_count}] Няма нови позиции в текущия изглед (Опит {no_new_streak}/8)...")

            # 2. Плавно скролване надолу (Mouse Wheel симулира естествено колелце на мишката)
            wheel_steps = random.randint(2, 4)
            for _ in range(wheel_steps):
                page.mouse.wheel(0, random.randint(400, 700))
                time.sleep(random.uniform(0.3, 0.6))

            # 3. Човешко забавяне, за да дадем време на AJAX заявката на Jobs.bg да зареди новите обяви
            delay = random.uniform(min_delay, max_delay)
            time.sleep(delay)

        print("\n" + "=" * 65)
        print(f"🎉 Скролването завърши! Събрани обяви в тази сесия: {collected_this_run}")
        print(f"📁 Общо запазени в Supabase: {total_saved}")
        print("=" * 65)

    finally:
        browser_mgr.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Jobs.bg V1 Scroll Scraper")
    parser.add_argument("--url", type=str, default="https://www.jobs.bg/front_job_search.php?subm=1&location_sid=1", help="URL за търсене")
    parser.add_argument("--max-jobs", type=int, default=200, help="Брой позиции за събиране")
    parser.add_argument("--min-delay", type=float, default=2.5, help="Минимално закъснение в секунди между скроловете")
    parser.add_argument("--max-delay", type=float, default=4.5, help="Максимално закъснение в секунди между скроловете")
    parser.add_argument("--headless", action="store_true", help="Пускане в скрит режим")

    args = parser.parse_args()
    run_scroll_scraper(
        target_url=args.url,
        max_jobs=args.max_jobs,
        min_delay=args.min_delay,
        max_delay=args.max_delay,
        headless=args.headless
    )
