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

import re
from typing import Optional

def extract_salary_num(salary_str: Optional[str]) -> Optional[int]:
    """Извлича максималното число от текста на заплатата за филтриране."""
    if not salary_str:
        return None
    # Премахваме интервали между цифри (напр. '2 500' -> '2500')
    cleaned = re.sub(r'(\d)\s+(\d)', r'\1\2', salary_str)
    nums = re.findall(r'\b\d{3,6}\b', cleaned)
    if nums:
        return max(int(n) for n in nums)
    return None

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

min_score = st.sidebar.slider("🎯 Минимално AI съвпадение (%)", 0, 100, 30)

st.sidebar.markdown("---")
st.sidebar.subheader("💰 Филтър по заплата")
only_with_salary = st.sidebar.checkbox("Само с обявена заплата", value=False)
min_salary = st.sidebar.number_input(
    "Минимална сума (EUR / BGN)",
    min_value=0,
    max_value=20000,
    value=0,
    step=250,
    help="Филтрира обяви, чиято посочена заплата достига или надвишава тази стойност."
)

search_query = st.sidebar.text_input("Търси по заглавие или компания", "")

# Табове в основния екран
tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "📋 Списък с обяви",
    "🗺️ Skill Roadmap",
    "🚀 Портфолио Проекти",
    "📊 Пазарен анализ (София & Remote)",
    "👤 Профил & CV"
])

