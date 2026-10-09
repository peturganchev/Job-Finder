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

from src.database.repository import get_repository, JobRepository
from src.browser import BrowserManager
from src.scrapers.dev_bg import DevBgScraper
from src.scrapers.jobs_bg import JobsBgScraper
from src.scrapers.linkedin import LinkedInScraper
from src.scrapers.himalayas import HimalayasScraper
from src.scrapers.euremotejobs import EURemoteJobsScraper
from src.scrapers.hackernews import HackerNewsScraper
from src.intelligence.gemini_analyzer import GeminiJobAnalyzer
from src.intelligence.market_insights import MarketInsightsGenerator
from src.notifiers.discord import DiscordNotifier
from src.notifiers.telegram import TelegramNotifier
from src.settings_manager import SettingsManager
from src.validator import JobValidator


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


def cmd_reanalyze(all_jobs: bool = False):
    """Извършва бълк Gemini AI анализ на обявите в базата."""
    repo = JobRepository()
    analyzer = GeminiJobAnalyzer()

    if not analyzer.is_configured():
        console.print("[red]⚠️ Липсва валиден GEMINI_API_KEY в .env файла.[/red]")
        return

    if all_jobs:
        jobs_to_analyze = repo.get_all_jobs_for_reanalysis()
    else:
        jobs_to_analyze = repo.get_jobs_without_ai_analysis()

    if not jobs_to_analyze:
        console.print("[green]✅ Всички обяви в базата данни вече имат пълен Gemini AI анализ![/green]")
        return

    console.print(Panel.fit(f"[bold magenta]🧠 Стартиране на бълк Gemini анализ за {len(jobs_to_analyze)} обяви...[/bold magenta]"))

    batch_size = 8
    updated_count = 0
    for i in range(0, len(jobs_to_analyze), batch_size):
        batch = jobs_to_analyze[i:i + batch_size]
        batch_payload = [
            {
                "job_id": j.job_id,
                "title": j.title,
                "company": j.company,
                "location": j.location,
                "description": j.description
            }
            for j in batch
        ]

        console.print(f"📦 Обработка на пакет от {len(batch)} обяви с 1 заявка към Gemini...")
        batch_analysis = analyzer.analyze_jobs_batch(batch_payload)

        for job in batch:
            res = batch_analysis.get(job.job_id, {})
            if res:
                job.match_score = res.get("match_score", 50)
                job.ai_summary = res.get("ai_summary", "")
                job.matched_skills = res.get("matched_skills", [])
                job.missing_skills = res.get("missing_skills", [])
                job.cover_letter = res.get("cover_letter", "")

                repo.update_ai_analysis(
                    job_id=job.id,
                    match_score=job.match_score,
                    ai_summary=job.ai_summary,
                    matched_skills=job.matched_skills,
                    missing_skills=job.missing_skills,
                    cover_letter=job.cover_letter
                )
                updated_count += 1
                score_color = "green" if job.match_score >= 70 else "yellow"
                console.print(f"   [{score_color}]Мач: {job.match_score}%[/{score_color}] | [bold]{job.title}[/bold] @ {job.company}")

    console.print(f"\n[bold green]✅ Успешно актуализирани {updated_count} обяви чрез бълк заявки![/bold green]")
    console.print("💡 Можеш да ги видиш в дашборда с: [cyan]python run.py --dashboard[/cyan]")


