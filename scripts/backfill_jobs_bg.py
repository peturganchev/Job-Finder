"""
Safe Continuous Backfill Script for Jobs.bg.
Opens browser visibly, alerts user via Windows Desktop Toast Notification on any challenge,
auto-detects when challenge is solved, and autonomously extracts and upserts jobs into Supabase.
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
from src.utils.desktop_notifier import notify_desktop

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
            "processed_urls": processed_urls[-10000:],
            "updated_at": datetime.now().isoformat()
        }, f, indent=2, ensure_ascii=False)


def handle_challenge_if_needed(page, max_wait_sec: int = 90) -> bool:
    """
    Проверява дали има активна Cloudflare или DataDome защита.
    Ако има:
      - Изпраща Windows Toast десктоп нотификация и звуков сигнал.
      - Показва прозореца на преден план.
      - Изчаква потребителя да плъзне слайдера/реши капчата.
      - Автоматично засича отключването и продължава без натискане на клавиш.
    """
    time.sleep(1.5)
    
    # 1. Вече заредени обяви ли са?
    if page.query_selector("a[href*='/job/'], a[href*='view_job.php']"):
        return True

    title = (page.title() or "").strip()
    content = page.content()

    is_cf = "Just a moment" in title or "Cloudflare" in title
    is_dd = (
        "captcha-delivery" in content
        or "var dd={'rt':'c'" in content
        or page.query_selector("iframe[src*='captcha-delivery']") is not None
    )

    if not is_cf and not is_dd:
        # Може просто страницата да зарежда
        time.sleep(2.0)
        if page.query_selector("a[href*='/job/'], a[href*='view_job.php']"):
            return True

    print("\n" + "=" * 60)
    print("🔔 [ВНИМАНИЕ] Засечена проверка за робот (Cloudflare / DataDome)!")
    print("👉 Изпращам нотификация на десктопа. Моля погледни браузъра и плъзни слайдера.")
    print("=" * 60 + "\n")

    # Десктоп нотификация
    notify_desktop(
        "Job-Finder: Валидация на Jobs.bg",
        "Моля плъзнете слайдера в отворения браузър за достъп до Jobs.bg!"
    )

    try:
        page.bring_to_front()
    except Exception:
        pass

    start_wait = time.time()
    last_beep = 0
    while time.time() - start_wait < max_wait_sec:
        time.sleep(1.2)
        try:
            # Опит за клик на Turnstile чекбокс ако има такъв
            for sel in ["iframe[src*='cloudflare']", "iframe[src*='turnstile']", "input[type='checkbox']"]:
                elem = page.query_selector(sel)
                if elem:
                    box = elem.bounding_box()
                    if box:
                        page.mouse.click(box["x"] + 25, box["y"] + 25)
                        time.sleep(0.5)

            # Проверка дали обявите се появиха
            if page.query_selector("a[href*='/job/'], a[href*='view_job.php']"):
                print("🎉 [УСПЕХ] Проверката е премината! Автоматично продължаване на извличането...")
                return True
        except Exception:
            pass

    print("⚠️ Изтече времето за изчакване на валидация.")
    return False


def run_backfill(max_pages: int = 30, delay_min: float = 2.0, delay_max: float = 4.0, resume: bool = True):
    load_dotenv()
    repo = get_repository()
    checkpoint = load_checkpoint() if resume else {"last_page": 0, "total_saved": 0, "processed_urls": []}
    start_page = checkpoint.get("last_page", 0) + 1
    total_saved = checkpoint.get("total_saved", 0)
    seen_urls = set(checkpoint.get("processed_urls", []))

    print(f"🚀 [Jobs.bg Backfill] Стартиране от страница {start_page} (Досега събрани: {total_saved})")

    # Пускаме видим браузър за потребителя
    browser_mgr = BrowserManager(headless=False)
    try:
        _pw, _ctx, page = browser_mgr.launch_session(headless=False)
    except Exception as e:
        print(f"⚠️ Грешка при стартиране на браузъра: {e}")
        return

    try:
        current_page = start_page
        end_page = start_page + max_pages - 1

        while current_page <= end_page:
            from_offset = (current_page - 1) * 15
            target_url = f"https://www.jobs.bg/front_job_search.php?from_page={from_offset}"
            print(f"\n📄 [Страница {current_page}/{end_page}] Зареждане: {target_url}")

            try:
                page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
                
                # Проверка и нотификация при нужда
                is_ready = handle_challenge_if_needed(page, max_wait_sec=90)
                if not is_ready:
                    print(f"🛑 Спиране на бекфила на страница {current_page} поради липса на валидация.")
                    break

                # Плавни човешки движения
                time.sleep(random.uniform(delay_min, delay_max))
                for _ in range(2):
                    page.mouse.wheel(0, random.randint(300, 600))
                    time.sleep(random.uniform(0.4, 0.8))

                html = page.content()
                soup = BeautifulSoup(html, "html.parser")

                # Извличане на линкове
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

                    raw_title = link.get_text(strip=True)
                    if not raw_title or len(raw_title) < 3:
                        continue

                    # Премахване на икони и декорации
                    import re
                    clean_title = re.sub(r'^(?:star)+', '', raw_title).strip()
                    title = clean_title if len(clean_title) >= 3 else raw_title

                    # Контейнер на обявата
                    card = link.find_parent("td") or link.find_parent("div") or link.parent
                    company = "Работодател"
                    comp_elem = card.select_one("a[href*='company/']") if card else None
                    if comp_elem:
                        company = comp_elem.get_text(strip=True)

                    location = "България"
                    loc_text = card.get_text(" ", strip=True) if card else ""
                    for city in ["София", "Пловдив", "Варна", "Бургас", "Русе", "Стара Загора"]:
                        if city in loc_text:
                            location = city
                            break

                    if any(r in loc_text.lower() for r in ["home office", "remote", "дистанционно", "от вкъщи"]):
                        location += " (Remote / Хибридно)"

                    job_id = href.rstrip("/").split("/")[-1]

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
                    print(f"   ℹ️ Няма намерени нови обяви на страница {current_page}.")
                    # Възможно е страницата да е празна или край на резултатите
                    current_page += 1
                    continue

                # 0 токена: NLP класификация
                for j in page_jobs:
                    j["category"] = classify_job_rule_based(j["title"], j["description"])

                # Upsert в Supabase
                saved = repo.upsert_jobs_bg(page_jobs)
                total_saved += saved
                print(f"   ✅ Страница {current_page}: Записани {saved} нови позиции в Supabase (Общо в каталога: {total_saved})")

                save_checkpoint(current_page, total_saved, list(seen_urls))
                current_page += 1

                # Случайно забавяне между страниците
                cooldown = random.uniform(delay_min, delay_max)
                time.sleep(cooldown)

            except Exception as page_err:
                print(f"⚠️ Грешка при страница {current_page}: {page_err}")
                time.sleep(4.0)
                current_page += 1

    finally:
        browser_mgr.close()
        print("\n" + "=" * 60)
        print(f"🎉 [Бекфилът завърши/паузиран] Общо позиции в Supabase: {total_saved}")
        print(f"📁 Чекпойнт съхранен в: {CHECKPOINT_FILE}")
        print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Jobs.bg Multi-Industry Continuous Backfill")
    parser.add_argument("--pages", type=int, default=20, help="Брой страници за скрейпване")
    parser.add_argument("--min-delay", type=float, default=2.0, help="Минимално закъснение в секунди")
    parser.add_argument("--max-delay", type=float, default=4.0, help="Максимално закъснение в секунди")
    parser.add_argument("--no-resume", action="store_true", help="Започване отначало без чекпойнт")

    args = parser.parse_args()
    run_backfill(
        max_pages=args.pages,
        delay_min=args.min_delay,
        delay_max=args.max_delay,
        resume=not args.no_resume
    )
