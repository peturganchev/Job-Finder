"""
User Settings Manager.
Single source of truth for user-editable configuration (search keywords, sources,
Gemini API key, blacklist). Persists to data/user_settings.json (gitignored).

API key resolution order: user_settings.json -> .env (GEMINI_API_KEY) -> None.
"""
import json
import os
from pathlib import Path
from typing import List, Optional

import yaml
from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()

AVAILABLE_SOURCES = ["dev.bg", "jobs.bg", "linkedin"]
AVAILABLE_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-pro", "antigravity-preview-latest"]
DEV_BG_CATEGORIES = {
    "ml-ai-data": "ML / AI / Data",
    "python": "Python",
    "data-science": "Data Science",
    "java": "Java",
    "javascript": "JavaScript",
    "dotnet": ".NET",
    "devops": "DevOps",
    "quality-assurance": "QA",
}


class SearchSettings(BaseModel):
    keywords: List[str] = Field(default_factory=lambda: ["AI Engineer", "Agentic", "LLM", "Generative AI"])
    location: str = "Bulgaria"
    remote_location: str = "Worldwide"
    max_jobs_per_source: int = 15
    max_keywords_per_run: int = 4

class SourceSettings(BaseModel):
    dev_bg: bool = True
    jobs_bg: bool = True
    linkedin: bool = True
    himalayas: bool = False
    euremotejobs: bool = True
    hackernews: bool = True
    dev_bg_categories: List[str] = Field(default_factory=list)


class AISettings(BaseModel):
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-3.5-flash"


class UserSettings(BaseModel):
    search: SearchSettings = Field(default_factory=SearchSettings)
    sources: SourceSettings = Field(default_factory=SourceSettings)
    ai: AISettings = Field(default_factory=AISettings)
    blacklist_title: List[str] = Field(default_factory=list)
    blacklist_companies: List[str] = Field(default_factory=list)
    roadmap_progress: dict = Field(default_factory=dict)

class SettingsManager:
    def __init__(self, path: str = "data/user_settings.json"):
        self.path = Path(path)

    # ---------- Load / Save ----------
    def load(self) -> UserSettings:
        if self.path.exists():
            try:
                with open(self.path, "r", encoding="utf-8") as f:
                    return UserSettings(**json.load(f))
            except Exception as e:
                print(f"⚠️ Невалиден {self.path}, използват се стойности по подразбиране: {e}")
        settings = self._migrate_from_legacy()
        self.save(settings)
        return settings

    def save(self, settings: UserSettings) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(settings.model_dump(), f, ensure_ascii=False, indent=2)

    def _migrate_from_legacy(self) -> UserSettings:
        """Първо стартиране: пренася ключови думи и черен списък от config/filters.yaml."""
        settings = UserSettings()
        fpath = Path("config/filters.yaml")
        if fpath.exists():
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    filters = yaml.safe_load(f) or {}
                primary = filters.get("search_queries", {}).get("primary")
                if primary:
                    settings.search.keywords = list(primary)
                settings.blacklist_title = list(filters.get("blacklist_title", []) or [])
                settings.blacklist_companies = list(filters.get("blacklist_companies", []) or [])
            except Exception:
                pass
        env_model = os.getenv("GEMINI_MODEL")
        if env_model in AVAILABLE_MODELS:
            settings.ai.gemini_model = env_model
        # Ключът НЕ се копира от .env – остава там като fallback.
        return settings

    # ---------- API key ----------
    def get_api_key(self) -> Optional[str]:
        key = (self.load().ai.gemini_api_key or "").strip()
        if key:
            return key
        env_key = (os.getenv("GEMINI_API_KEY") or "").strip()
        if env_key and env_key != "your_gemini_api_key_here":
            return env_key
        return None

    def get_api_key_source(self) -> str:
        """Връща 'settings', 'env' или 'none'."""
        if (self.load().ai.gemini_api_key or "").strip():
            return "settings"
        env_key = (os.getenv("GEMINI_API_KEY") or "").strip()
        if env_key and env_key != "your_gemini_api_key_here":
            return "env"
        return "none"

    def set_api_key(self, key: Optional[str]) -> None:
        s = self.load()
        s.ai.gemini_api_key = (key or "").strip() or None
        self.save(s)

    @staticmethod
    def mask_key(key: Optional[str]) -> str:
        if not key:
            return "—"
        if len(key) <= 10:
            return "•" * len(key)
        return f"{key[:7]}…{key[-4:]}"

    # ---------- Sources / blacklist ----------
    def enabled_sources(self) -> List[str]:
        src = self.load().sources
        out = []
        if src.dev_bg:
            out.append("dev.bg")
        if src.jobs_bg:
            out.append("jobs.bg")
        if src.linkedin:
            out.append("linkedin")
        if src.himalayas:
            out.append("himalayas")
        if src.euremotejobs:
            out.append("euremotejobs")
        if src.hackernews:
            out.append("hackernews")
        return out

    @staticmethod
    def effective_blacklist(blacklist: List[str], keywords: List[str]) -> List[str]:
        """Премахва думи от черния списък, които съвпадат с текущото търсене."""
        kws = [k.lower() for k in keywords]
        result = []
        for b in blacklist:
            bl = b.lower()
            if any(bl in k or k in bl for k in kws):
                continue
            result.append(b)
        return result
