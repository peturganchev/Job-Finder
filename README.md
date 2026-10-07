# 🤖 Job Finder & Market Intelligence (Agentic AI)

Автономна система за търсене, филтриране и пазарен анализ на обяви за работа в сферата на **Agentic AI, LLM и Python Engineering** за **София** и **Remote**.

Специално пригодена да ти помогне при преквалификация – извлича какво точно търсят компаниите на пазара в момента, за да си структурираш обучението (DeepLearning.AI) и портфолиото.

---

## 🌟 Основни възможности

1. **Многоканално скрейпване без банове:**
   - **`dev.bg`** – Водещият български IT портал (AI/ML и Python категории).
   - **`jobs.bg`** – Справяне с Cloudflare чрез устойчиви забавяния и сесии.
   - **`LinkedIn`** – Постоянен браузърен профил (`.browser_session`), избягващ authwall и 2FA при повторни пускания.
2. **AI Оценка с Google Gemini:**
   - Анализира всяка намерена обява спрямо твоето CV и профил.
   - Изчислява **Match Score (0-100%)**.
   - Извлича **липсващите умения**, които трябва да добавиш към портфолиото си.
   - Генерира **персонализирано мотивационно писмо**.
3. **Пазарен анализ на търсенето в София (`--insights`):**
   - Синтезира най-често изискваните технологии и библиотеки (LangChain, AutoGen, CrewAI, RAG, Vector DBs, FastAPI).
   - Предлага 3 конкретни идеи за портфолио проекти с висок шанс за наемане.
4. **Интерактивен локален дашборд (Streamlit):**
   - Графичен интерфейс за преглед на обявите, филтриране и смяна на статуси (*Кандидатствал, Интервю, Оферта*).
5. **Известия в реално време:**
   - Поддръжка за **Discord Webhooks** (богати Rich Embeds) и **Telegram Bot**.

---

## 🚀 Бърз старт

### 1. Настройка на конфигурацията (`.env`)
Копирай примера и създай свой `.env` файл:
```bash
cp .env.example .env
```
Отвори `.env` и добави твоя **Gemini API Key** (безплатен от [Google AI Studio](https://aistudio.google.com/)).
*(Опционално: добави Discord Webhook URL или Telegram токен, ако искаш пуш известия).*

### 2. Първоначален браузърен вход (еднократно)
За да не те блокира LinkedIn и за да преминеш проверките в jobs.bg:
```bash
.\.venv\Scripts\python.exe run.py --login
```
*Ще се отвори видим прозорец на браузъра. Влез си в профила в LinkedIn и jobs.bg, след което натисни `ENTER` в терминала. Сесията се запазва занапред.*

---

## 💻 Команди за управление

| Команда | Описание |
| :--- | :--- |
| `.\.venv\Scripts\python.exe run.py --search` | Пуска скрейпърите за нови обяви, прави AI анализ и изпраща известия |
| `.\.venv\Scripts\python.exe run.py --dashboard` | Отваря локалния графичен уеб дашборд в браузъра |
| `.\.venv\Scripts\python.exe run.py --insights` | Генерира пазарен доклад за търсените AI умения в София |
| `.\.venv\Scripts\python.exe run.py --stats` | Показва кратка статистика в терминала |
| `.\.venv\Scripts\python.exe run.py --login` | Отваря браузъра за ръчен вход / опресняване на бисквитките |
| `.\.venv\Scripts\python.exe run.py --cleanup` | Проверява запазените обяви и премахва изтеклите/свалените |

### Допълнителни опции за търсене:
```bash
# Изчистване на всички необработени ('New') обяви преди търсене
.\.venv\Scripts\python.exe run.py --search --clear-new

# Пълно изчистване на базата преди търсене
.\.venv\Scripts\python.exe run.py --search --clear-all

# Търсене само в dev.bg и jobs.bg
.\.venv\Scripts\python.exe run.py --search --sources dev.bg jobs.bg

# Търсене в напълно скрит (headless) режим
.\.venv\Scripts\python.exe run.py --search --headless

# Задаване на лимит на обяви
.\.venv\Scripts\python.exe run.py --search --max-jobs 20
```

---

## 📁 Структура на проекта

```text
Job-Finder/
├── config/
│   ├── profile.yaml          # Твоят профил, цели и DeepLearning.AI roadmap
│   ├── filters.yaml          # Ключови думи за търсене и черен списък
│   └── settings.yaml         # Браузърни настройки и тайминги
├── src/
│   ├── browser.py            # Playwright браузър с persistent сесия и stealth
│   ├── database/             # SQLite база данни и дедупликация
│   ├── scrapers/             # Модули за dev.bg, jobs.bg и LinkedIn
│   ├── intelligence/         # Gemini AI анализ и пазарни отчети
│   ├── notifiers/            # Discord Webhook и Telegram известия
│   └── dashboard/            # Streamlit локален уеб дашборд
├── data/
│   └── jobs.db               # Локална SQLite база данни
├── reports/                  # Генерирани пазарни отчети (Markdown)
├── .browser_session/         # Запазени бисквитки и браузърен профил (gitignored)
├── PROGRESS.md               # Отчет за прогреса на проекта
├── requirements.txt          # Python зависимости
└── run.py                    # Главен CLI вход
```

---

## 👤 Персонализация на търсенето
Можеш по всяко време да промениш целевите позиции и умения във файла `config/profile.yaml`.
Системата автоматично ще ги вземе под внимание при следващия AI анализ на намерените обяви!
