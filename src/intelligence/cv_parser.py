import json
from pydantic import BaseModel, Field
from typing import List, Optional
from google import genai
from google.genai import types

class CVProfileSchema(BaseModel):
    name: str = Field(description="Пълно име на кандидата (ако е налично)")
    title: str = Field(description="Текуща или желана позиция (напр. Senior Survey Programmer, AI Engineer)")
    summary: str = Field(description="Кратко обобщение на профила и опита (до 3 изречения)")
    core_skills: List[str] = Field(description="Списък с ключови умения (езици за програмиране, технологии, soft skills)")
    experience_years: int = Field(description="Общ брой години професионален опит (приблизително, число)")
    target_roles: List[str] = Field(description="Желани позиции (напр. AI Engineer, Python Developer)")
    languages: List[str] = Field(description="Говорими езици (напр. English, Bulgarian)")


class CVAIExtractor:
    def __init__(self, api_key: str):
        self.api_key = api_key
        if not api_key:
            raise ValueError("Gemini API Key is required for CV Extraction.")
        self.client = genai.Client(api_key=self.api_key)
        
    def parse_cv(self, raw_text: str) -> dict:
        """Parses raw CV text and returns a structured dictionary matching CVProfileSchema."""
        prompt = f"""
Ти си експерт по подбор на персонал (HR AI). Твоята задача е да анализираш следното CV и да извлечеш ключовата информация в строго структуриран формат.
Ако някои данни липсват, остави ги празни, но се опитай да извлечеш максимално много релевантна информация.

Текст от CV-то:
{raw_text}
"""
        response = self.client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CVProfileSchema,
                temperature=0.1
            ),
        )
        
        try:
            return json.loads(response.text)
        except Exception:
            return {}
