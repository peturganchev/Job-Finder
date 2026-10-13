"""
Weekly Verification and Cleanup Script for Jobs.bg.
Checks active listings in Supabase `jobs_bg` from the local home IP/browser.
Marks expired/removed positions as `is_active = False` to preserve market analytics
while removing them from active user search results.
"""
import os
import sys
import time
import random
import argparse
from datetime import datetime
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.database.repository import get_repository
from src.browser import BrowserManager


def verify_jobs(limit: int = 50, delay: float = 1.5):
    load_dotenv()
    repo = get_repository()
    
    print(f"🔍 [Jobs.bg Верификация] Извличане на до {limit} активни обяви за проверка...")
    candidates = repo.get_jobs_bg_for_verification(limit=limit)
    if not candidates:
        print("✅ Няма позиции, чакащи верификация.")
        return

    print(f"📋 Намерени {len(candidates)} позиции за проверка.")
    browser_mgr = BrowserManager(headless=True)
    expired_urls = []
    verified_count = 0

    try:
        _pw, _ctx, page = browser_mgr.launch_session(headless=True)
        
        for idx, item in enumerate(candidates, 1):
            url = item.get("url")
            title = item.get("title", "")
            if not url:
                continue

            print(f"[{idx}/{len(candidates)}] Проверка: {title[:40]}... ({url})")
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=15000)
                time.sleep(random.uniform(delay * 0.8, delay * 1.2))

                page_title = (page.title() or "").lower()
                content = (page.content() or "").lower()

                # Signatures of expired or removed jobs on Jobs.bg
                is_expired = (
                    "страницата не може да бъде намерена" in page_title
                    or "обявата не е активна" in content
                    or "не е активна" in page_title
                    or "изтекла" in page_title
                    or page.query_selector(".no-job-alert") is not None
                )

                if is_expired:
                    print(f"   ⚠️ ИЗТЕКЛА / СВАЛЕНА: Маркира се като неактивна.")
                    expired_urls.append(url)
                else:
                    verified_count += 1

            except Exception as e:
                print(f"   ⚠️ Грешка при зареждане на {url}: {e}")

        # Batch mark inactive in Supabase
        if expired_urls:
            marked = repo.mark_jobs_bg_inactive(expired_urls)
            print(f"\n🧹 [Резултат] {marked} обяви бяха маркирани като 'is_active = False' в Supabase.")
        else:
            print("\n✨ [Резултат] Всички проверени позиции са все още активни!")

        print(f"🎉 Верификацията приключи! Потвърдени активни: {verified_count}, Маркирани изтекли: {len(expired_urls)}")

    finally:
        browser_mgr.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Jobs.bg Weekly Listing Verification")
    parser.add_argument("--limit", type=int, default=50, help="Брой обяви за проверка")
    parser.add_argument("--delay", type=float, default=1.5, help="Закъснение в секунди между проверки")

    args = parser.parse_args()
    verify_jobs(limit=args.limit, delay=args.delay)
