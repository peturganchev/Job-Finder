"""
Safe Local Backfill Script for Jobs.bg (Multi-industry).
Automates the local Brave/Chromium browser via Playwright with anti-ban humanized delays,
checkpointing, and direct upsert into Supabase `jobs_bg` catalog.
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

from src.database.repository import get_repository
from src.browser import BrowserManager
from src.scrapers.email_digest_parser import classify_job_rule_based

CHECKPOINT_FILE = os.path.join("data", "jobs_bg_backfill_checkpoint.json")


def load_checkpoint() -> dict:
    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"last_page": 0, "total_saved": 0, "processed_urls": []}


def save_checkpoint(last_page: int, total_saved: int, processed_urls: list):
    os.makedirs(os.path.dirname(CHECKPOINT_FILE), exist_ok=True)
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "last_page": last_page,
            "total_saved": total_saved,
            "processed_urls": processed_urls[-5000:],  # keep last 5000 in checkpoint
            "updated_at": datetime.now().isoformat()
        }, f, indent=2, ensure_ascii=False)


def run_backfill(max_pages: int = 20, delay_min: float = 2.0, delay_max: float = 4.5, resume: bool = True):
    load_dotenv()
    repo = get_repository()
    checkpoint = load_checkpoint() if resume else {"last_page": 0, "total_saved": 0, "processed_urls": []}
    start_page = checkpoint.get("last_page", 0) + 1
    total_saved = checkpoint.get("total_saved", 0)
    seen_urls = set(checkpoint.get("processed_urls", []))

    print(f"🚀 [Jobs.bg Backfill] Стартиране от страница {start_page} (До момента запазени: {total_saved})")

    # Launch local persistent browser
    browser_mgr = BrowserManager(headless=False)  # Headed mode passes DataDome easily with home IP
    try:
        _pw, _ctx, page = browser_mgr.launch_session(headless=False)
    except Exception as e:
        print(f"⚠️ Грешка при стартиране на браузъра: {e}")
        return

    try:
        current_page = start_page
        end_page = start_page + max_pages - 1

        while current_page <= end_page:
            # Jobs.bg pagination: front_job_search.php?from_page=0, from_page=15, from_page=30...
            from_offset = (current_page - 1) * 15
            target_url = f"https://www.jobs.bg/front_job_search.php?from_page={from_offset}"
            print(f"\n📄 [Страница {current_page}] Зареждане: {target_url}")

            try:
                page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
                # Humanized jitter delay
                time.sleep(random.uniform(delay_min, delay_max))

                # Smooth scroll to trigger lazy loading
                for _ in range(3):
                    page.mouse.wheel(0, 350)
                    time.sleep(random.uniform(0.3, 0.6))

                html = page.content()
                soup = BeautifulSoup(html, "html.parser")

                # Parse job items
                job_links = soup.select("a[href*='/job/'], a[href*='view_job.php']")
                page_jobs = []

                for link in job_links:
                    href = link.get("href", "")
                    if not href:
                        continue
                    if not href.startswith("http"):
                        href = f"https://www.jobs.bg/{href.lstrip('/')}"

                    if href in seen_urls:
                        continue
                    seen_urls.add(href)

                    title = link.get_text(strip=True)
                    if not title or len(title) < 3:
                        continue

                    # Find job card container
                    card = link.find_parent("td") or link.find_parent("div") or link.parent
                    company = "Работодател"
                    comp_elem = card.select_one("a[href*='company/']") if card else None
                    if comp_elem:
                        company = comp_elem.get_text(strip=True)

                    location = "България"
                    loc_text = card.get_text(" ", strip=True) if card else ""
                    if "София" in loc_text:
                        location = "София"
                    elif "Пловдив" in loc_text:
                        location = "Пловдив"
                    elif "Варна" in loc_text:
                        location = "Варна"
                    elif "Бургас" in loc_text:
                        location = "Бургас"

                    if "home office" in loc_text.lower() or "remote" in loc_text.lower() or "от вкъщи" in loc_text.lower():
                        location += " (Remote / Хибридно)"

                    job_id = href.split("/")[-1]

                    page_jobs.append({
                        "job_id": job_id,
                        "url": href,
                        "title": title,
                        "company": company,
                        "location": location,
                        "salary": None,
                        "description": loc_text,
                        "skills": [],
                        "category": None,
                        "is_active": True,
                    })

                if not page_jobs:
                    print(f"   ℹ️ Няма намерени нови обяви на страница {current_page} (възможен край на списъка).")
                    break

                # Zero-token classification (0 Google AI Studio tokens consumed!)
                for j in page_jobs:
                    j["category"] = classify_job_rule_based(j["title"], j["description"])

                # Upsert into Supabase jobs_bg
                saved = repo.upsert_jobs_bg(page_jobs)
                total_saved += saved
                print(f"   ✅ Страница {current_page}: Записани {saved} нови позиции в Supabase (Общо: {total_saved})")

                save_checkpoint(current_page, total_saved, list(seen_urls))
                current_page += 1

                # Safe cooldown between pages
                cooldown = random.uniform(delay_min, delay_max)
                time.sleep(cooldown)

            except Exception as page_err:
                print(f"⚠️ Грешка при обработка на страница {current_page}: {page_err}")
                time.sleep(5.0)
                current_page += 1

    finally:
        browser_mgr.close()
        print(f"\n🎉 [Jobs.bg Backfill Завършен] Общо записани позиции: {total_saved}")
        print(f"📁 Чекпойнт съхранен в: {CHECKPOINT_FILE}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Jobs.bg Multi-Industry Safe Backfill")
    parser.add_argument("--pages", type=int, default=10, help="Брой страници за скрейпване (по 15 обяви на страница)")
    parser.add_argument("--min-delay", type=float, default=2.0, help="Минимално закъснение в секунди между страници")
    parser.add_argument("--max-delay", type=float, default=4.5, help="Максимално закъснение в секунди между страници")
    parser.add_argument("--no-resume", action="store_true", help="Започване отначало без чекпойнт")

    args = parser.parse_args()
    run_backfill(
        max_pages=args.pages,
        delay_min=args.min_delay,
        delay_max=args.max_delay,
        resume=not args.no_resume
    )
