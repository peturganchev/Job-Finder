"""
Google Gemini AI Analyzer.
Analyzes job descriptions against the candidate's Agentic AI profile,
calculates match score, extracts missing skills, and generates tailored cover letters.
"""
import os
import re
import json
import yaml
from pathlib import Path
from typing import Dict, Any, Optional, List, Literal
from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None


class JobMatchSchema(BaseModel):
    match_score: int = Field(description="Match score from 0 to 100 indicating suitability for candidate goals")
    ai_summary: str = Field(description="Summary of the position and responsibilities")
    matched_skills: List[str] = Field(description="List of matched candidate skills")
    missing_skills: List[str] = Field(description="List of missing skills required by the job")
    recommendation: Literal["apply", "save_for_learning", "skip"] = Field(
        default="save_for_learning",
        description="'apply', 'save_for_learning', or 'skip'"
    )
    cover_letter_intro: str = Field(description="Short customized cover letter introduction")


def is_agent_model(model_name: Optional[str]) -> bool:
    """Returns True if the model name is an agent model that requires Interactions API."""
    if not model_name:
        return False
    lower = model_name.lower().strip()
    return "antigravity" in lower or "agent" in lower


def get_available_gemini_models(api_key: Optional[str] = None) -> List[str]:
    """Връща списък с реално достъпните модели за дадения Gemini API ключ."""
    default_models = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-pro", "antigravity-preview-latest"]
    if not api_key:
        return default_models
    try:
        from google import genai
        c = genai.Client(api_key=api_key)
        extracted = []
        for m in c.models.list():
            name = getattr(m, "name", "").replace("models/", "").strip()
            lower = name.lower()
            if any(k in lower for k in ["flash", "pro", "antigravity"]) and not any(k in lower for k in ["tts", "image", "embedding", "live", "transcribe", "robotics"]):
                extracted.append(name)
        
        preferred_order = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-pro", "antigravity-preview-latest"]
        final_list = []
        for pref in preferred_order:
            if pref in extracted:
                final_list.append(pref)
        for m in sorted(extracted):
            if m not in final_list:
                final_list.append(m)
        return final_list if final_list else default_models
    except Exception as e:
        print(f"⚠️ Грешка при зареждане на модели от API: {e}")
        return default_models


def _clean_json_text(text: str) -> str:
    """Cleans potential markdown code blocks and surrounding commentary from model JSON output."""
    cleaned = (text or "").strip()
    if not cleaned:
        return ""
    # Extract from markdown code fence if present
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    if fence_match:
        cleaned = fence_match.group(1).strip()
    # If not starting directly with JSON delimiter { or [, locate outer boundary
    if not (cleaned.startswith("{") or cleaned.startswith("[")):
        obj_start = cleaned.find("{")
        arr_start = cleaned.find("[")
        if obj_start != -1 and (arr_start == -1 or obj_start < arr_start):
            obj_end = cleaned.rfind("}")
            if obj_end != -1:
                cleaned = cleaned[obj_start:obj_end + 1].strip()
        elif arr_start != -1:
            arr_end = cleaned.rfind("]")
            if arr_end != -1:
                cleaned = cleaned[arr_start:arr_end + 1].strip()
    return cleaned


def _extract_interaction_text(response: Any) -> str:
    """Safely extracts output text from an Interactions API response or step list."""
    if not response:
        return ""
    text = getattr(response, "output_text", None)
    if text:
        return text
    steps = getattr(response, "steps", None) or []
    parts = []
    for step in steps:
        step_type = getattr(step, "type", None) or (step.get("type") if isinstance(step, dict) else None)
        if step_type == "model_output":
            content = getattr(step, "content", None) or (step.get("content") if isinstance(step, dict) else None)
            if isinstance(content, list):
                for item in content:
                    item_type = getattr(item, "type", None) or (item.get("type") if isinstance(item, dict) else None)
                    if item_type == "text":
                        item_text = getattr(item, "text", "") or (item.get("text", "") if isinstance(item, dict) else "")
                        if item_text:
                            parts.append(item_text)
    return "".join(parts)


