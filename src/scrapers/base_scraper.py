"""
Base Scraper Class.
Defines the standard interface and common filtering logic across all job boards.
"""
from abc import ABC, abstractmethod
from typing import List, Optional
import yaml
from pathlib import Path
from playwright.sync_api import Page
from src.database.models import Job


def load_filters() -> dict:
    fpath = Path("config/filters.yaml")
    if fpath.exists():
        with open(fpath, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}


class BaseScraper(ABC):
    def __init__(self, page: Page, name: str = "base"):
        from src.settings_manager import SettingsManager
        self.page = page
        self.name = name
        self.filters = load_filters()
        settings = SettingsManager().load()
        self.location = settings.search.location or "Bulgaria"
        self.dev_bg_categories = list(settings.sources.dev_bg_categories)
        self._base_blacklist_titles = list(settings.blacklist_title)
        self.blacklist_titles = [w.lower() for w in self._base_blacklist_titles]
        self.blacklist_companies = [c.lower() for c in settings.blacklist_companies]

    def set_search_context(self, keywords: List[str], location: Optional[str] = None):
        """Задава локация и премахва думи от черния списък, които съвпадат с текущото търсене."""
        from src.settings_manager import SettingsManager
        if location:
            self.location = location
        effective = SettingsManager.effective_blacklist(self._base_blacklist_titles, keywords)
        removed = set(self._base_blacklist_titles) - set(effective)
        if removed:
            print(f"ℹ️ [{self.name}] Изключени от черния списък за това търсене: {', '.join(sorted(removed))}")
        self.blacklist_titles = [w.lower() for w in effective]

    def is_blacklisted(self, title: str, company: str = "") -> bool:
        """Проверява дали заглавието или компанията съдържат думи от черния списък."""
        t_lower = title.lower()
        c_lower = company.lower()

        for bad_title in self.blacklist_titles:
            if bad_title in t_lower:
                return True

        for bad_company in self.blacklist_companies:
            if bad_company in c_lower:
                return True

        return False

    @abstractmethod
    def search(self, keywords: List[str], max_jobs: int = 25) -> List[Job]:
        """Извлича списък с обяви по зададените ключови думи."""
        pass

    @abstractmethod
    def extract_job_details(self, job_url: str) -> dict:
        """Посещава страницата на обявата и извлича пълното описание, заплата, изисквания."""
        pass
