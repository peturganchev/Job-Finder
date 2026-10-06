"""
Google Gemini AI Analyzer.
Analyzes job descriptions against the candidate's Agentic AI profile,
calculates match score, extracts missing skills, and generates tailored cover letters.
"""
import os
import json
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None


def load_profile() -> dict:
    p_path = Path("config/profile.yaml")
    if p_path.exists():
        with open(p_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}


class GeminiJobAnalyzer:
    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model_name = model_name or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.profile = load_profile()
        self.client = None

        if self.api_key and genai:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                print(f"⚠️ Грешка при инициализация на Gemini Client: {e}")

    def is_configured(self) -> bool:
        return bool(self.client and self.api_key)

    def analyze_job(self, title: str, company: str, location: str, description: str) -> Dict[str, Any]:
        """
        Анализира обявата чрез Gemini. Ако липсва API ключ, използва евристичен фолбек.
        """
        if not self.is_configured():
            return self._heuristic_fallback(title, description)

        candidate_info = json.dumps(self.profile.get("candidate", {}), ensure_ascii=False, indent=2)

        prompt = f"""
Ти си елитен технически кариерен консултант и Agentic AI архитект.
Анализирай следната обява за работа спрямо профила и целите на кандидата.

КАНДИДАТ (ПРОФИЛ И ЦЕЛИ):
{candidate_info}

ОБЯВА ЗА РАБОТА:
- Заглавие: {title}
- Компания: {company}
- Локация: {location}
- Описание:
{description[:5000]}

ЗАДАЧА:
Върни САМО валиден JSON обект със следния формат:
{{
  "match_score": <цяло число от 0 до 100, показващо колко обявата е подходяща за целите на кандидата (Agentic AI, LLM, Python)>,
  "ai_summary": "<2-3 изречения на български: какво представлява позицията и основната дейност>",
  "matched_skills": ["<умение 1>", "<умение 2>"],
  "missing_skills": ["<технология или изискване, което липсва и е добре да се научи за портфолиото>"],
  "recommendation": "<'apply' | 'save_for_learning' | 'skip'>",
  "cover_letter_intro": "<кратък, убедителен уводен параграф за кандидатстване, персонализиран за тази обява>"
}}
"""

        try:
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            )
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config
            )
            data = json.loads(response.text)
            return {
                "match_score": int(data.get("match_score", 50)),
                "ai_summary": data.get("ai_summary", ""),
                "matched_skills": data.get("matched_skills", []),
                "missing_skills": data.get("missing_skills", []),
                "cover_letter": data.get("cover_letter_intro", ""),
                "recommendation": data.get("recommendation", "save_for_learning")
            }
        except Exception as e:
            print(f"⚠️ Грешка при Gemini заявка ({e}). Използване на евристика...")
            return self._heuristic_fallback(title, description)

    def generate_full_cover_letter(self, title: str, company: str, description: str) -> str:
        """Генерира пълно, персонализирано мотивационно писмо."""
        if not self.is_configured():
            return "Необходим е GEMINI_API_KEY за генериране на пълно мотивационно писмо."

        candidate_info = json.dumps(self.profile.get("candidate", {}), ensure_ascii=False, indent=2)

        prompt = f"""
Напиши силно, професионално и модерно мотивационно писмо за позицията '{title}' в '{company}'.
Писмото трябва да е на езика на обявата (ако обявата е на английски - на английски, ако е на български - на български).
Кандидатът се преквалифицира в Agentic AI Engineering и разработва проекти с LangChain, CrewAI, AutoGen, LlamaIndex, RAG и Python.

Профил на кандидата:
{candidate_info}

Описание на обявата:
{description[:4000]}
"""
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
            )
            return response.text.strip()
        except Exception as e:
            return f"Грешка при генериране: {e}"

    def _heuristic_fallback(self, title: str, description: str) -> Dict[str, Any]:
        """Проста базова оценка, когато все още не е въведен Gemini API ключ."""
        text = (title + " " + description).lower()
        score = 40
        matched = []
        missing = []

        keywords_check = {
            "agentic": 25, "agent": 15, "langchain": 20, "llamaindex": 20,
            "crewai": 20, "autogen": 20, "llm": 20, "rag": 15,
            "python": 10, "generative ai": 15, "ai": 10, "fastapi": 10
        }

        for kw, pts in keywords_check.items():
            if kw in text:
                score += pts
                matched.append(kw.upper())
            else:
                if kw in ["langchain", "llamaindex", "rag", "crewai"]:
                    missing.append(kw.upper())

        score = min(score, 95)
        return {
            "match_score": score,
            "ai_summary": f"Позиция '{title}'. (Базов евристичен анализ без Gemini ключ).",
            "matched_skills": matched[:6],
            "missing_skills": missing[:4],
            "cover_letter": "Добави GEMINI_API_KEY в .env за пълно AI мотивационно писмо.",
            "recommendation": "apply" if score >= 70 else "save_for_learning"
        }
