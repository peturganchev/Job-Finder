"""
Browser Manager for Job Finder.
Uses Playwright with persistent context, stealth plugin, and human-like delays
to avoid anti-scraping detection (Cloudflare on jobs.bg, bot detection on LinkedIn).
"""
import os
import time
import random
import yaml
from pathlib import Path
from typing import Tuple, Optional
from playwright.sync_api import sync_playwright, Playwright, BrowserContext, Page

try:
    from playwright_stealth import stealth_sync
except ImportError:
    stealth_sync = None


def load_settings() -> dict:
    config_path = Path("config/settings.yaml")
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}


class BrowserManager:
    def __init__(self, headless: Optional[bool] = None):
        self.settings = load_settings()
        self.browser_cfg = self.settings.get("browser", {})
        self.paths_cfg = self.settings.get("paths", {})
        self.scraping_cfg = self.settings.get("scraping", {})

        # По подразбиране ползва настройките от config/settings.yaml или .env
        env_headless = os.getenv("HEADLESS")
        if headless is not None:
            self.headless = headless
        elif env_headless is not None:
            self.headless = env_headless.lower() in ("true", "1", "yes")
        else:
            self.headless = self.browser_cfg.get("headless", False)

        self.session_dir = Path(self.paths_cfg.get("session_dir", ".browser_session"))
        self.session_dir.mkdir(parents=True, exist_ok=True)

        self.user_agent = self.browser_cfg.get(
            "user_agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
        )
        self.viewport = self.browser_cfg.get("viewport", {"width": 1920, "height": 1080})

    def human_delay(self, min_sec: Optional[float] = None, max_sec: Optional[float] = None):
        """Прави случайно забавяне, симулиращо човешко четене/мислене."""
        min_s = min_sec or self.scraping_cfg.get("human_delay_min_sec", 1.5)
        max_s = max_sec or self.scraping_cfg.get("human_delay_max_sec", 3.5)
        delay = random.uniform(min_s, max_s)
        time.sleep(delay)

    def human_scroll(self, page: Page, scrolls: int = 3):
        """Плавно скролва надолу по страницата, за да зареди динамично съдържание."""
        for _ in range(scrolls):
            scroll_amount = random.randint(300, 700)
            page.mouse.wheel(0, scroll_amount)
            time.sleep(random.uniform(0.5, 1.2))

    def launch_session(self, headless: Optional[bool] = None) -> Tuple[Playwright, BrowserContext, Page]:
        """
        Стартира persistent context, запазващ бисквитки, LocalStorage и сесии
        в директорията .browser_session/.
        """
        is_headless = headless if headless is not None else self.headless
        playwright = sync_playwright().start()

        # Стартираме с persistent context
        launch_kwargs = {
            "user_data_dir": str(self.session_dir.resolve()),
            "headless": is_headless,
            "user_agent": self.user_agent,
            "viewport": self.viewport,
            "locale": "bg-BG",
            "timezone_id": "Europe/Sofia",
            "extra_http_headers": {
                "Accept-Language": "bg-BG,bg;q=0.9,en-US;q=0.8,en;q=0.7"
            },
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-infobars",
                "--disable-extensions",
                "--start-maximized"
            ]
        }

        # Опитваме първо с инсталиран Chrome, ако няма или гръмне - с Chromium
        try:
            context = playwright.chromium.launch_persistent_context(
                channel="chrome",
                **launch_kwargs
            )
        except Exception:
            context = playwright.chromium.launch_persistent_context(
                **launch_kwargs
            )

        page = context.pages[0] if context.pages else context.new_page()

        # Прилагаме stealth скриптове, ако библиотеката е налична
        if stealth_sync:
            try:
                stealth_sync(page)
            except Exception:
                pass

        # Не инжектираме единична li_at бисквитка, тъй като без JSESSIONID/Opera TLS тя води до ERR_TOO_MANY_REDIRECTS
        # LinkedIn се обхожда стабилно през публичния портал без бисквитки
        return playwright, context, page

    def open_interactive_login(self):
        """
        Отваря видим браузър за еднократен ръчен вход в LinkedIn и jobs.bg.
        Потребителят се логва, преминава проверките и натиска Enter в конзолата.
        """
        print("\n" + "=" * 65)
        print("  🔑 РЕЖИМ НА ПЪРВОНАЧАЛЕН ВХОД (INTERACTIVE LOGIN)")
        print("=" * 65)
        print("1. Отваряме браузър с твоя локален профил.")
        print("2. Влез в LinkedIn и jobs.bg, реши капчи ако има.")
        print("3. Всички бисквитки и сесии ще се запазят автоматично в .browser_session/")
        print("4. Когато си готов, върни се в терминала и натисни ENTER.")
        print("=" * 65 + "\n")

        playwright, context, page = self.launch_session(headless=False)

        try:
            print("🌐 Отваряне на LinkedIn...")
            page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")
            time.sleep(2)

            print("🌐 Отваряне на Jobs.bg в нов таб...")
            jobs_page = context.new_page()
            jobs_page.goto("https://www.jobs.bg/", wait_until="domcontentloaded")

            input("\n👉 Натисни [ENTER] в терминала, след като си се логнал успешно и в двата сайта... ")

            print("\n💾 Запазване на сесията и бисквитките...")
            context.close()
            playwright.stop()
            print("✅ Сесията е успешно запазена в .browser_session/! Можеш да стартираш търсенето.")
        except Exception as e:
            print(f"⚠️ Грешка при сесията: {e}")
            try:
                context.close()
                playwright.stop()
            except Exception:
                pass
