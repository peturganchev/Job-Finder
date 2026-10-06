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
        self.page = page
        self.name = name
        self.filters = load_filters()
        self.blacklist_titles = [w.lower() for w in self.filters.get("blacklist_title", [])]
        self.blacklist_companies = [c.lower() for c in self.filters.get("blacklist_companies", [])]

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