with tab1:
    selected_status = None if status_filter == "Всички" else status_filter
    selected_source = None if source_filter == "Всички" else source_filter

    jobs = repo.get_all_jobs(
        status=selected_status,
        min_score=min_score,
        source=selected_source,
        limit=150
    )

    # Филтриране по обявена заплата
    if only_with_salary:
        jobs = [j for j in jobs if j.salary and len(j.salary.strip()) > 0]

    # Филтриране по минимална сума на заплатата
    if min_salary > 0:
        def matches_min_sal(j):
            if not j.salary:
                return False
            num = extract_salary_num(j.salary)
            return num is not None and num >= min_salary
        jobs = [j for j in jobs if matches_min_sal(j)]

    # Филтриране по текст ако има
    if search_query:
        jobs = [
            j for j in jobs
            if search_query.lower() in j.title.lower() or search_query.lower() in j.company.lower()
        ]

    st.subheader(f"Намерени {len(jobs)} обяви")

    if not jobs:
        st.info("Няма обяви, отговарящи на избраните филтри. Опитай да намалиш минималния мач или изчисти филтъра за заплата.")
    else:
        for job in jobs:
            score = job.match_score or 0
            if score >= 80:
                score_badge = f":green[**{score}% МАТЧ**]"
            elif score >= 60:
                score_badge = f":orange[**{score}% МАТЧ**]"
            else:
                score_badge = f":gray[{score}%]"

            sal_badge = f":blue[**💰 {job.salary}**] | " if job.salary else ""
            expander_title = f"{score_badge} | {sal_badge}**{job.title}** @ {job.company} — *{job.location}* [{job.source}]"
            with st.expander(expander_title, expanded=(score >= 80)):
                cols = st.columns([3, 1])

                with cols[0]:
                    if job.salary:
                        st.markdown(f"💰 **Обявена заплата:** :green[**{job.salary}**]")
                    st.markdown(f"🌐 **Линк:** [Отвори оригиналната обява]({job.url})")

                    if job.ai_summary:
                        st.markdown(f"🧠 **AI Обобщение:** {job.ai_summary}")

                    if job.matched_skills:
                        st.markdown(f"✅ **Съвпадащи умения:** `{', '.join(job.matched_skills)}`")

                    if job.missing_skills:
                        st.markdown(f"📚 **Умения за надграждане:** `{', '.join(job.missing_skills)}`")

                    if job.description:
                        with st.expander("📄 Преглед на пълното описание на обявата"):
                            st.text(job.description[:4000])

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
    st.subheader("🗺️ Пътна карта за умения: От Senior Programmer към Agentic AI Engineer")
    st.caption("Персонализиран анализ на база твоето CV (Петър Ганчев, Dynata 8+ год., ТУ-Варна Мехатроника & Роботика)")

    st.info("""
    💡 **Твоето ключово предимство (Unfair Advantage):**
    За разлика от кандидатите, идващи от чист уеб девелъпмънт, ти имаш **инженерно образование по Роботика и Мехатроника** и **8+ години скриптиране на комплексна логика в Dynata**.
    Теорията на автоматичното управление, крайните автомати (**Finite State Machines**) и обратните връзки (**Feedback Loops**) са **ТОЧНО това, което задвижва мулти-агентните AI системи (LangGraph, StateGraphs, Self-Correction)**!
    """)

    st.markdown("### 📊 Твоят напредък по ключовите Agentic AI умения")

    col_s1, col_s2 = st.columns(2)

    with col_s1:
        st.markdown("#### 1. Модерен Python & Бекенд")
        s1 = st.checkbox("Python Advanced (Type Hints, OOP, Pydantic v2)", value=True, key="sk_py")
        s2 = st.checkbox("FastAPI (Асинхронни REST ендпойнтове)", value=True, key="sk_fa")
        s3 = st.checkbox("Asyncio (Паралелни извиквания на LLM модели)", value=False, key="sk_async")

        st.markdown("#### 2. LLM Фундамент & Tool Calling")
        s4 = st.checkbox("Structured Outputs (Гарантиран Pydantic JSON изход)", value=True, key="sk_struct")
        s5 = st.checkbox("Function Calling / Tool Execution (Агентът вика API-та)", value=True, key="sk_tools")
        s6 = st.checkbox("Context Window Optimization & Prompt Engineering", value=True, key="sk_prompt")

    with col_s2:
        st.markdown("#### 3. Advanced RAG & Векторни бази")
        s7 = st.checkbox("Векторни бази (Qdrant, ChromaDB, PGVector)", value=False, key="sk_vect")
        s8 = st.checkbox("Hybrid Search (Dense вектора + Sparse ключови думи)", value=False, key="sk_hyb")
        s9 = st.checkbox("Re-ranking модели (Cohere / BGE-Reranker)", value=False, key="sk_rerank")

        st.markdown("#### 4. Агентни Архитектури & Evals")
        s10 = st.checkbox("LangGraph (State Graphs, Цикли, Human-in-the-loop)", value=False, key="sk_graph")
        s11 = st.checkbox("CrewAI / AutoGen (Ролеви мулти-агентни екипи)", value=False, key="sk_crew")
        s12 = st.checkbox("LLM Evaluations (Ragas, TruLens - измерване на точност)", value=False, key="sk_eval")

    all_skills = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12]
    completed_skills = sum(1 for s in all_skills if s)
    total_skills = len(all_skills)
    progress_ratio = completed_skills / total_skills

    st.progress(progress_ratio)
    st.markdown(f"**Текущ статус:** Усвоени **{completed_skills}** от **{total_skills}** ключови умения (**{int(progress_ratio * 100)}%**) 🚀")

    st.divider()

    st.markdown("### 📚 Препоръчана пътека с курсове (DeepLearning.AI)")
    st.markdown("""
    1. **ChatGPT Prompt Engineering for Developers** & **LangChain for LLM App Development** *(Основи на веригите)*
    2. **Building Systems with the ChatGPT API** & **LlamaIndex Developer Course** *(RAG и памет)*
    3. **AI Agents in LangGraph** & **Multi AI Agent Systems with CrewAI** *(КРИТИЧНО: Тук ставаш Agentic AI инженер!)*
    4. **Evaluating and Debugging Generative AI Models** *(Метрики, тестове и липса на халюцинации)*
    """)