def load_profile() -> dict:
    p_path = Path("config/profile.yaml")
    if p_path.exists():
        with open(p_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    return {}


class GeminiJobAnalyzer:
    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None, profile_data: Optional[Dict[str, Any]] = None):
        from src.settings_manager import SettingsManager
        sm = SettingsManager()
        raw_model = (model_name or sm.load().ai.gemini_model or "gemini-3.8-flash").strip()
        if raw_model.lower() == "antigravity":
            self.model_name = "antigravity-preview-latest"
        elif raw_model.startswith("models/"):
            self.model_name = raw_model.replace("models/", "")
        else:
            self.model_name = raw_model
        self.profile = profile_data or load_profile()
        self.client = None

        if self.api_key and genai:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                print(f"⚠️ Грешка при инициализация на Gemini Client: {e}")

    def is_configured(self) -> bool:
        return bool(self.client and self.api_key)

    def is_agent_model(self, model_name: Optional[str] = None) -> bool:
        return is_agent_model(model_name if model_name is not None else self.model_name)

    def test_connection(self) -> tuple:
        """Прави една минимална заявка. Връща (успех: bool, съобщение: str)."""
        if not self.api_key:
            return False, "Няма въведен API ключ."
        if not self.client:
            return False, "Клиентът не можа да се инициализира (провери ключа или библиотеката google-genai)."
        try:
            if self.is_agent_model():
                resp = self.client.interactions.create(
                    model=self.model_name,
                    input="Reply with: OK"
                )
                text = _extract_interaction_text(resp).strip()
            else:
                resp = self.client.models.generate_content(model=self.model_name, contents="Reply with: OK")
                text = (resp.text or "").strip()
            return True, f"Връзката е успешна с модел `{self.model_name}` (отговор: {text[:20]})."
        except Exception as e:
            msg = str(e)
            if "API_KEY_INVALID" in msg or "API key not valid" in msg or "401" in msg or "403" in msg:
                return False, "Невалиден API ключ."
            if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                return False, "Ключът е валиден, но квотата е изчерпана в момента (429). Опитай по-късно."
            if "404" in msg:
                return False, f"Моделът `{self.model_name}` не е достъпен за този ключ. Избери друг модел."
            if "503" in msg or "UNAVAILABLE" in msg:
                return False, "Моделът е претоварен (503). Ключът вероятно е валиден, опитай пак след малко."
            return False, f"Грешка: {msg[:200]}"

    def _get_learned_skills(self) -> str:
        from src.settings_manager import SettingsManager
        sm = SettingsManager()
        progress = sm.load().roadmap_progress
        
        roadmap_map = {
            "sk_p1": "Prompt Eng & Context Strategy",
            "sk_p2": "AI Python & Pydantic Validation",
            "sk_p3": "Building Systems with LLM APIs",
            "sk_p4": "LangChain Chaining & Chat with Data",
            "sk_p5": "4-те Модела на Andrew Ng (Reflection, Tools, Plan, Multi-Agent)",
            "sk_p6": "Function & Tool Calling в код",
            "sk_p7": "Multi-Agent екипи с CrewAI",
            "sk_p8": "Event-Driven & Human-in-the-Loop Flows",
            "sk_p9": "Model Context Protocol (MCP) Сървъри",
            "sk_p10": "LangGraph StateGraphs & Дългосрочна Памет",
            "sk_p11": "Eval Harness (Оценка на точност & токени)",
            "sk_p12": "Advanced RAG & Unstructured Data Prep"
        }
        
        learned = []
        for key, name in roadmap_map.items():
            if progress.get(key, False):
                learned.append(name)
                
        if not learned:
            return "Кандидатът все още не е завършил нито един модул от Agentic AI пътеката."
        return ", ".join(learned)

    def analyze_job(self, title: str, company: str, location: str, description: str) -> Dict[str, Any]:
        """
        Анализира обявата чрез Gemini. Ако липсва API ключ, използва евристичен фолбек.
        """
        if not self.is_configured():
            return self._heuristic_fallback(title, description)

        profile_dict = self.profile if "name" in self.profile else self.profile.get("candidate", {})
        candidate_info = json.dumps(profile_dict, ensure_ascii=False, indent=2)
        learned_skills = self._get_learned_skills()

        prompt = f"""
Ти си елитен технически кариерен консултант и Agentic AI архитект.
Анализирай следната обява за работа спрямо профила и целите на кандидата.

КАНДИДАТ (ПРОФИЛ И ЦЕЛИ):
{candidate_info}

УСПЕШНО ЗАВЪРШЕНИ КУРСОВЕ И УСВОЕНИ УМЕНИЯ ОТ КАНДИДАТА (от Skill Roadmap):
{learned_skills}
ВНИМАНИЕ: Кандидатът тепърва се преквалифицира. Неговият % мач (match_score) трябва да се базира на фундаменталните му инженерни умения и тези завършени AI курсове! Ако обявата изисква умения, които не са в списъка по-горе (дори да са споменати в целите), мачът трябва да бъде по-нисък.

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

        raw_text = None

        if self.is_agent_model():
            try:
                response = self.client.interactions.create(
                    model=self.model_name,
                    input=prompt,
                    response_mime_type="application/json",
                    response_format={
                        "type": "text",
                        "mime_type": "application/json",
                        "schema": JobMatchSchema.model_json_schema(),
                    },
                    generation_config={"temperature": 0.2},
                )
                if response:
                    raw_text = _extract_interaction_text(response)
            except Exception as e:
                print(f"⚠️ Грешка при анализ с Interactions API ({e}). Използване на евристика...")
                return self._heuristic_fallback(title, description)
        else:
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=JobMatchSchema,
                temperature=0.2,
            )

            response = None
            candidate_models = [self.model_name, "gemini-3.5-flash-lite", "gemini-2.5-pro"]
            # Премахваме дубликати, запазвайки реда
            seen_models = set()
            models_to_try = [m for m in candidate_models if not (m in seen_models or seen_models.add(m))]

            for m in models_to_try:
                try:
                    response = self.client.models.generate_content(
                        model=m,
                        contents=prompt,
                        config=config
                    )
                    if response and response.text:
                        raw_text = response.text
                        break
                except Exception as e:
                    # Ако моделът е претоварен (503) или недостъпен, опитваме следващия
                    continue

        if not raw_text:
            return self._heuristic_fallback(title, description)

        try:
            data = json.loads(_clean_json_text(raw_text))
            try:
                score = int(data.get("match_score", 50))
            except (ValueError, TypeError):
                score = 50
            score = max(0, min(100, score))
            cover_letter_text = data.get("cover_letter_intro") or data.get("cover_letter") or ""
            return {
                "match_score": score,
                "ai_summary": data.get("ai_summary") or "",
                "matched_skills": data.get("matched_skills") or [],
                "missing_skills": data.get("missing_skills") or [],
                "cover_letter": cover_letter_text,
                "cover_letter_intro": cover_letter_text,
                "recommendation": data.get("recommendation") or "save_for_learning"
            }
        except Exception as e:
            print(f"⚠️ Грешка при парсване на JSON ({e}). Използване на евристика...")
            return self._heuristic_fallback(title, description)

    def analyze_jobs_batch(self, jobs: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Бълк (пакетен) анализ на списък от обяви с ЕДНА единствена заявка до Gemini.
        Спестява API квоти и ресурси чрез пакетно оценяване в рамките на един промпт.
        """
        if not jobs:
            return {}

        if not self.is_configured():
            return {
                j["job_id"]: self._heuristic_fallback(j["title"], j["description"])
                for j in jobs
            }

        profile_dict = self.profile if "name" in self.profile else self.profile.get("candidate", {})
        candidate_info = json.dumps(profile_dict, ensure_ascii=False, indent=2)
        learned_skills = self._get_learned_skills()

        job_blocks = []
        for idx, j in enumerate(jobs, 1):
            block = (
                f"### ОБЯВА #{idx} (ID: {j['job_id']})\n"
                f"- Заглавие: {j['title']}\n"
                f"- Компания: {j['company']}\n"
                f"- Локация: {j['location']}\n"
                f"- Описание:\n{j['description'][:2500]}\n"
            )
            job_blocks.append(block)

        all_jobs_text = "\n---\n".join(job_blocks)

        prompt = f"""
Ти си елитен технически кариерен консултант и Agentic AI архитект.
Анализирай следните {len(jobs)} обяви за работа спрямо профила и целите на кандидата.

КАНДИДАТ (ПРОФИЛ И ЦЕЛИ):
{candidate_info}

УСПЕШНО ЗАВЪРШЕНИ КУРСОВЕ И УСВОЕНИ УМЕНИЯ ОТ КАНДИДАТА (от Skill Roadmap):
{learned_skills}
ВНИМАНИЕ: Кандидатът тепърва се преквалифицира. Неговият % мач (match_score) трябва да се базира на фундаменталните му инженерни умения и тези завършени AI курсове! Ако обявата изисква умения, които не са в списъка по-горе (дори да са споменати в целите), мачът трябва да бъде по-нисък.

СПИСЪК С ОБЯВИ ЗА ПАКЕТНА ОЦЕНКА:
{all_jobs_text}

ЗАДАЧА:
Оцени всяка обява поотделно и върни САМО валиден JSON масив, в който всеки елемент отговаря на една обява:
[
  {{
    "job_id": "<точното ID от заглавието на съответната обява>",
    "match_score": <цяло число от 0 до 100>,
    "ai_summary": "<2-3 изречения на български: какво представлява позицията и основните отговорности>",
    "matched_skills": ["<умение 1>", "<умение 2>"],
    "missing_skills": ["<липсваща технология/изискване за портфолиото>"],
    "recommendation": "<'apply' | 'save_for_learning' | 'skip'>",
    "cover_letter_intro": "<кратък персонализиран уводен абзац за кандидатстване>"
  }}
]
"""

        raw_text = None
        if self.is_agent_model():
            try:
                response = self.client.interactions.create(
                    model=self.model_name,
                    input=prompt,
                    response_mime_type="application/json",
                    response_format={"type": "text", "mime_type": "application/json"},
                    generation_config={"temperature": 0.2},
                )
                if response:
                    raw_text = _extract_interaction_text(response)
            except Exception as e:
                print(f"⚠️ Грешка при пакетен анализ с Interactions API ({e})")
        else:
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            )

            candidate_models = [self.model_name, "gemini-3.5-flash-lite", "gemini-2.5-pro"]
            seen_models = set()
            models_to_try = [m for m in candidate_models if not (m in seen_models or seen_models.add(m))]

            for m in models_to_try:
                try:
                    response = self.client.models.generate_content(
                        model=m,
                        contents=prompt,
                        config=config
                    )
                    if response and response.text:
                        raw_text = response.text
                        break
                except Exception:
                    continue

        results = {}
        if raw_text:
            try:
                data = json.loads(_clean_json_text(raw_text))
                if isinstance(data, list):
                    for item in data:
                        jid = str(item.get("job_id", ""))
                        try:
                            score = int(item.get("match_score", 50))
                        except (ValueError, TypeError):
                            score = 50
                        score = max(0, min(100, score))
                        intro = item.get("cover_letter_intro") or item.get("cover_letter") or ""
                        results[jid] = {
                            "match_score": score,
                            "ai_summary": item.get("ai_summary") or "",
                            "matched_skills": item.get("matched_skills") or [],
                            "missing_skills": item.get("missing_skills") or [],
                            "cover_letter": intro,
                            "cover_letter_intro": intro,
                            "recommendation": item.get("recommendation") or "save_for_learning"
                        }
            except Exception as e:
                print(f"⚠️ Грешка при парсване на пакетния JSON: {e}")

        # За всяка обява, която евентуално липсва в отговора, прилагаме евристика
        for j in jobs:
            jid = j["job_id"]
            if jid not in results:
                results[jid] = self._heuristic_fallback(j["title"], j["description"])

        return results

    def generate_full_cover_letter(self, title: str, company: str, description: str) -> str:
        """Генерира пълно, персонализирано мотивационно писмо."""
        if not self.is_configured():
            return "Необходим е GEMINI_API_KEY за генериране на пълно мотивационно писмо."

        profile_dict = self.profile if "name" in self.profile else self.profile.get("candidate", {})
        candidate_info = json.dumps(profile_dict, ensure_ascii=False, indent=2)

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
            if self.is_agent_model():
                response = self.client.interactions.create(
                    model=self.model_name,
                    input=prompt,
                )
                return _extract_interaction_text(response).strip()
            else:
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                )
                return (response.text or "").strip()
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
