"""
Market Insights Generator.
Aggregates scraped AI positions in Sofia/Remote and uses Google Gemini
to extract in-demand skills, tech stacks, and portfolio project ideas
to guide the user's DeepLearning.AI learning roadmap.
"""
import os
import sys
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from src.database.repository import JobRepository
from src.intelligence.gemini_analyzer import GeminiJobAnalyzer


class MarketInsightsGenerator:
    def __init__(self, repo: JobRepository, analyzer: GeminiJobAnalyzer):
        self.repo = repo
        self.analyzer = analyzer
        self.reports_dir = Path("reports")
        self.reports_dir.mkdir(parents=True, exist_ok=True)

    def generate_report(self, limit: int = 50) -> str:
        """
        Генерира подробен пазарен анализ на база събраните обяви в София и Remote.
        """
        raw_jobs = self.repo.get_all_descriptions_for_market_analysis(limit=limit)
        stats = self.repo.get_stats()

        if not raw_jobs:
            return "⚠️ Няма достатъчно обяви в базата данни за генериране на пазарен отчет. Първо стартирай 'python run.py --search'."

        print(f"📊 Анализиране на {len(raw_jobs)} обяви за извличане на пазарни инсайти...")

        # Ако Gemini е конфигуриран, генерираме задълбочен AI доклад
        if self.analyzer.is_configured():
            report_content = self._generate_ai_report(raw_jobs, stats)
        else:
            report_content = self._generate_heuristic_report(raw_jobs, stats)

        # Записване на отчета във файл
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
        report_file = self.reports_dir / f"market_insights_{timestamp}.md"
        latest_file = self.reports_dir / "market_insights_latest.md"

        with open(report_file, "w", encoding="utf-8") as f:
            f.write(report_content)

        with open(latest_file, "w", encoding="utf-8") as f:
            f.write(report_content)

        print(f"✅ Пазарният отчет е записан в: {latest_file}")
        return report_content

    def _generate_ai_report(self, jobs: List[Dict[str, str]], stats: Dict[str, Any]) -> str:
        """Използва Gemini за обобщение на пазарните изисквания и съвети за обучение."""
        job_summaries = []
        for i, j in enumerate(jobs[:30], 1):
            job_summaries.append(f"[{i}] {j['title']} @ {j['company']} ({j['location']}):\n{j['description'][:600]}\n")

        all_text = "\n---\n".join(job_summaries)

        prompt = f"""
Ти си водещ AI директор и кариерен ментор за софтуерни инженери в България.
Кандидатът се преквалифицира в 'Agentic AI Engineer' и следва курсове в DeepLearning.AI.
Той иска да знае какви са реалните пазарни изисквания в София и Remote и какво портфолио да си изгради.

Ето извадка от актуални обяви за работа в София / България / Remote:
{all_text}

НАПРАВИ ИЗЧЕРПАТЕЛЕН ПАЗАРЕН ДОКЛАД В MARKDOWN ФОРМАТ СЪС СЛЕДНИТЕ СЕКЦИИ:
1. 📈 Пазарна картина в София: Търсене на AI / LLM / Python кадри в момента.
2. 🛠️ Топ 10 най-търсени технологии и библиотеки (LangChain, LlamaIndex, CrewAI, AutoGen, RAG, Vector DBs, FastAPI, etc. - с коментар за всяка).
3. 🎯 Ключови концепции и архитектурни модели, които компаниите очакват (Tool Calling, Multi-Agent, Evals, Memory, Fine-Tuning).
4. 💡 3 Конкретни идеи за Портфолио проекти (MVP проекти, с които кандидатът ще изпъкне пред работодателите).
5. 📚 Препоръчителен план за учене през DeepLearning.AI курсовете.
"""

        from src.intelligence.gemini_analyzer import is_agent_model, _extract_interaction_text

        candidate_models = [self.analyzer.model_name, "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview"]
        seen_models = set()
        models_to_try = [m for m in candidate_models if not (m in seen_models or seen_models.add(m))]

        raw_report_text = None
        for m in models_to_try:
            try:
                if is_agent_model(m):
                    resp = self.analyzer.client.interactions.create(
                        model=m,
                        input=prompt
                    )
                    raw_report_text = _extract_interaction_text(resp).strip()
                else:
                    resp = self.analyzer.client.models.generate_content(
                        model=m,
                        contents=prompt
                    )
                    if resp and resp.text:
                        raw_report_text = resp.text.strip()
                if raw_report_text:
                    break
            except Exception as e:
                print(f"⚠️ Модел {m} върна грешка при пазарен анализ: {e}")
                continue

        if raw_report_text:
            header = f"# 🚀 Анализ на пазара за Agentic AI роли (София & Remote)\n*Генериран на: {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n\n"
            return header + raw_report_text

        return self._generate_heuristic_report(jobs, stats)

    def _generate_heuristic_report(self, jobs: List[Dict[str, str]], stats: Dict[str, Any]) -> str:
        """Базов пазарен доклад при липса на Gemini API ключ."""
        tech_counter = {}
        target_techs = [
            "Python", "LangChain", "LlamaIndex", "CrewAI", "AutoGen",
            "RAG", "Vector", "FastAPI", "Docker", "AWS", "Azure",
            "PostgreSQL", "PyTorch", "Prompt Engineering", "OpenAI"
        ]

        for j in jobs:
            text = (j["title"] + " " + j["description"]).lower()
            for t in target_techs:
                if t.lower() in text:
                    tech_counter[t] = tech_counter.get(t, 0) + 1

        sorted_tech = sorted(tech_counter.items(), key=lambda x: x[1], reverse=True)

        lines = [
            f"# 🚀 Анализ на пазара за Agentic AI роли (София & Remote)",
            f"*Генериран на: {datetime.now().strftime('%Y-%m-%d %H:%M')}*",
            f"",
            f"### 📊 Статистика на базата:",
            f"- Общо събрани обяви: **{stats.get('total_jobs', len(jobs))}**",
            f"- Анализирани позиции в този отчет: **{len(jobs)}**",
            f"",
            f"### 🛠️ Честота на споменаване на технологиите в София/Remote:",
        ]

        for tech, count in sorted_tech:
            pct = round((count / len(jobs)) * 100) if jobs else 0
            lines.append(f"- **{tech}**: в {count} обяви (~{pct}%)")

        lines.extend([
            "",
            "### 💡 Препоръки за обучение (DeepLearning.AI) и портфолио:",
            "1. **RAG & Vector Search:** Започни с изграждане на RAG система върху фирмена документация с Python и FastAPI.",
            "2. **Multi-Agent Systems:** Изгради проект с CrewAI или AutoGen, където 2-3 агента си сътрудничат за решаване на бизнес казус.",
            "3. **Tool Calling & Automation:** Практикувай свързване на LLM с реални външни API-та.",
            "",
            "> ℹ️ *За пълен дълбок анализ и персонализирани насоки от AI, добави своя GEMINI_API_KEY в .env файла.*"
        ])

        return "\n".join(lines)