def cmd_search(
    sources: List[str],
    headless: bool = False,
    max_jobs: int = 15,
    clear_new: bool = False,
    clear_all: bool = False
):
    """
    Основен пайплайн: Търсене -> Дедупликация -> AI Оценка -> Запис в SQLite -> Известия.
    """
    console.print(Panel.fit("[bold blue]🔍 Стартиране на търсенето за нови обяви...[/bold blue]"))

    settings_mgr = SettingsManager()
    settings = settings_mgr.load()

    repo = get_repository()

    if clear_all:
        cnt = repo.delete_all_jobs(only_new=False)
        console.print(f"[yellow]🗑️ Изчистени всички {cnt} обяви от базата данни преди търсенето.[/yellow]")
    elif clear_new:
        cnt = repo.delete_all_jobs(only_new=True)
        console.print(f"[yellow]🗑️ Изчистени {cnt} съществуващи обяви със статус 'New' преди търсенето.[/yellow]")

    cfg = load_config()
    min_score_for_alert = cfg.get("profile", {}).get("candidate", {}).get("min_match_score_for_alert", 60)

    keywords = settings.search.keywords
    actual_max_jobs = max_jobs if max_jobs != 15 else settings.search.max_jobs_per_source

    if sources != ["all"]:
        active_sources = sources
    else:
        active_sources = settings_mgr.enabled_sources()

    analyzer = GeminiJobAnalyzer()
    discord = DiscordNotifier()
    telegram = TelegramNotifier()
    browser_mgr = BrowserManager(headless=headless)

    playwright, context, page = None, None, None
    if "jobs.bg" in active_sources or "himalayas" in active_sources:
        try:
            playwright, context, page = browser_mgr.launch_session(headless=headless)
        except Exception as e:
            console.print(f"[yellow]⚠️ Браузърът не е наличен ({e}). Използване на директен HTTP режим.[/yellow]")

    scrapers = []
    if "dev.bg" in active_sources:
        scrapers.append(DevBgScraper(page))
    if "jobs.bg" in active_sources:
        scrapers.append(JobsBgScraper(page))
    if "linkedin" in active_sources:
        scrapers.append(LinkedInScraper(page))
    if "euremotejobs" in active_sources:
        scrapers.append(EURemoteJobsScraper(page))
    if "hackernews" in active_sources:
        scrapers.append(HackerNewsScraper(page))
    if "himalayas" in active_sources and page is not None:
        scrapers.append(HimalayasScraper(page))

    new_jobs_to_analyze = []
    new_jobs_added = 0

    try:
        for scraper in scrapers:
            console.print(f"\n[bold yellow]─── Обхождане на {scraper.name} ───[/bold yellow]")
            found = scraper.search(keywords=keywords, max_jobs=actual_max_jobs)

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

                # Ако има заплата, да я поставим на челно място в описанието
                if job.salary and not (job.description or "").startswith("💰 Обявена заплата:"):
                    job.description = f"💰 Обявена заплата: {job.salary}\n\n" + (job.description or "")

                # 3. Запис в SQLite
                job_id = repo.add_job(job)
                if not job_id:
                    continue

                job.id = job_id
                new_jobs_added += 1
                new_jobs_to_analyze.append(job)

                browser_mgr.human_delay(1.0, 2.5)

        # 4. ПАКЕТЕН (BULK) AI АНАЛИЗ С ЕДНА ЗАЯВКА
        if new_jobs_to_analyze:
            console.print(f"\n[bold magenta]🧠 Изпращане на {len(new_jobs_to_analyze)} нови обяви за бълк AI анализ към Gemini...[/bold magenta]")

            # Разделяне на пакети по до 8 обяви за оптимално качество и квота
            batch_size = 8
            for i in range(0, len(new_jobs_to_analyze), batch_size):
                batch = new_jobs_to_analyze[i:i + batch_size]
                batch_payload = [
                    {
                        "job_id": j.job_id,
                        "title": j.title,
                        "company": j.company,
                        "location": j.location,
                        "description": j.description
                    }
                    for j in batch
                ]

                batch_analysis = analyzer.analyze_jobs_batch(batch_payload)

                for job in batch:
                    res = batch_analysis.get(job.job_id, {})
                    job.match_score = res.get("match_score", 50)
                    job.ai_summary = res.get("ai_summary", "")
                    job.matched_skills = res.get("matched_skills", [])
                    job.missing_skills = res.get("missing_skills", [])
                    job.cover_letter = res.get("cover_letter", "")

                    repo.update_ai_analysis(
                        job_id=job.id,
                        match_score=job.match_score,
                        ai_summary=job.ai_summary,
                        matched_skills=job.matched_skills,
                        missing_skills=job.missing_skills,
                        cover_letter=job.cover_letter
                    )

                    score_color = "green" if job.match_score >= 70 else "yellow"
                    console.print(f"   [{score_color}]Мач: {job.match_score}%[/{score_color}] | [bold]{job.title}[/bold] @ {job.company}")

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
                            repo.mark_as_notified(job.id)

    finally:
        if context:
            try:
                context.close()
            except Exception:
                pass
        if playwright:
            try:
                playwright.stop()
            except Exception:
                pass

    console.print(f"\n[bold green]✅ Готово! Добавени са {new_jobs_added} нови обяви в базата данни.[/bold green]")
    console.print("\n[bold green]🏁 Търсенето приключи успешно![/bold green]")
    
    if new_jobs_added > 0:
        console.print("💡 Можеш да прегледаш детайлите с: [cyan]python run.py --dashboard[/cyan]")


