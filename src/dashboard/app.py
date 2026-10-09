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

from src.database.repository import get_repository
from src.database.models import ApplicationStatus
from src.intelligence.gemini_analyzer import GeminiJobAnalyzer
from src.intelligence.market_insights import MarketInsightsGenerator
from src.settings_manager import SettingsManager
from src.validator import JobValidator
from src.auth import (
    is_auth_enabled,
    get_current_user,
    render_auth_view,
    sign_out_user,
    load_user_profile,
    save_user_profile
)
import subprocess

st.set_page_config(
    page_title="Job Finder AI • Dashboard",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Скриване на излишни Streamlit менюта, футъри и бутони за чист нативен изглед на цял екран
st.markdown("""
<style>
    #MainMenu {visibility: hidden;}
    footer {display: none !important; visibility: hidden !important;}
    header[data-testid="stHeader"] {display: none !important;}
    .stDeployButton {display: none !important;}
    [data-testid="stToolbar"] {display: none !important; visibility: hidden !important;}
    [data-testid="stDecoration"] {display: none !important; visibility: hidden !important;}
    div[class*="viewerBadge"] {display: none !important;}
    div[class*="embeddedApp"] {border: none !important;}
    [data-testid="stEmbedFooter"] {display: none !important; visibility: hidden !important;}
    .viewerBadge_container__1QSob {display: none !important;}
    
    /* Оптимизиран отстъп на съдържанието */
    .block-container {
        padding-top: 1.5rem !important;
        padding-bottom: 2rem !important;
        max-width: 95% !important;
    }
</style>
""", unsafe_allow_html=True)

# Проверка за автентикация (ако Supabase е активен)
current_user = None
user_profile = {}
if is_auth_enabled():
    current_user = get_current_user()
    if not current_user:
        render_auth_view()
        st.stop()
    user_profile = load_user_profile(current_user["id"])

# Инициализиране на хранилището (за текущия потребител)
repo = get_repository(user_id=current_user["id"] if current_user else None)

# Личен API ключ и настройки на потребителя за Gemini
user_gemini_key = user_profile.get("gemini_api_key") if current_user else None
user_gemini_model = user_profile.get("gemini_model") if current_user else None
user_profile_data = user_profile.get("profile_data") if current_user else None

analyzer = GeminiJobAnalyzer(
    api_key=user_gemini_key, 
    model_name=user_gemini_model,
    profile_data=user_profile_data
)
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

# Страничен панел с профил и филтри
if current_user:
    st.sidebar.markdown(f"👤 **{current_user.get('email')}**")
    if st.sidebar.button("🚪 Изход от профила", use_container_width=True):
        sign_out_user()
    st.sidebar.markdown("---")

st.sidebar.header("🔍 Филтри")

status_filter = st.sidebar.selectbox(
    "Статус на кандидатстване",
    options=["Всички"] + [s.value for s in ApplicationStatus],
    index=0
)

source_filter = st.sidebar.selectbox(
    "Източник",
    options=["Всички", "dev.bg", "jobs.bg", "linkedin", "himalayas", "euremotejobs", "hackernews"],
    index=0
)

# Филтър по ключова дума на търсене
all_saved_keywords = repo.get_all_search_keywords()
keyword_options = ["Всички"] + all_saved_keywords
keyword_filter = st.sidebar.selectbox(
    "🔑 Ключова дума (Позиция)",
    options=keyword_options,
    index=0,
    help="Филтрира обявите според конкретното търсене, с което са били намерени."
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

st.sidebar.markdown("---")
only_remote = st.sidebar.checkbox("🌐 Само Remote", value=False, help="Показва само обяви, които са дистанционни")

# Табове в основния екран
tab1, tab_search, tab2, tab3, tab4, tab5, tab_settings = st.tabs([
    "📋 Списък с обяви",
    "🔍 Търсене",
    "🗺️ Skill Roadmap",
    "🚀 Портфолио Проекти",
    "📊 Пазарен анализ",
    "👤 Профил & CV",
    "⚙️ Настройки"
])

with tab1:
    selected_status = None if status_filter == "Всички" else status_filter
    selected_source = None if source_filter == "Всички" else source_filter
    selected_kw = None if keyword_filter == "Всички" else keyword_filter

    jobs = repo.get_all_jobs(
        status=selected_status,
        min_score=min_score,
        source=selected_source,
        search_keyword=selected_kw,
        limit=200
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

    if only_remote:
        remote_kws = ["remote", "дистанцион", "wfh", "anywhere"]
        def is_remote(j):
            loc = (j.location or "").lower()
            tit = (j.title or "").lower()
            return any(rk in loc or rk in tit for rk in remote_kws)
        jobs = [j for j in jobs if is_remote(j)]

    col_h1, col_h2 = st.columns([3, 1])
    with col_h1:
        st.subheader(f"Намерени {len(jobs)} обяви")
    with col_h2:
        if st.button("🧹 Провери за изтекли", help="Обхожда показаните обяви и премахва тези, които са свалени или неактивни"):
            with st.status("Проверка на активността на обявите...", expanded=True) as status_box:
                validator = JobValidator()
                progress_bar = st.progress(0.0)
                def on_p(curr, tot, msg):
                    progress_bar.progress(curr / tot)
                    status_box.write(f"[{curr}/{tot}] {msg}")
                res = validator.validate_and_cleanup(repo, jobs, on_progress=on_p)
                status_box.update(label=f"✅ Готово! Премахнати {res['expired_count']} изтекли позиции.", state="complete")
                if res['expired_count'] > 0:
                    st.success(f"Премахнати {res['expired_count']} неактивни обяви!")
                else:
                    st.info("Всички проверени обяви са активни.")
                time.sleep(1)
                st.rerun()

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

with tab_search:
    st.subheader("🔍 Търсене на нови обяви")
    
    settings_mgr = SettingsManager()
    settings = settings_mgr.load()
    
    # Прилагане на потребителски настройки за черния списък (ако има такива)
    if current_user and user_profile:
        if "blacklist_titles" in user_profile:
            settings.blacklist_title = user_profile["blacklist_titles"]
        if "blacklist_companies" in user_profile:
            settings.blacklist_companies = user_profile["blacklist_companies"]
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### 🎯 Параметри за търсене")
        keywords_text = st.text_area(
            "Ключови думи (по 1 на ред)",
            value="\n".join(settings.search.keywords),
            height=150
        )
        
        location = st.text_input("Локация (Основни сайтове)", value=settings.search.location, help="За LinkedIn, dev.bg, jobs.bg. Напр: Bulgaria, Sofia")
        
        remote_loc_opts = ["Worldwide", "European Union", "Europe", "UK", "USA"]
        curr_rem_loc = getattr(settings.search, "remote_location", "Worldwide")
        if curr_rem_loc not in remote_loc_opts:
            remote_loc_opts.insert(0, curr_rem_loc)
            
        remote_location = st.selectbox(
            "Локация (Remote сайтове)",
            options=remote_loc_opts,
            index=remote_loc_opts.index(curr_rem_loc),
            help="Филтър за Remote платформите (Remotive, WeWorkRemotely)."
        )
        
        max_jobs = st.slider(
            "Максимум обяви на сайт (за едно търсене)",
            min_value=1, max_value=50, value=settings.search.max_jobs_per_source
        )
        
        st.markdown("### 🚫 Черен списък (Blacklist)")
        st.caption("Обяви с тези думи в заглавието/компанията се игнорират.")
        
        bl_titles = st.text_area("Изключи по заглавие", value="\n".join(settings.blacklist_title), height=80)
        bl_comps = st.text_area("Изключи по компания", value="\n".join(settings.blacklist_companies), height=80)
        
        clean_choice = st.radio(
            "🧹 Почистване преди търсене:",
            options=[
                "Запази всички съществуващи обяви",
                "Изчисти само необработените ('New')",
                "Изчисти абсолютно всички обяви (Пълен ресет)"
            ],
            index=0,
            help="Позволява да изчистиш старите обяви при ново търсене, за да виждаш само новите резултати."
        )

        if st.button("💾 Запази параметрите", key="save_search_params"):
            settings.search.keywords = [k.strip() for k in keywords_text.split("\n") if k.strip()]
            settings.search.location = location
            settings.search.remote_location = remote_location
            settings.search.max_jobs_per_source = max_jobs
            settings.blacklist_title = [k.strip() for k in bl_titles.split("\n") if k.strip()]
            settings.blacklist_companies = [k.strip() for k in bl_comps.split("\n") if k.strip()]
            
            settings_mgr.save(settings)
            
            if current_user:
                save_user_profile(current_user["id"], {
                    "blacklist_titles": settings.blacklist_title,
                    "blacklist_companies": settings.blacklist_companies
                })
                
            st.success("Параметрите са запазени!")
            
    with col2:
        st.markdown("### 🌐 Източници за търсене")
        st.markdown("**🇧🇬 Локални / Основни:**")
        c1, c2, c3 = st.columns(3)
        with c1:
            use_devbg = st.checkbox("dev.bg", value=settings.sources.dev_bg, key="src_devbg")
        with c2:
            use_jobsbg = st.checkbox("jobs.bg", value=settings.sources.jobs_bg, key="src_jobsbg")
        with c3:
            use_linkedin = st.checkbox("LinkedIn", value=settings.sources.linkedin, key="src_link")
            
        st.markdown("**🌍 Глобални (100% Remote):**")
        c4, c5, c6 = st.columns(3)
        with c4:
            use_himalayas = st.checkbox("Himalayas", value=settings.sources.himalayas, key="src_him")
        with c5:
            use_euremote = st.checkbox("EU Remote", value=settings.sources.euremotejobs, key="src_eur")
        with c6:
            use_hackernews = st.checkbox("HackerNews", value=settings.sources.hackernews, key="src_hn")
            
        st.markdown("---")
        st.markdown("### ▶️ Стартиране")
        
        if settings_mgr.get_api_key_source() == "none":
            st.warning("⚠️ Не е конфигуриран Gemini API ключ. Оценките ще бъдат базови (евристични). Добави ключ в таб ⚙️ Настройки.")
            
        lock_file = Path("data/.search.lock")
        is_running = lock_file.exists()
        
        if is_running:
            st.warning("🔄 Търсенето вече се изпълнява в момента. Моля, изчакай...")
            if st.button("🧹 Изчисти блокировката (Force Unlock)"):
                lock_file.unlink(missing_ok=True)
                st.rerun()
        else:
            has_sources = use_devbg or use_jobsbg or use_linkedin or use_himalayas or use_euremote or use_hackernews
            if not has_sources:
                st.error("Не са избрани източници за търсене!")
            else:
                if st.button("▶️ Стартирай търсене сега", type="primary", use_container_width=True):
                    # Save the latest source selections right before running
                    settings.sources.dev_bg = use_devbg
                    settings.sources.jobs_bg = use_jobsbg
                    settings.sources.linkedin = use_linkedin
                    settings.sources.himalayas = use_himalayas
                    settings.sources.euremotejobs = use_euremote
                    settings.sources.hackernews = use_hackernews
                    settings_mgr.save(settings)
                    
                    # We create a lock file
                    lock_file.touch()
                    
                    log_file = Path("data/search.log")
                    with open(log_file, "w", encoding="utf-8") as f:
                        f.write("Стартиране на търсенето...\n")
                    
                    cmd = [sys.executable, "run.py", "--search"]
                    if clean_choice == "Изчисти само необработените ('New')":
                        cmd.append("--clear-new")
                    elif clean_choice == "Изчисти абсолютно всички обяви (Пълен ресет)":
                        cmd.append("--clear-all")
                    
                    wrapper_script = f"""
import subprocess
import sys
from pathlib import Path
try:
    with open('{log_file.as_posix()}', 'a', encoding='utf-8') as f:
        subprocess.run({cmd}, stdout=f, stderr=subprocess.STDOUT)
finally:
    Path('{lock_file.as_posix()}').unlink(missing_ok=True)
"""
                    wrapper_path = Path("data/run_wrapper.py")
                    wrapper_path.write_text(wrapper_script, encoding="utf-8")
                    subprocess.Popen([sys.executable, str(wrapper_path)])
                    st.success("Търсенето започна във фонов режим! Можеш да следиш лога по-долу.")
                    st.rerun()
                    
        # Auto-refresh and Log display logic
        log_file = Path("data/search.log")
        
        if is_running:
            import streamlit.components.v1 as components
            # This triggers a Streamlit rerun every 3 seconds while is_running is True
            components.html(
                """
                <script>
                setTimeout(function() {
                    window.parent.document.dispatchEvent(new Event('streamlit:rerun'));
                }, 3000);
                </script>
                """,
                height=0
            )
            st.info("🔄 Търсенето се изпълнява във фонов режим. Логът се обновява автоматично...")
        elif log_file.exists():
            st.success("✅ Търсенето приключи! Можеш да видиш резултатите в таб 'Списък с обяви'.")
            
        if log_file.exists():
            st.markdown("### Лог на изпълнението")
            log_content = log_file.read_text(encoding="utf-8")
            log_lines = log_content.splitlines()[-40:]
            st.code("\n".join(log_lines), language="text")
            
            if is_running:
                st.button("🔄 Ръчно обновяване")
            else:
                if st.button("🗑️ Скрий лога"):
                    log_file.unlink(missing_ok=True)
                    st.rerun()

        st.markdown("---")
        st.markdown("### 🔄 Проверка на активността (Рефреш)")
        st.caption("Минава през всички събрани обяви в базата данни и автоматично премахва тези, които вече са свалени, изтекли или имат намерен човек.")
        if st.button("🧹 Провери и премахни изтеклите обяви", key="btn_validate_tab_search"):
            with st.status("Проверка на активността на обявите...", expanded=True) as status_box:
                validator = JobValidator()
                all_db_jobs = repo.get_all_jobs(limit=1000)
                progress_bar = st.progress(0.0)
                def on_p_ts(curr, tot, msg):
                    progress_bar.progress(curr / tot)
                    status_box.write(f"[{curr}/{tot}] {msg}")
                res = validator.validate_and_cleanup(repo, all_db_jobs, on_progress=on_p_ts)
                status_box.update(label=f"✅ Готово! Премахнати {res['expired_count']} изтекли позиции.", state="complete")
                if res['expired_count'] > 0:
                    st.success(f"Премахнати {res['expired_count']} неактивни обяви! Остават {res['active_count']} активни.")
                else:
                    st.info("Всички проверени обяви са активни.")
                time.sleep(1)
                st.rerun()

with tab2:
    st.subheader("🗺️ Пътна карта за самоподготовка: Agentic Systems Developer")
    st.caption("Базирана на съвпаденията между DeepLearning.AI и програмата на Sirma Academy за Agentic AI роли")

    st.info("""
    💡 **Твоето ключово инженерно предимство (Unfair Advantage):**
    За разлика от кандидатите, идващи от стандартен уеб девелъпмънт, ти имаш **инженерно образование по Роботика и Мехатроника (ТУ-Варна)** и **8+ години програмиране на комплексна логика в Dynata**.
    Теорията на автоматичното управление, крайните автомати (**Finite State Machines**) и обратните връзки (**Feedback Loops**) са **ТОЧНО фундамента, върху който стъпват съвременните агентни графи (LangGraph, StateGraphs, Reflection Loops)**!
    """)

    settings_mgr = SettingsManager()
    settings = settings_mgr.load()
    progress = settings.roadmap_progress

    st.markdown("### 📊 Твоят напредък по 3-те нива на специализация")

    col_s1, col_s2, col_s3 = st.columns(3)

    with col_s1:
        st.markdown("#### 🟢 Ниво 1: Foundation (Основи)")
        s1 = st.checkbox("Prompt Eng & Context Strategy", value=progress.get("sk_p1", True), key="sk_p1")
        s2 = st.checkbox("AI Python & Pydantic Validation", value=progress.get("sk_p2", True), key="sk_p2")
        s3 = st.checkbox("Building Systems with LLM APIs", value=progress.get("sk_p3", True), key="sk_p3")
        s4 = st.checkbox("LangChain Chaining & Chat with Data", value=progress.get("sk_p4", True), key="sk_p4")

    with col_s2:
        st.markdown("#### 🟡 Ниво 2: Core Track (Агентно Ядро)")
        s5 = st.checkbox("4-те Модела на Andrew Ng (Reflection, Tools, Plan, Multi-Agent)", value=progress.get("sk_p5", True), key="sk_p5")
        s6 = st.checkbox("Function & Tool Calling в код", value=progress.get("sk_p6", True), key="sk_p6")
        s7 = st.checkbox("Multi-Agent екипи с CrewAI", value=progress.get("sk_p7", False), key="sk_p7")
        s8 = st.checkbox("Event-Driven & Human-in-the-Loop Flows", value=progress.get("sk_p8", False), key="sk_p8")

    with col_s3:
        st.markdown("#### 🔴 Ниво 3: Role Specialization (Agentic Systems)")
        s9 = st.checkbox("Model Context Protocol (MCP) Сървъри", value=progress.get("sk_p9", True), key="sk_p9")
        s10 = st.checkbox("LangGraph StateGraphs & Дългосрочна Памет", value=progress.get("sk_p10", False), key="sk_p10")
        s11 = st.checkbox("Eval Harness (Оценка на точност & токени)", value=progress.get("sk_p11", False), key="sk_p11")
        s12 = st.checkbox("Advanced RAG & Unstructured Data Prep", value=progress.get("sk_p12", False), key="sk_p12")

    all_skills = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12]
    completed_skills = sum(1 for s in all_skills if s)
    total_skills = len(all_skills)
    progress_ratio = completed_skills / total_skills

    st.progress(progress_ratio)
    st.markdown(f"**Текущ статус:** Усвоени **{completed_skills}** от **{total_skills}** ключови модула (**{int(progress_ratio * 100)}%**) 🚀")
    
    if st.button("💾 Запази прогреса", key="save_roadmap"):
        settings.roadmap_progress = {
            "sk_p1": s1, "sk_p2": s2, "sk_p3": s3, "sk_p4": s4,
            "sk_p5": s5, "sk_p6": s6, "sk_p7": s7, "sk_p8": s8,
            "sk_p9": s9, "sk_p10": s10, "sk_p11": s11, "sk_p12": s12
        }
        settings_mgr.save(settings)
        st.success("Прогресът е запазен успешно!")
        st.rerun()

    st.divider()

    st.markdown("### 📚 Каталог с препоръчани курсове (DeepLearning.AI)")
    
    with st.expander("📖 Ниво 1: Foundation (Основи & AI-First Разработка)", expanded=False):
        st.markdown("""
        * **[AI Prompting for Everyone](https://www.deeplearning.ai/courses/ai-prompting-for-everyone)** — Основи на инженеринга на подкани и AI като мисловен партньор.
        * **[ChatGPT Prompt Engineering for Developers](https://www.deeplearning.ai/courses/chatgpt-prompt-eng)** — Практически техники за формулиране на подкани при разработка на софтуер.
        * **[AI Python for Beginners](https://www.deeplearning.ai/courses/ai-python-for-beginners)** — Модерен Python с AI асистенти за писане, тестване и дебъгване.
        * **[Building Systems with the ChatGPT API](https://www.deeplearning.ai/courses/chatgpt-building-system)** — Проектиране на многостъпкови процеси и верижни извиквания.
        * **[LangChain for LLM Application Development](https://www.deeplearning.ai/courses/langchain)** — Изграждане на основни приложения с LangChain framework.
        * **[LangChain Chat with Your Data](https://www.deeplearning.ai/courses/langchain-chat-with-your-data)** — Внедряване на чат интерфейси върху лични документи и бизнес данни.
        """)

    with st.expander("⚙️ Ниво 2: Core Track (Агентни Работни Потоци)", expanded=True):
        st.markdown("""
        * **[Agentic AI](https://www.deeplearning.ai/courses/agentic-ai)** *(Централният курс на Andrew Ng!)* — Покрива 4-те основни дизайн патерна: **Reflection, Tool Use, Planning и Multi-Agent Collaboration**, както и системна оценка (evals) и анализ на грешки.
        * **[Functions, Tools and Agents with LangChain](https://www.deeplearning.ai/courses/functions-tools-agents-langchain)** — Извикване на функции и сглобяване на агенти чрез LCEL.
        * **[AI Agents in LangGraph](https://www.deeplearning.ai/courses/ai-agents-in-langgraph)** — Контролирани, циклични и гъвкави агентни работни потоци със State Machine.
        * **[Multi AI Agent Systems with crewAI](https://www.deeplearning.ai/courses/multi-ai-agent-systems-with-crewai)** — Проектиране на колаборативни екипи от агенти с конкретни роли.
        * **[Design, Develop, and Deploy Multi-Agent Systems with CrewAI](https://www.deeplearning.ai/courses/design-develop-and-deploy-multi-agent-systems-with-crewai)** — Цялостно изграждане, тестване и деплоймънт на бизнес агенти.
        * **[Event-Driven Agentic Document Workflows](https://www.deeplearning.ai/courses/event-driven-agentic-document-workflows)** — Събитийно-ориентирани работни потоци за обработка на документи с Human-in-the-Loop обратна връзка.
        """)

    with st.expander("🎯 Ниво 3: Role Specialization (Agentic Systems Developer)", expanded=False):
        st.markdown("""
        * **[MCP: Build Rich-Context AI Apps with Anthropic](https://www.deeplearning.ai/courses/mcp-build-rich-context-ai-apps-with-anthropic)** — Model Context Protocol (MCP) за свързване на AI с външни бази и инструменти.
        * **[Long-Term Agentic Memory With LangGraph](https://www.deeplearning.ai/courses/long-term-agentic-memory-with-langgraph)** — Управление на състоянието и дългосрочната памет на агентите през различни сесии (LangMem).
        * **[AI Agentic Design Patterns with AutoGen](https://www.deeplearning.ai/courses/ai-agentic-design-patterns-with-autogen)** — Разговорни мултиагентни системи на Microsoft.
        * **[Building Coding Agents with Tool Execution](https://www.deeplearning.ai/courses/building-coding-agents-with-tool-execution)** — Изграждане на сигурни изолирани пясъчници (sandboxes като E2B) за изпълнение на код от агенти.
        * **[Building and Evaluating Data Agents](https://www.deeplearning.ai/courses/building-and-evaluating-data-agents)** — Изграждане на планиращи агенти върху бази данни и аналитични инструменти.
        * **[Preprocessing Unstructured Data for LLM Applications](https://www.deeplearning.ai/courses/preprocessing-unstructured-data-for-llm-applications)** — Почистване, чанкване и структуриране на PDF и HTML за RAG.
        """)

    st.info("💡 **Стратегия за сертификация:** Преминаване на безплатните видео лекции + активиране на 1 месец PRO абонамент ($30) за изпълнение на интерактивните лаборатории и получаване на сертификати за LinkedIn.")

with tab3:
    st.subheader("🚀 GitHub Portfolio: Architecting AI Agents (From Foundational to Advanced)")
    st.caption("Практическо портфолио от 5 специализирани проекта за пазара в София и международни роли")

    st.markdown("### 🛠️ Проекти в портфолиото")

    # Проект 1: Job-Finder
    with st.container(border=True):
        st.markdown("#### 1. 🤖 Job-Finder & Market Intelligence Agent")
        st.markdown(":green[**СТАТУС: В ПРОИЗВОДСТВО (Active v1.0)**] • *Ниво: Intermediate*")
        st.write("""
        **Какво прави:** Автономна агентна система, която обхожда dev.bg, jobs.bg и LinkedIn, дедуплицира обяви в SQLite, 
        извършва бълк семантичен анализ с Google Gemini 3.5 Flash и предоставя пълен дашборд за наблюдение на пазара на труда.
        """)
        st.markdown("**Технологичен стек:** `Python 3.14`, `Playwright Stealth / httpx`, `Google Gemini 3.5 Flash`, `SQLite`, `Streamlit`, `Pydantic v2`")
        repo_url_1 = st.text_input("GitHub Репозиторий:", value="https://github.com/peturganchev/Job-Finder", key="repo_1")
        st.caption("✅ Локално активен в `g:/Personal Files/Projects/Job-Finder`")

    # Проект 2: Personal MCP Server
    with st.container(border=True):
        st.markdown("#### 2. 🔌 Personal MCP Server (Model Context Protocol)")
        st.markdown(":orange[**СТАТУС: СЛЕДВАЩ ЗА РАЗРАБОТКА (Next Up)**] • *Ниво: Foundational to Intermediate*")
        st.write("""
        **Какво прави:** Персонализиран сървър по стандарта Model Context Protocol (MCP) на Anthropic. Сигурно излага локални 
        файлове, бази данни и REST API-та като ресурси и инструменти към AI среди (Claude Desktop, Cursor IDE, Custom Agents).
        """)
        st.markdown("**Технологичен стек:** `Python`, `Anthropic MCP SDK`, `FastAPI / AsyncIO`, `JSON Schema`, `Pydantic`")
        repo_url_2 = st.text_input("GitHub Репозиторий:", value="https://github.com/peturganchev/personal-mcp-server", key="repo_2")
        st.caption("🎯 Доказва: Познаване на актуалния индустриален стандарт за свързване на контекст към AI модели.")

    # Проект 3: Tool-Calling Agent с Eval Harness
    with st.container(border=True):
        st.markdown("#### 3. 🧪 Tool-Calling Agent с Eval Harness (Eval-Driven Development)")
        st.markdown(":blue[**СТАТУС: ПЛАНИРАН (Roadmap)**] • *Ниво: Intermediate*")
        st.write("""
        **Какво прави:** Автономен агент за специфична бизнес задача с достъп до външни инструменти и цялостна тестова рамка (eval harness). 
        Автоматично засича халюцинации, мери грешки при избор на инструменти (Tool Calling Accuracy) и оптимизира латентност и разход на токени.
        """)
        st.markdown("**Технологичен стек:** `Python`, `Google Gemini SDK / OpenAI`, `Pydantic`, `pytest`, `Ragas / Evals Framework`")
        repo_url_3 = st.text_input("GitHub Репозиторий:", value="https://github.com/peturganchev/tool-calling-eval-agent", key="repo_3")
        st.caption("🎯 Доказва: Инженерен подход (Eval-Driven Development), липса на халюцинации и контрол върху разходите.")

    # Проект 4: Multi-Agent Research Assistant
    with st.container(border=True):
        st.markdown("#### 4. 👥 Multi-Agent Research Assistant (LangGraph & Reflection Pattern)")
        st.markdown(":blue[**СТАТУС: ПЛАНИРАН (Roadmap)**] • *Ниво: Intermediate to Advanced*")
        st.write("""
        **Какво прави:** Мултиагентна система, съставена от 3 специализирани агента (Researcher, Analyst, Fact-Checker/Editor). 
        Приема тема, извършва автономно уеб търсене, синтезира информацията и чрез итеративна рефлексия (Reflection Loop) генерира валидиран Markdown доклад.
        """)
        st.markdown("**Технологичен стек:** `LangGraph`, `CrewAI`, `Tavily Search API`, `Pydantic`, `Python`")
        repo_url_4 = st.text_input("GitHub Репозиторий:", value="https://github.com/peturganchev/multi-agent-researcher", key="repo_4")
        st.caption("🎯 Доказва: Оркестрация на споделено състояние (State Management), крайни автомати и контрол върху автономността.")

    # Проект 5: Production Observability Dashboard
    with st.container(border=True):
        st.markdown("#### 5. 📊 Production Observability Dashboard за AI Агенти")
        st.markdown(":blue[**СТАТУС: ПЛАНИРАН (Roadmap)**] • *Ниво: Advanced*")
        st.write("""
        **Какво прави:** Централизирана система за мониторинг в реално време на агентни сесии. Прихваща индивидуални стъпки (spans) 
        и цялостни пътища на изпълнение (traces), логва неуспешни извиквания на инструменти, следи латентността и консумацията на токени.
        """)
        st.markdown("**Технологичен стек:** `Langfuse / Phoenix (Arize) / LangSmith`, `OpenTelemetry`, `Python`, `Streamlit / Grafana`")
        repo_url_5 = st.text_input("GitHub Репозиторий:", value="https://github.com/peturganchev/agent-observability-hub", key="repo_5")
        st.caption("🎯 Доказва: Enterprise готовност (Production Readiness), мониторинг и зрялост при експлоатация на агентски системи.")

    st.divider()
    st.subheader("🔗 GitHub Live Tracker (Подготовка за интеграция)")
    st.write("След качване на проектите в твоя GitHub акаунт, тук ще свържем GitHub REST API и ще следим брой коммити, stars, отворени PRs и статус на живо!")

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
    st.subheader("👤 Твоят профил & CV")
    
    # Initialization of current profile
    current_profile = user_profile.get("profile_data") if current_user else {}
    if not current_profile:
        # Fallback for old users
        profile_path = Path("config/profile.yaml")
        if profile_path.exists():
            import yaml
            with open(profile_path, "r", encoding="utf-8") as f:
                legacy_prof = yaml.safe_load(f)
                current_profile = legacy_prof.get("candidate", {})

    st.markdown("### 📥 Импорт от CV (PDF)")
    st.caption("Качи своето CV, за да го парснем автоматично чрез AI. Това ще попълни полетата по-долу.")
    
    uploaded_file = st.file_uploader("Качи CV (.pdf)", type=["pdf"])
    
    if uploaded_file and st.button("🪄 Анализирай CV-то с AI"):
        if not user_gemini_key:
            st.error("За да използваш AI парсването, трябва да имаш въведен Gemini API Key в настройките.")
        else:
            with st.spinner("🧠 AI чете и анализира твоето CV..."):
                import PyPDF2
                from src.intelligence.cv_parser import CVAIExtractor
                
                # Extract text
                pdf_reader = PyPDF2.PdfReader(uploaded_file)
                cv_text = ""
                for page in pdf_reader.pages:
                    cv_text += page.extract_text() + "\n"
                
                # Parse
                extractor = CVAIExtractor(api_key=user_gemini_key)
                structured_cv = extractor.parse_cv(cv_text)
                
                if structured_cv:
                    st.session_state["draft_profile"] = structured_cv
                    st.success("CV-то е успешно парснато! Прегледай данните по-долу и запази.")
                else:
                    st.error("Грешка при парсването. Опитай отново.")

    st.divider()
    st.markdown("### ✍️ Преглед и редакция на профила")
    
    # Merge session state draft with current database profile
    edit_profile = st.session_state.get("draft_profile", current_profile)
    
    with st.form("profile_form"):
        col_p1, col_p2 = st.columns(2)
        with col_p1:
            p_name = st.text_input("Пълно име", value=edit_profile.get("name", ""))
            p_title = st.text_input("Текуща/Желана Позиция", value=edit_profile.get("title", ""))
            
            # Safely get experience years as int
            exp_val = edit_profile.get("experience_years", 0)
            try:
                exp_val = int(exp_val)
            except (ValueError, TypeError):
                exp_val = 0
            p_exp = st.number_input("Години опит", value=exp_val, min_value=0, max_value=50)
            
        with col_p2:
            p_summary = st.text_area("Обобщение (Summary)", value=edit_profile.get("summary", ""), height=150)
            
        # Helper to stringify lists that might contain dicts (like legacy languages)
        def safe_join(items):
            if not items: return ""
            if isinstance(items, str): return items
            if isinstance(items, list):
                res = []
                for i in items:
                    if isinstance(i, dict):
                        # Attempt to extract 'language' or fallback to stringified dict
                        res.append(str(i.get("language", i.get("name", list(i.values())[0] if i else ""))))
                    else:
                        res.append(str(i))
                return ", ".join(res)
            return str(items)

        p_roles = st.text_input("Желани роли (раздели със запетая)", value=safe_join(edit_profile.get("target_roles", [])))
        p_skills = st.text_area("Ключови умения (раздели със запетая)", value=safe_join(edit_profile.get("core_skills", [])))
        p_langs = st.text_input("Езици (раздели със запетая)", value=safe_join(edit_profile.get("languages", [])))
        
        submitted = st.form_submit_button("💾 Запази профила в базата")
        
        if submitted:
            final_data = {
                "name": p_name,
                "title": p_title,
                "experience_years": p_exp,
                "summary": p_summary,
                "target_roles": [r.strip() for r in p_roles.split(",") if r.strip()],
                "core_skills": [s.strip() for s in p_skills.split(",") if s.strip()],
                "languages": [l.strip() for l in p_langs.split(",") if l.strip()]
            }
            if current_user:
                save_user_profile(current_user["id"], {"profile_data": final_data})
                # Clear draft so it doesn't override future visits unnecessarily
                if "draft_profile" in st.session_state:
                    del st.session_state["draft_profile"]
                st.success("Профилът ти е запазен успешно и ще се ползва за всички бъдещи анализи!")
                import time; time.sleep(1)
                st.rerun()
            else:
                st.error("Трябва да си влязъл в профила си, за да запазваш.")

with tab_settings:
    st.subheader("⚙️ Настройки на системата")
    
    settings_mgr = SettingsManager()
    settings = settings_mgr.load()
    
    st.markdown("### 🌐 Източници за търсене")
    c1, c2, c3, c4, c5, c6 = st.columns(6)
    with c1:
        use_devbg = st.checkbox("dev.bg", value=settings.sources.dev_bg)
    with c2:
        use_jobsbg = st.checkbox("jobs.bg", value=settings.sources.jobs_bg)
    with c3:
        use_linkedin = st.checkbox("LinkedIn", value=settings.sources.linkedin)
    with c4:
        use_himalayas = st.checkbox("Himalayas", value=settings.sources.himalayas)
    with c5:
        use_euremote = st.checkbox("EU Remote", value=settings.sources.euremotejobs)
    with c6:
        use_hackernews = st.checkbox("HackerNews", value=settings.sources.hackernews)
        
    st.markdown("### 🧠 Google Gemini AI")
    api_source = settings_mgr.get_api_key_source()
    if api_source == "settings":
        source_msg = "Активен ключ от **настройките**."
    elif api_source == "env":
        source_msg = "Активен ключ от **.env** файла."
    else:
        source_msg = "⚠️ Липсва API ключ."
        
    st.caption(f"Статус на ключа: {source_msg}")
    
    current_key = (user_profile.get("gemini_api_key") if current_user else None) or settings_mgr.get_api_key()
    current_masked = settings_mgr.mask_key(current_key)
    
    new_key = st.text_input("Gemini API Key (Google AI Studio)", value="", type="password", placeholder=f"Текущ: {current_masked}")
    st.markdown("[Вземи безплатен ключ от Google AI Studio](https://aistudio.google.com/)")
    
    col_ai1, col_ai2, col_ai3 = st.columns([1, 1, 2])
    with col_ai1:
        if st.button("💾 Запази ключ"):
            if current_user:
                save_user_profile(current_user["id"], {"gemini_api_key": new_key})
            settings_mgr.set_api_key(new_key)
            st.success("Ключът е запазен!")
            st.rerun()
    with col_ai2:
        if st.button("🗑️ Изтрий ключ"):
            if current_user:
                save_user_profile(current_user["id"], {"gemini_api_key": None})
            settings_mgr.set_api_key(None)
            st.success("Ключът е изтрит от настройките.")
            st.rerun()
    with col_ai3:
        if st.button("🧪 Тествай връзката"):
            with st.spinner("Тестване на Gemini API..."):
                active_k = new_key or current_key
                analyzer = GeminiJobAnalyzer(api_key=active_k)
                success, msg = analyzer.test_connection()
                if success:
                    st.success(f"Успех! {msg}")
                else:
                    st.error(f"Грешка: {msg}")

    st.markdown("#### Модел")
    selected_model = st.selectbox(
        "Избери Gemini модел",
        options=["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-pro"],
        index=["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-pro"].index(settings.ai.gemini_model) if settings.ai.gemini_model in ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-pro"] else 0
    )
    
    # Custom model fallback
    custom_model = st.text_input("Или въведи персонализиран модел (напр. tunedModels/...)", value=settings.ai.gemini_model if settings.ai.gemini_model not in ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-pro"] else "")
    final_model = custom_model.strip() if custom_model.strip() else selected_model
    
    if st.button("💾 Запази всички настройки", type="primary"):
        settings.sources.dev_bg = use_devbg
        settings.sources.jobs_bg = use_jobsbg
        settings.sources.linkedin = use_linkedin
        settings.sources.himalayas = use_himalayas
        settings.sources.euremotejobs = use_euremote
        settings.sources.hackernews = use_hackernews
        settings.ai.gemini_model = final_model
        
        # Validate sources
        if not (use_devbg or use_jobsbg or use_linkedin or use_himalayas or use_euremote or use_hackernews):
            st.error("Трябва да избереш поне един източник!")
        else:
            settings_mgr.save(settings)
            if current_user:
                save_user_profile(current_user["id"], {
                    "gemini_model": final_model
                })
            st.success("Всички настройки са запазени!")
            st.rerun()
