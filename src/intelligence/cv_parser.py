import json
from pydantic import BaseModel, Field
from typing import List, Optional
from google import genai
from google.genai import types

class CVProfileSchema(BaseModel):
    name: str = Field(description="Пълно име на кандидата (ако е налично)")
    current_title: str = Field(description="Настояща или последна заемана позиция от CV (напр. Senior Survey Programmer)")
    summary: str = Field(description="Кратко обобщение на досегашния опит (до 3 изречения)")
    current_skills: List[str] = Field(description="Списък с придобити практически умения от CV (езици, технологии)")
    experience_years: int = Field(description="Общ брой години професионален опит (число)")
    target_roles: List[str] = Field(default=[], description="Препоръчани или желани бъдещи роли (напр. AI Engineer, Python Developer)")
    languages: List[str] = Field(default=[], description="Говорими езици (напр. English, Bulgarian)")


import time
from src.intelligence.gemini_analyzer import is_agent_model, _clean_json_text, _extract_interaction_text

class CVAIExtractor:
    def __init__(self, api_key: str, model_name: Optional[str] = None):
        self.api_key = api_key
        if not api_key:
            raise ValueError("Gemini API Key is required for CV Extraction.")
        self.model_name = model_name or "gemini-3.8-flash"
        self.client = genai.Client(api_key=self.api_key)
        
    def parse_cv(self, raw_text: str) -> dict:
        """Parses raw CV text and returns a structured dictionary matching CVProfileSchema."""
        prompt = f"""
Ти си експерт по подбор на персонал (HR AI). Твоята задача е да анализираш следното CV и да извлечеш ключовата информация в строго структуриран формат.
Върни САМО валиден JSON обект със следните полета: name, current_title, summary, current_skills, experience_years, target_roles, languages.
Ако някои данни липсват, остави ги празни, но се опитай да извлечеш максимално много релевантна информация.

Текст от CV-то:
{raw_text}
"""
        candidate_models = [self.model_name, "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview", "gemini-3.5-flash"]
        seen = set()
        models_to_try = [m for m in candidate_models if not (m in seen or seen.add(m))]

        for m in models_to_try:
            try:
                raw_text_out = None
                if is_agent_model(m):
                    response = self.client.interactions.create(
                        model=m,
                        input=prompt,
                        response_mime_type="application/json",
                        response_format={
                            "type": "text",
                            "mime_type": "application/json",
                            "schema": CVProfileSchema.model_json_schema(),
                        },
                        generation_config={"temperature": 0.1},
                    )
                    raw_text_out = _extract_interaction_text(response)
                else:
                    response = self.client.models.generate_content(
                        model=m,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=CVProfileSchema,
                            temperature=0.1
                        ),
                    )
                    if response:
                        raw_text_out = response.text

                if raw_text_out:
                    cleaned = _clean_json_text(raw_text_out)
                    data = json.loads(cleaned)
                    if isinstance(data, dict) and data:
                        return data
            except Exception as e:
                print(f"⚠️ Модел {m} върна грешка при парсване на CV: {e}")
                time.sleep(1)
                continue
        return {}