def cmd_cleanup():
    """Проверява всички обяви в базата данни и изтрива неактивните/изтеклите."""
    console.print(Panel.fit("[bold magenta]🧹 Проверка на активността на обявите в базата данни...[/bold magenta]"))
    repo = JobRepository()
    validator = JobValidator()

    def on_prog(current, total, msg):
        console.print(f"[{current}/{total}] {msg}")

    report = validator.validate_and_cleanup(repo, on_progress=on_prog)

    console.print(Panel.fit(
        f"[bold green]✅ Готово![/bold green]\n"
        f"📊 Проверени: [cyan]{report['total_checked']}[/cyan] | "
        f"Остават активни: [green]{report['active_count']}[/green] | "
        f"Премахнати изтекли: [red]{report['expired_count']}[/red]"
    ))

    if report["removed_jobs"]:
        console.print("\n[bold red]Премахнати неактивни обяви:[/bold red]")
        for r in report["removed_jobs"]:
            console.print(f"   ❌ [bold]{r['title']}[/bold] @ {r['company']} ({r['source']}) — [yellow]{r['reason']}[/yellow]")


def main():
    parser = argparse.ArgumentParser(description="Job Finder & Market Intelligence CLI")
    parser.add_argument("--search", action="store_true", help="Стартира търсенето за нови обяви")
    parser.add_argument("--login", action="store_true", help="Отваря браузър за ръчен вход в LinkedIn и jobs.bg")
    parser.add_argument("--dashboard", action="store_true", help="Стартира Streamlit визуалния дашборд")
    parser.add_argument("--insights", action="store_true", help="Генерира пазарен доклад за Agentic AI в София")
    parser.add_argument("--stats", action="store_true", help="Показва статистика за базата данни")
    parser.add_argument("--reanalyze", action="store_true", help="Пуска бълк Gemini анализ за обявите в базата")
    parser.add_argument("--all", action="store_true", help="Преоценява абсолютно всички обяви в базата с обновения профил")
    parser.add_argument("--cleanup", action="store_true", help="Проверява дали запазените обяви са още активни и премахва изтеклите")
    parser.add_argument("--clear-new", action="store_true", help="Изчиства обявите със статус 'new' преди търсене")
    parser.add_argument("--clear-all", action="store_true", help="Изчиства абсолютно всички обяви от базата преди търсене")
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
    elif args.reanalyze:
        cmd_reanalyze(all_jobs=args.all)
    elif args.cleanup:
        cmd_cleanup()
    elif args.search:
        cmd_search(
            sources=args.sources,
            headless=args.headless,
            max_jobs=args.max_jobs,
            clear_new=args.clear_new,
            clear_all=args.clear_all
        )
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
