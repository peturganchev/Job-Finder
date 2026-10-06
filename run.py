#!/usr/bin/env python3
"""
Job Finder & Market Intelligence CLI Entrypoint.
Usage:
  python run.py --search       # Търси нови обяви, анализира с Gemini и известява
  python run.py --login        # Отваря видим браузър за ръчен вход в LinkedIn и jobs.bg
  python run.py --dashboard    # Стартира интерактивния локален Streamlit дашборд
  python run.py --insights     # Генерира пазарен доклад за търсените AI умения в София
  python run.py --stats        # Показва статистика за събраните обяви в конзолата
"""
import argparse
import sys
import os

# Поддръжка на UTF-8 за Windows конзолата
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import subprocess
import yaml
from pathlib import Path
from typing import List
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

# Зареждане на средата
load_dotenv()
console = Console()

from src.database.repository import JobRepository
from src.browser import BrowserManager
from src.scrapers.dev_bg import DevBgScraper
from src.scrapers.jobs_bg import JobsBgScraper
from src.scrapers.linkedin import LinkedInScraper
from src.intelligence.gemini_analyzer import GeminiJobAnalyzer
from src.intelligence.market_insights import MarketInsightsGenerator
from src.notifiers.discord import DiscordNotifier
from src.notifiers.telegram import TelegramNotifier


def load_config() -> dict:
    fpath = Path("config/filters.yaml")
    filters = {}
    if fpath.exists():
        with open(fpath, "r", encoding="utf-8") as f:
            filters = yaml.safe_load(f)

    ppath = Path("config/profile.yaml")
    profile = {}
    if ppath.exists():
        with open(ppath, "r", encoding="utf-8") as f:
            profile = yaml.safe_load(f)

    return {"filters": filters, "profile": profile}


def cmd_login():
    """Еднократен интерактивен вход за запазване на бисквитки и сесия."""
    console.print(Panel.fit("[bold green]🔑 Стартиране на интерактивен вход в браузъра...[/bold green]"))
    bm = BrowserManager(headless=False)
    bm.open_interactive_login()


def cmd_dashboard():
    """Стартира локалния Streamlit дашборд."""
    console.print(Panel.fit("[bold cyan]🚀 Стартиране на локалния дашборд в браузъра...[/bold cyan]"))
    cmd = [sys.executable, "-m", "streamlit", "run", "src/dashboard/app.py", "--server.headless=false"]
    try:
        subprocess.run(cmd)
    except KeyboardInterrupt:
        console.print("\n[yellow]Дашбордът е спрян.[/yellow]")


def cmd_insights():
    """Генерира пазарен доклад за Agentic AI роли в София."""
    console.print(Panel.fit("[bold magenta]📊 Анализиране на пазара в София и генериране на отчет...[/bold magenta]"))
    repo = JobRepository()
    analyzer = GeminiJobAnalyzer()
    insights_gen = MarketInsightsGenerator(repo, analyzer)
    report = insights_gen.generate_report(limit=40)
    console.print("\n" + report)


def cmd_stats():
    """Показва обобщена статистика."""
    repo = JobRepository()
    stats = repo.get_stats()

    table = Table(title="📊 Job Finder Статистика")
    table.add_column("Показател", style="cyan")
    table.add_column("Стойност", style="green")

    table.add_row("Общо намерени обяви", str(stats.get("total_jobs", 0)))
    table.add_row("Среден AI Мач", f"{stats.get('avg_match_score', 0)}%")
    table.add_row("Изпратени известия", str(stats.get("notified_count", 0)))

    console.print(table)

    if stats.get("by_source"):
        src_table = Table(title="🌐 По източник")
        src_table.add_column("Източник", style="yellow")
        src_table.add_column("Брой обяви", style="white")
        for s, count in stats["by_source"].items():
            src_table.add_row(s, str(count))
        console.print(src_table)


