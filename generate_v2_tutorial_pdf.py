import os
from pathlib import Path
from playwright.sync_api import sync_playwright

html_content = """<!DOCTYPE html>
<html lang="bg">
<head>
    <meta charset="UTF-8">
    <title>Job-Finder v2 — Ръководство за потребителя</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        @page {
            size: A4;
            margin: 10mm 12mm 12mm 12mm;
            @bottom-right {
                content: counter(page) " / " counter(pages);
                font-family: 'Inter', sans-serif;
                font-size: 8pt;
                color: #94a3b8;
            }
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1e293b;
            background: #ffffff;
            line-height: 1.45;
            font-size: 9pt;
            margin: 0;
            padding: 0;
        }

        /* Header Banner */
        .header-box {
            background: linear-gradient(135deg, #090d16 0%, #064e3b 50%, #0f172a 100%);
            color: #ffffff;
            border-radius: 12px;
            padding: 20px 24px;
            margin-bottom: 14px;
            box-shadow: 0 4px 14px rgba(6, 78, 59, 0.2);
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .header-badge {
            display: inline-block;
            background: rgba(16, 185, 129, 0.2);
            border: 1px solid rgba(52, 211, 153, 0.4);
            color: #6ee7b7;
            font-size: 7.5pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            padding: 2px 9px;
            border-radius: 9999px;
            margin-bottom: 6px;
        }

        .header-title {
            font-size: 18pt;
            font-weight: 800;
            margin: 0 0 4px 0;
            letter-spacing: -0.5px;
            color: #ffffff;
        }

        .header-subtitle {
            font-size: 9.5pt;
            color: #cbd5e1;
            margin: 0;
            font-weight: 400;
        }

        .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.12);
            font-size: 8pt;
        }

        .meta-item strong {
            color: #6ee7b7;
            display: block;
            font-size: 7pt;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 1px;
        }

        /* Section Cards */
        .section-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            padding: 12px 16px;
            margin-bottom: 11px;
            page-break-inside: avoid;
            box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }

        .page-break {
            page-break-before: always;
        }

        h2 {
            font-size: 11.5pt;
            font-weight: 700;
            color: #0f172a;
            margin-top: 0;
            margin-bottom: 6px;
            padding-bottom: 4px;
            border-bottom: 2px solid #ecfdf5;
            display: flex;
            align-items: center;
            gap: 7px;
        }

        h3 {
            font-size: 9.5pt;
            font-weight: 600;
            color: #1e293b;
            margin: 8px 0 4px 0;
        }

        p {
            margin: 0 0 5px 0;
        }

        /* Badges & Tags */
        .badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 4px;
            font-size: 7.5pt;
            font-weight: 600;
            margin-right: 3px;
        }
        .badge-green { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
        .badge-emerald { background: #064e3b; color: #a7f3d0; border: 1px solid #059669; }
        .badge-blue { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .badge-purple { background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff; }
        .badge-amber { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }

        /* Feature Grid */
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin: 6px 0;
        }

        .feature-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 10px;
            font-size: 8.5pt;
        }

        .feature-box strong {
            color: #0f172a;
            font-size: 8.8pt;
            display: flex;
            align-items: center;
            gap: 5px;
            margin-bottom: 2px;
        }

        /* Callout Box */
        .callout {
            background: #f0fdf4;
            border-left: 4px solid #10b981;
            padding: 8px 11px;
            border-radius: 0 6px 6px 0;
            margin: 6px 0;
            font-size: 8.5pt;
            color: #065f46;
        }

        .callout-blue {
            background: #eff6ff;
            border-left-color: #3b82f6;
            color: #1e40af;
        }

        .callout-purple {
            background: #faf5ff;
            border-left-color: #a855f7;
            color: #6b21a8;
        }

        /* Lists */
        ul {
            margin: 0 0 6px 0;
            padding-left: 16px;
        }
        li {
            margin-bottom: 2px;
        }

        /* Keyboard / UI Elements */
        .ui-pill {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 1px 4px;
            border-radius: 3px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 7.5pt;
            color: #334155;
        }

        .footer-note {
            text-align: center;
            font-size: 7.5pt;
            color: #94a3b8;
            margin-top: 12px;
            padding-top: 6px;
            border-top: 1px solid #f1f5f9;
        }
    </style>
</head>
<body>

    <!-- Header Box -->
    <div class="header-box">
        <div class="header-badge">🚀 Наръчник за Платформата • v2.0 Production</div>
        <h1 class="header-title">🤖 Job-Finder v2: Интелигентен Наръчник</h1>
        <p class="header-subtitle">Автономен хъб за търсене, семантично оценяване, Kanban мениджмънт и пазарен анализ на AI/ML позиции</p>
        
        <div class="meta-grid">
            <div class="meta-item">
                <strong>Потребител</strong>
                Петър Ганчев
            </div>
            <div class="meta-item">
                <strong>Архитектура</strong>
                React 18 SPA + FastAPI + Supabase
            </div>
            <div class="meta-item">
                <strong>AI Двигател</strong>
                Google Gemini 2.5 Flash
            </div>
            <div class="meta-item">
                <strong>Домейн</strong>
                job-finder.archevyn.dev
            </div>
        </div>
    </div>

    <!-- Section 0: Защита и Автентикация -->
    <div class="section-card">
        <h2>🔒 1. Защитен Достъп & Автентикация (Auth Gate)</h2>
        <p>За пълна сигурност и мулти-тенант изолация, платформата изисква задължителна автентикация преди разглеждане на съдържанието.</p>
        
        <div class="feature-grid">
            <div class="feature-box">
                <strong>🔑 Вход в профила (Auth Modal)</strong>
                Въведете своя регистриран имейл и парола. Сесията се съхранява сигурно в <span class="ui-pill">localStorage</span> с автоматично опресняване на JWT токена.
            </div>
            <div class="feature-box">
                <strong>📝 Списък на чакащите (Waitlist)</strong>
                Нови посетители могат да подадат заявка за достъп чрез въвеждане на име, имейл и кратка бележка.
            </div>
            <div class="feature-box">
                <strong>🛡️ Waitlist Администрация</strong>
                Администраторски бутон (активен <em>само за peturganchev93@gmail.com</em>) в лентата за управление, позволяващ преглед, одобрение или отхвърляне на чакащи потребители.
            </div>
            <div class="feature-box">
                <strong>🔐 Row-Level Security (RLS)</strong>
                Всяка обява, Kanban статус и запазена ключова дума са криптирани и достъпни само от вашия акаунт в Supabase PostgreSQL.
            </div>
        </div>
    </div>

    <!-- Section 1: Обяви & Табло -->
    <div class="section-card">
        <h2>📋 2. Меню „Обяви & Табло“ (Kanban Application Board)</h2>
        <p>Централният интерактивен екран за организиране на кандидатстването и филтриране на откритите позиции.</p>

        <div class="feature-grid">
            <div class="feature-box">
                <strong>📊 5-Колонен Kanban Борд</strong>
                <span class="badge badge-blue">Нови (New)</span> ➔ 
                <span class="badge badge-amber">Кандидатствал (Applied)</span> ➔ 
                <span class="badge badge-purple">Интервю (Interview)</span> ➔ 
                <span class="badge badge-green">Оферта (Offer)</span> ➔ 
                <span class="badge badge-emerald">Архив</span>.<br>
                Смяната на статуса става с един клик или през детайлния преглед.
            </div>
            <div class="feature-box">
                <strong>🎛️ Интелигентни Филтри</strong>
                • <strong>Минимален Match Score</strong> (напр. 70%+)<br>
                • <strong>Тип локация:</strong> Remote / Hybrid / On-site<br>
                • <strong>Портал:</strong> dev.bg, jobs.bg, LinkedIn, EU Remote<br>
                • <strong>Търсене:</strong> свободно филтриране по умение или компания.
            </div>
            <div class="feature-box">
                <strong>🎯 AI Match Score (0–100%)</strong>
                Изчислява се от Gemini спрямо вашето CV. Показва процента на съвпадение и откритите ключови съвпадащи умения.
            </div>
            <div class="feature-box">
                <strong>🔍 Детайлна Карта на Обявата</strong>
                Отваря модален прозорец с пълно описание на позицията, открити <strong>дефицитни умения</strong> (Skill Gaps) и бутон за генерация на мотивационно писмо.
            </div>
        </div>

        <div class="callout">
            <strong>💡 Бутон „Мотивационно Писмо на живо“:</strong> Натиснете бутона с искра в детайлния преглед на всяка обява. Gemini синтезира съобразено с вашия инженерен профил придружително писмо, готово за копиране с един клик.
        </div>
    </div>

    <!-- Page Break for clean printing -->
    <div class="page-break"></div>

    <!-- Section 2: Търсене & Скрапване -->
    <div class="section-card">
        <h2>🔍 3. Меню „Търсене & Скрапване“ (Autonomous Scraper Suite)</h2>
        <p>Модул за автономно сканиране на пазара чрез устойчиви Playwright Stealth браузърни скрапъри.</p>

        <div class="feature-grid">
            <div class="feature-box">
                <strong>🕷️ Мулти-портално обхождане</strong>
                Поддържа водещите български и европейски портали: 
                <span class="badge badge-blue">dev.bg</span> 
                <span class="badge badge-blue">jobs.bg</span> 
                <span class="badge badge-blue">LinkedIn</span> 
                <span class="badge badge-purple">EU Remote</span> 
                <span class="badge badge-purple">HackerNews</span>
            </div>
            <div class="feature-box">
                <strong>🏷️ Персонални Ключови Думи</strong>
                Въведете ваши ключови думи (напр. <em>Agentic AI, Python, LangGraph</em>). Бутонът <strong>„Запази в Профила“</strong> ги записва директно във вашия Supabase ред.
            </div>
            <div class="feature-box">
                <strong>🧹 Дедупликация и Режими</strong>
                • <em>Запази съществуващите:</em> добавя само нови обяви.<br>
                • <em>Изчисти New:</em> маха само необработените позиции.<br>
                • <em>Пълен ресет:</em> изчиства каталога за ново пускане.
            </div>
            <div class="feature-box">
                <strong>📺 Терминална Конзола на Живо</strong>
                Чрез Server-Sent Events (SSE) виждате в реално време как скрапърът преминава през страниците, сваля обявите и ги подава към Gemini.
            </div>
        </div>
    </div>

    <!-- Section 3: План & Портфолио -->
    <div class="section-card">
        <h2>🗺️ 4. Меню „План & Портфолио“ (Skill Roadmap & Portfolio Hub)</h2>
        <p>Стратегическа пътна карта за кариерно позициониране и презентация на завършени проекти.</p>

        <div class="feature-grid">
            <div class="feature-box">
                <strong>🧭 3-Нивов Skill Roadmap</strong>
                • <strong>Ниво 1: Foundation</strong> (Prompt Engineering, Python, Pydantic)<br>
                • <strong>Ниво 2: Core Track</strong> (Tool Calling, Planning, Multi-Agent)<br>
                • <strong>Ниво 3: Role Specialization</strong> (LangGraph, MCP, Evals)<br>
                <em>Напредъкът ви се запаметява интерактивно в базата данни.</em>
            </div>
            <div class="feature-box">
                <strong>🚀 5 Флагмански Портфолио Проекта</strong>
                Подбрани концепции за привличане на вниманието на технически директори (Job-Finder Agent, Personal MCP Server, Tool-Calling Eval Harness, Observability Dashboard).
            </div>
        </div>

        <div class="callout callout-purple">
            <strong>🎯 Инженерно Предимство:</strong> Бекграундът ви в автоматизация, крайни автомати (FSM) и Dynata е директно съотносим към циклите и контрола в агентните графове (LangGraph).
        </div>
    </div>

    <!-- Section 4: CV & Профил -->
    <div class="section-card">
        <h2>👤 5. Меню „CV & Профил“ (Candidate Intelligence)</h2>
        <p>Управление на личния профил, по който Google Gemini оценява съвместимостта на обявите.</p>

        <div class="feature-grid">
            <div class="feature-box">
                <strong>📄 Качване на CV (PDF/Word)</strong>
                Вграден автоматичен парсер. Качвате файл и Gemini извлича уменията, годините професионален опит и длъжностите.
            </div>
            <div class="feature-box">
                <strong>🎯 Целеви Роли и Технологичен Стек</strong>
                Посочвате кои позиции таргетирате (Agentic AI Engineer, Python Specialist) и кои технологии владеете за точен скоринг.
            </div>
        </div>
    </div>

    <!-- Section 5: Пазарен Анализ & Настройки -->
    <div class="section-card">
        <h2>📈 6. Меню „Пазарен Анализ“ и „Настройки“</h2>
        <div class="feature-grid">
            <div class="feature-box">
                <strong>📊 Пазарен Радар на Уменията</strong>
                • Автоматична дедупликация на обявите при анализ.<br>
                • Разпределение по всички източници и портали.<br>
                • Честота на търсене на LangGraph, CrewAI, FastAPI, Docker.<br>
                • Бутон <strong>„Генерирай AI Доклад“</strong> запазва анализа в сесията без риск от ресетване при скролване.
            </div>
            <div class="feature-box">
                <strong>⚙️ Системни Настройки & Gemini BYOK</strong>
                • <strong>Избор на модел:</strong> Gemini 2.5 Flash, 2.5 Pro.<br>
                • <strong>Личен API ключ:</strong> Въвеждане на ключ от Google AI Studio с валидация на живо.<br>
                • <strong>Черен списък (Blacklist):</strong> Филтрира нежелани позиции (напр. PHP, WordPress, Sales).
            </div>
        </div>
    </div>

    <div class="footer-note">
        Job-Finder v2 • Флагмански Portfolio Проект от Петър Ганчев • https://job-finder.archevyn.dev
    </div>

</body>
</html>
"""

def generate_pdf():
    html_path = Path("Job_Finder_v2_User_Guide.html")
    pdf_path = Path("Job_Finder_v2_User_Guide.pdf")
    
    html_path.write_text(html_content, encoding="utf-8")
    
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(f"file:///{html_path.resolve().as_posix()}")
        page.pdf(
            path=str(pdf_path),
            format="A4",
            print_background=True,
            margin={"top": "10mm", "bottom": "10mm", "left": "10mm", "right": "10mm"}
        )
        browser.close()
        
    print(f"SUCCESS: PDF generated at {pdf_path.resolve()} (Size: {pdf_path.stat().st_size} bytes)")

if __name__ == "__main__":
    generate_pdf()