with tab3:
    st.subheader("🚀 Портфолио Проекти за пазара в София")
    st.caption("Тези 4 проекта директно покриват изискванията в обявите на Avenga, Postbank, SiteGround, Cognizant и Tieto.")

    st.markdown("### 🛠️ Списък с препоръчителни MVP Проекти")

    # Проект 1: Job-Finder
    with st.container(border=True):
        st.markdown("#### 1. 🤖 Job-Finder & Market Intelligence Agent")
        st.markdown(":green[**СТАТУС: В ПРОИЗВОДСТВО (Active v1.0)**]")
        st.write("""
        **Какво прави:** Автономна агентна система, която обхожда LinkedIn, dev.bg и jobs.bg,
        дедуплицира позиции в SQLite, анализира съвпадението с Google Gemini Bulk API и визуализира в Streamlit.
        """)
        st.markdown("**Технологичен стек:** `Python 3.14`, `Playwright Stealth`, `Google Gemini 3.5 Flash`, `SQLite`, `Streamlit`, `Rich`")
        repo_url_1 = st.text_input("GitHub Репозиторий:", value="https://github.com/peturganchev/job-finder", key="repo_1")
        st.caption("✅ Локално активен в `g:/Personal Files/Projects/Job-Finder`")

    # Проект 2: Multi-Agent Dev Crew
    with st.container(border=True):
        st.markdown("#### 2. 👥 Autonomous Dev Team Multi-Agent System")
        st.markdown(":orange[**СТАТУС: СЛЕДВАЩ ЗА РАЗРАБОТКА (Next Up)**]")
        st.write("""
        **Какво прави:** Екип от 3 специализирани автономни агента (Product Owner, Python Coder, QA Engineer).
        Системата приема GitHub Issue, Product Owner агентът разписва спецификация, Coder агентът пише кода,
        а QA агентът изпълнява Pytest тестове в Docker контейнер и връща обратна връзка при грешка до 100% успех.
        """)
        st.markdown("**Технологичен стек:** `CrewAI` / `LangGraph`, `FastAPI`, `Docker`, `GitHub REST API`, `Pytest`")
        repo_url_2 = st.text_input("GitHub Репозиторий:", value="https://github.com/peturganchev/multi-agent-dev-crew", key="repo_2")
        st.caption("🎯 Насочен към: Аутсорсинг лидери в София (Avenga, Cognizant, Tieto Tech Consulting)")

    # Проект 3: Compliance RAG Auditor
    with st.container(border=True):
        st.markdown("#### 3. 🏦 Enterprise Compliance & Financial RAG Auditor")
        st.markdown(":blue[**СТАТУС: ПЛАНИРАН (Roadmap)**]")
        st.write("""
        **Какво прави:** Агент за финансови/юридически документи. Използва Hybrid Search (Dense вектора + BM25) с Cohere Re-ranker.
        Включва втори вътрешен одитиращ агент, който проверява всяко твърдение спрямо точния параграф в източника преди генериране на отговор.
        """)
        st.markdown("**Технологичен стек:** `LlamaIndex`, `Qdrant` / `PGVector`, `FastAPI`, `Ragas Evals`")
        repo_url_3 = st.text_input("GitHub Репозиторий:", value="https://github.com/peturganchev/compliance-rag-auditor", key="repo_3")
        st.caption("🎯 Насочен към: Банков и финтех сектор в София (Postbank, UBB / DZI, Paysafe, Nexo)")

    # Проект 4: Customer Support Hub
    with st.container(border=True):
        st.markdown("#### 4. 🎯 AI Customer Support Hub с Real-time Evals")
        st.markdown(":blue[**СТАТУС: ПЛАНИРАН (Roadmap)**]")
        st.write("""
        **Какво прави:** Автономен агент за обслужване на клиенти с Tool Calling (проверка на поръчки, статус на акаунт).
        Включва Observability табло, което следи латентност, удовлетвореност на отговорите и открива халюцинации в реално време.
        """)
        st.markdown("**Технологичен стек:** `LangChain`, `TruLens`, `FastAPI`, `Streamlit`, `SQLite`")
        repo_url_4 = st.text_input("GitHub Репозиторий:", value="https://github.com/peturganchev/support-eval-hub", key="repo_4")
        st.caption("🎯 Насочен към: Продуктови технологични компании (SiteGround, First. Best in Sports)")

    st.divider()
    st.subheader("🔗 GitHub Live Tracker (Подготовка за интеграция)")
    st.write("Когато качиш проектите в твоя GitHub акаунт, тук ще свържем GitHub REST API и ще следим брой коммити, stars, отворени PRs и статус на живо!")

with tab4:
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

with tab5:
    st.subheader("👤 Твоят профил & CV (Петър Ганчев)")
    st.markdown("""
    * **Име:** Петър Ганчев (Petur Ganchev)
    * **Контакти:** `peturganchev93@gmail.com` | [LinkedIn Профил](https://www.linkedin.com/in/petur-ganchev)
    * **Текуща позиция:** Senior Survey Programmer @ **Dynata** (8+ години корпоративен опит)
    * **Образование:** Бакалавър по **Мехатроника, Роботика и Автоматизация** (Технически Университет - Варна)
    * **Цел:** Преквалификация към **Agentic AI Engineer**
    """)

    st.markdown("### 📄 Пълен конфигурационен файл (config/profile.yaml)")
    profile_path = Path("config/profile.yaml")
    if profile_path.exists():
        with open(profile_path, "r", encoding="utf-8") as f:
            st.code(f.read(), language="yaml")
    st.caption("Този файл се използва автоматично от Google Gemini за персонализирана оценка на обявите и генериране на мотивационни писма.")