def cmd_search(sources: List[str], headless: bool = False, max_jobs: int = 15):
    """
    Основен пайплайн: Търсене -> Дедупликация -> AI Оценка -> Запис в SQLite -> Известия.
    """
    console.print(Panel.fit("[bold blue]🔍 Стартиране на търсенето за нови обяви...[/bold blue]"))

    cfg = load_config()
    keywords = cfg.get("filters", {}).get("search_queries", {}).get("primary", ["AI Engineer", "LLM", "Python"])
    min_score_for_alert = cfg.get("profile", {}).get("candidate", {}).get("min_match_score_for_alert", 60)

    repo = JobRepository()
    analyzer = GeminiJobAnalyzer()
    discord = DiscordNotifier()
    telegram = TelegramNotifier()
    browser_mgr = BrowserManager(headless=headless)

    playwright, context, page = browser_mgr.launch_session(headless=headless)

    scrapers = []
    if "dev.bg" in sources or "all" in sources:
        scrapers.append(DevBgScraper(page))
    if "jobs.bg" in sources or "all" in sources:
        scrapers.append(JobsBgScraper(page))
    if "linkedin" in sources or "all" in sources:
        scrapers.append(LinkedInScraper(page))

    new_jobs_added = 0

    try:
        for scraper in scrapers:
            console.print(f"\n[bold yellow]─── Обхождане на {scraper.name} ───[/bold yellow]")
            found = scraper.search(keywords=keywords, max_jobs=max_jobs)

            for job in found:
                # 1. Дедупликация
                if repo.exists(job.url):
                    continue

                console.print(f"📄 Нова позиция: [bold]{job.title}[/bold] @ {job.company}")

                # 2. Извличане на детайлно описание
                details = scraper.extract_job_details(job.url)
                job.description = details.get("description", "")
                if details.get("salary"):
                    job.salary = details["salary"]
                if details.get("posted_date"):
                    job.posted_date = details["posted_date"]

                # 3. AI Анализ с Google Gemini
                if job.description:
                    console.print(f"   🧠 AI анализ с Gemini за '{job.title}'...")
                    analysis = analyzer.analyze_job(
                        title=job.title,
                        company=job.company,
                        location=job.location,
                        description=job.description
                    )
                    job.match_score = analysis.get("match_score", 50)
                    job.ai_summary = analysis.get("ai_summary", "")
                    job.matched_skills = analysis.get("matched_skills", [])
                    job.missing_skills = analysis.get("missing_skills", [])
                    job.cover_letter = analysis.get("cover_letter", "")

                    score_color = "green" if job.match_score >= 70 else "yellow"
                    console.print(f"   [{score_color}]AI Мач: {job.match_score}%[/{score_color}] | {job.ai_summary[:80]}...")

                # 4. Запис в SQLite
                job_id = repo.add_job(job)
                if not job_id:
                    continue

                job.id = job_id
                new_jobs_added += 1

                # 5. Изпращане на известие ако отговаря на прага
                if (job.match_score or 0) >= min_score_for_alert:
                    notified = False
                    if discord.is_configured():
                        if discord.send_job_alert(job):
                            notified = True
                    if telegram.is_configured():
                        if telegram.send_job_alert(job):
                            notified = True

                    if notified:
                        repo.mark_as_notified(job_id)

                browser_mgr.human_delay(1.0, 2.5)

    finally:
        context.close()
        playwright.stop()

    console.print(f"\n[bold green]✅ Готово! Добавени са {new_jobs_added} нови обяви в базата данни.[/bold green]")
    if new_jobs_added > 0:
        console.print("💡 Можеш да прегледаш детайлите с: [cyan]python run.py --dashboard[/cyan]")


def main():
    parser = argparse.ArgumentParser(description="Job Finder & Market Intelligence CLI")
    parser.add_argument("--search", action="store_true", help="Стартира търсенето за нови обяви")
    parser.add_argument("--login", action="store_true", help="Отваря браузър за ръчен вход в LinkedIn и jobs.bg")
    parser.add_argument("--dashboard", action="store_true", help="Стартира Streamlit визуалния дашборд")
    parser.add_argument("--insights", action="store_true", help="Генерира пазарен доклад за Agentic AI в София")
    parser.add_argument("--stats", action="store_true", help="Показва статистика за базата данни")
    parser.add_argument("--sources", nargs="+", default=["all"], help="Източници (dev.bg, jobs.bg, linkedin или all)")
    parser.add_argument("--headless", action="store_true", help="Пуска браузъра в скрит режим")
    parser.add_argument("--max-jobs", type=int, default=15, help="Максимален брой обяви на източник за едно пускане")

    args = parser.parse_args()

    if args.login:
        cmd_login()
    elif args.dashboard:
        cmd_dashboard()
    elif args.insights:
        cmd_insights()
    elif args.stats:
        cmd_stats()
    elif args.search:
        cmd_search(sources=args.sources, headless=args.headless, max_jobs=args.max_jobs)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
