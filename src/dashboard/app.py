"""
Streamlit Web Dashboard for Job Finder.
Provides a visual command center to manage applications, view AI summaries,
track pipeline status, and explore market insights.
"""
import streamlit as st
import pandas as pd
from pathlib import Path
import sys
import os

# Добавяне на главната директория към пътя за импорти
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from src.database.repository import JobRepository
from src.database.models import ApplicationStatus
from src.intelligence.gemini_analyzer import GeminiJobAnalyzer
from src.intelligence.market_insights import MarketInsightsGenerator

st.set_page_config(
    page_title="Job Finder AI • Dashboard",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Инициализиране на компонентите
@st.cache_resource
def get_repo():
    return JobRepository()

repo = get_repo()
analyzer = GeminiJobAnalyzer()
insights_gen = MarketInsightsGenerator(repo, analyzer)

# Заглавие
st.title("🤖 Job Finder & Market Intelligence")
st.caption("Автономен център за наблюдение на Agentic AI & Python позиции в София и Remote")

# Метрики в горната част
stats = repo.get_stats()
col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric("📋 Всички обяви", stats.get("total_jobs", 0))
with col2:
    st.metric("🎯 Среден AI Мач", f"{stats.get('avg_match_score', 0)}%")
with col3:
    applied_count = stats.get("by_status", {}).get("applied", 0)
    st.metric("📬 Подадени CV-та", applied_count)
with col4:
    interview_count = stats.get("by_status", {}).get("interview", 0)
    st.metric("🎉 Покани за интервю", interview_count)

st.divider()

# Страничен панел с филтри
st.sidebar.header("🔍 Филтри")

status_filter = st.sidebar.selectbox(
    "Статус на кандидатстване",
    options=["Всички"] + [s.value for s in ApplicationStatus],
    index=0
)

source_filter = st.sidebar.selectbox(
    "Източник",
    options=["Всички", "dev.bg", "jobs.bg", "linkedin"],
    index=0
)

min_score = st.sidebar.slider("Минимално AI съвпадение (%)", 0, 100, 30)
search_query = st.sidebar.text_input("Търси по заглавие или компания", "")

# Табове в основния екран
tab1, tab2, tab3 = st.tabs(["📋 Списък с обяви", "📊 Пазарен анализ (София & Remote)", "⚙️ Профил"])

with tab1:
    selected_status = None if status_filter == "Всички" else status_filter
    selected_source = None if source_filter == "Всички" else source_filter

    jobs = repo.get_all_jobs(
        status=selected_status,
        min_score=min_score,
        source=selected_source,
        limit=150
    )

    # Филтриране по текст ако има
    if search_query:
        jobs = [
            j for j in jobs
            if search_query.lower() in j.title.lower() or search_query.lower() in j.company.lower()
        ]

    st.subheader(f"Намерени {len(jobs)} обяви")

    if not jobs:
        st.info("Няма обяви, отговарящи на избраните филтри. Опитай да намалиш минималния мач или пусни ново търсене.")
    else:
        for job in jobs:
            score = job.match_score or 0
            if score >= 80:
                score_badge = f":green[**{score}% МАТЧ**]"
            elif score >= 60:
                score_badge = f":orange[**{score}% МАТЧ**]"
            else:
                score_badge = f":gray[{score}%]"

            expander_title = f"{score_badge} | **{job.title}** @ {job.company} — *{job.location}* [{job.source}]"
            with st.expander(expander_title, expanded=(score >= 80)):
                cols = st.columns([3, 1])

                with cols[0]:
                    if job.salary:
                        st.markdown(f"💰 **Заплата:** `{job.salary}`")
                    st.markdown(f"🌐 **Линк:** [Отвори оригиналната обява]({job.url})")

                    if job.ai_summary:
                        st.markdown(f"🧠 **AI Обобщение:** {job.ai_summary}")

                    if job.matched_skills:
                        st.markdown(f"✅ **Съвпадащи умения:** `{', '.join(job.matched_skills)}`")

                    if job.missing_skills:
                        st.markdown(f"📚 **Умения за надграждане:** `{', '.join(job.missing_skills)}`")

                    if job.cover_letter:
                        with st.popover("✉️ Виж модел на мотивационно писмо"):
                            st.write(job.cover_letter)

                with cols[1]:
                    st.markdown("### Статус")
                    current_idx = list(ApplicationStatus._value2member_map_.keys()).index(job.status) if job.status in ApplicationStatus._value2member_map_ else 0
                    new_status = st.selectbox(
                        "Промени статус",
                        options=[s.value for s in ApplicationStatus],
                        index=current_idx,
                        key=f"status_select_{job.id}"
                    )
                    if new_status != job.status:
                        repo.update_status(job.id, ApplicationStatus(new_status))
                        st.success(f"Обновено на '{new_status}'!")
                        st.rerun()

with tab2:
    st.subheader("📈 Пазарен отчет за изискванията в София")
    st.write("Този модул синтезира какво търсят работодателите в София и Remote за Agentic AI роли.")

    if st.button("🔄 Генерирай нов пазарен отчет"):
        with st.spinner("Анализиране на пазара..."):
            report_text = insights_gen.generate_report(limit=40)
            st.success("Отчетът е обновен успешно!")
            st.markdown(report_text)
    else:
        latest_report_file = Path("reports/market_insights_latest.md")
        if latest_report_file.exists():
            with open(latest_report_file, "r", encoding="utf-8") as f:
                content = f.read()
            st.markdown(content)
        else:
            st.info("Все още няма генериран отчет. Натисни бутона по-горе за да създадеш първия отчет!")

with tab3:
    st.subheader("👤 Твоят профил & DeepLearning.AI Roadmap")
    profile_path = Path("config/profile.yaml")
    if profile_path.exists():
        with open(profile_path, "r", encoding="utf-8") as f:
            st.code(f.read(), language="yaml")
    st.caption("Можеш да редактираш файла config/profile.yaml по всяко време директно в проекта.")
