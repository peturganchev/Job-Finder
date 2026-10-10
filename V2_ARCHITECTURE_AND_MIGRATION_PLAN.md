# 🚀 Job-Finder v2: Пълна Архитектурна Спецификация и План за Миграция

> **Забележка за новия AI агент / разработчик:**  
> Този документ съдържа цялостния план, контекст, технологичен стек и стъпки за изграждане на **Job-Finder v2**.  
> Разработката се извършва в отделно Git Worktree копие: `g:\Personal Files\Projects\Job-Finder-v2` в бранч `feature/ui-v2`, за да не се нарушава работата на текущия Streamlit Cloud дашборд в `main`.

---

## 1. 🎯 Цел и Контекст на Проекта

Job-Finder е автономен център за наблюдение на AI/ML роли в България и ЕС, извличащ обяви от **dev.bg, jobs.bg, linkedin, himalayas, euremotejobs и hackernews**, анализиращ ги с **Google Gemini AI** спрямо личния профил и CV на потребителя.

### Защо преминаваме към v2 (От Streamlit към Модерен Уеб Стек)?
1. **Премахване на сесийните проблеми и логаута:** В Streamlit сесиите умират при F5 / refresh, а опитите за глобални бисквитки водят до междупотребителски лийкове в мулти-търн среда.
2. **Истински клиентски сесии:** С React и `@supabase/supabase-js`, JWT токените се съхраняват сигурно в `localStorage` на браузъра на клиента – потребителят остава логнат завинаги (до клик на „Изход“), а сесиите на различни устройства са 100% изолирани.
3. **Мобилна адаптивност (Mobile-first):** Streamlit сайдбарът е неудобен за телефони. Новият интерфейс разполага с нативно Drawer меню, бързи филтри и картов дизайн за мобилни екрани.
4. **Светкавична скорост и реално време:** SPA архитектура без презареждане на цялата страница при всяка интеракция.

---

## 2. 🌳 Работна Среда & Git Worktree Структура

Проектът вече е конфигуриран с независим Git Worktree:

- **Главен репозиториум (Production / Streamlit Cloud):**
  - Път: `g:\Personal Files\Projects\Job-Finder`
  - Бранч: `main`
- **Нова разработка (v2):**
  - Път: `g:\Personal Files\Projects\Job-Finder-v2`
  - Бранч: `feature/ui-v2`
- **Мърджване след завършване:**
  ```bash
  # След като v2 е напълно готов и тестван:
  cd "g:\Personal Files\Projects\Job-Finder"
  git merge feature/ui-v2
  git push origin main
  ```

---

## 3. 🏗️ Технологичен Стек на v2

```mermaid
flowchart TD
    subgraph Client [Клиент - Браузър / Мобилен]
        UI[React 18+ / Vite / Tailwind / shadcn/ui]
    end

    subgraph Supabase [Supabase Cloud BaaS]
        Auth[Supabase Auth (JWT & Sessions)]
        DB[(PostgreSQL + RLS)]
        Storage[Supabase Storage (CV PDFs)]
    end

    subgraph Backend [Python FastAPI Server]
        API[FastAPI Endpoints]
        Scrapers[Playwright Scrapers (dev.bg, jobs.bg...)]
        AI[Google Gemini Analyzer & CV Parser]
    end

    UI -->|Вход, Сесии, Заявки за обяви, Профил| Supabase
    UI -->|Старт на търсене, AI парсване на CV, Live Logs| API
    API -->|Запис на намерени обяви & статистика| Supabase
    API -->|LLM извиквания| AI
```

### 3.1. Frontend (`frontend/`)
- **Фреймуърк:** Vite + React (TypeScript или JavaScript)
- **Стилизация:** Tailwind CSS
- **UI Компоненти:** Radix UI / shadcn/ui (Cards, Dialogs, Drawer, Badges, Tabs, Toast notifications)
- **Икони:** `lucide-react`
- **Клиент за база данни:** `@supabase/supabase-js` (управлява Auth, Realtime и заявките директно от клиента)
- **Дата фечинг:** TanStack Query (`@tanstack/react-query`) за кеширане и светкавични мутации

### 3.2. Backend (`backend/` или `src/api/`)
- **Фреймуърк:** FastAPI (Python 3.11+) + Uvicorn
- **Роля:** Сервира само специализираните Python операции:
  1. Стартиране на Playwright скрапери във фонов режим (`run.py` / `src/scrapers/`).
  2. Парсване на качени CV файлове (PyPDF2 / pypdf + Gemini).
  3. Генериране на персонализирани мотивационни писма през Gemini.
  4. Агрегация на пазарен анализ.
- **Автентикация към API:** Извлича Bearer JWT токен от хедъра и го валидира през Supabase Auth.

---

## 4. 🗄️ База Данни & Supabase Модел

Базата данни вече е настроена в Supabase с активиран **Row Level Security (RLS)**:

1. **`auth.users`**: Управлява акаунтите (Email, Password, UUID).
2. **`public.jobs`**: Глобален каталог с всички намерени позиции (`url`, `title`, `company`, `location`, `description`, `salary`, `scraped_at`).
3. **`public.user_jobs`**: Връзка потребител <-> обява (`user_id`, `job_id`, `status`, `match_score`, `ai_summary`, `matched_skills`, `missing_skills`, `cover_letter`, `is_bookmarked`).
   - Статуси: `'new'`, `'applied'`, `'interview'`, `'offer'`, `'rejected'`.
4. **`public.user_settings`**: Лични настройки на потребителя (`user_id`, `gemini_api_key`, `gemini_model`, `profile_data`, `search_keywords`, `active_sources`, `blacklist_titles`, `blacklist_companies`).
5. **`public.access_requests`**: Списък с чакащи за одобрение (Waitlist) (`id`, `full_name`, `email`, `notes`, `status: 'pending' | 'approved' | 'rejected'`).
6. **`public.scrape_tasks`**: Задачи за търсене на обяви (`task_id`, `user_id`, `status`, `progress`, `logs`).

---

## 5. 📱 Основни Екрани & Функционалности

### 5.1. Автентикация & Вход (`/login`)
- **🔑 Вход:** Имейл и парола. Запомняне в `localStorage` (без логаут при refresh!).
- **📩 Заявка за достъп (Waitlist):** Две имена, Имейл, Желана позиция/Бележка. Записва се в `access_requests`.
- **👑 Админ панел (за Петър):** Преглед на всички чакащи заявки с бутони `[Одобри]` / `[Откажи]`.

### 5.2. 📋 Обяви & Кандидатствания (`/jobs`)
- **Два режима на визуализация:**
  1. **Списък с карти:** Сортиране по Match Score (висок към нисък), източник, заплата, филтри по ключови думи.
  2. **Kanban Табло:** Колонки `Нови`, `Кандидатствал`, `Интервю`, `Оферта`, `Отказани` с Drag-and-drop или бързи бутони за смяна на статуса.
- **Детайлна модална карта за обява:**
  - AI Match Score процент с цветен бейдж (зелен 85%+, син 70-84%, сив под 70%).
  - Списък със **съвпадащи умения** и **липсващи умения** от CV-то.
  - Бутон **„✨ Генерирай мотивационно писмо“** (генерира персонализирано писмо в реално време).
  - Бутон **„Към обявата“** (отваря директния линк в нов таб).

### 5.3. 🔍 Търсене & Скрапване (`/search`)
- Превключватели за източници: `dev.bg`, `jobs.bg`, `linkedin`, `himalayas`, `euremotejobs`, `hackernews`.
- Избор на ключови думи: `AI Engineer`, `Agentic`, `LLM`, `Generative AI`, `Python` и др.
- Бутон **„🚀 Стартирай търсене“**.
- Терминален изглед с Live Logs напредък през WebSocket или polling от бекенда.

### 5.4. 👤 Профил & CV (`/profile`)
- Качване на CV (PDF).
- Автоматично AI извличане на:
  - Име, години опит, настояща позиция.
  - Търсена роля и ниво (Junior/Mid/Senior/Lead).
  - Технически умения (с възможност за ръчно добавяне/изтриване на тагове).
  - Предпочитания за работа (Remote, Hybrid, Onsite, Локация).

### 5.5. 📊 Пазарен Анализ & Skill Roadmap (`/insights`)
- Топ 15 най-търсени умения на пазара за AI/ML роли в момента (интерактивна графика).
- Разпределение на обявите по източници и локации.
- **Skill Roadmap:** Списък с умения, които най-често липсват в профила на потребителя за най-високоплатените роли, с отметки за напредък.

### 5.6. ⚙️ Настройки (`/settings`)
- Личен **Google Gemini API Key** (валидация на ключа на място).
- Избор на Gemini модел (`gemini-3.5-flash`, `gemini-3.8-flash`, `antigravity-preview-latest`).
- Черен списък за нежелани заглавия (напр. *WordPress, PHP, Intern*) и нежелани компании.

---

## 6. 🔌 FastAPI Спецификация (`src/api/`)

| Метод | Ендпойнт | Описание |
|---|---|---|
| `POST` | `/api/search/start` | Стартира скрапване на обяви във фонов процес за дадения `user_id` |
| `GET` | `/api/search/status/{task_id}` | Връща прогреса и последните логове от търсенето |
| `POST` | `/api/cv/parse` | Приема качен PDF файл, чете текста и го структурира с Gemini AI |
| `POST` | `/api/jobs/cover-letter` | Генерира мотивационно писмо за конкретна обява и профил |
| `GET` | `/api/market/stats` | Връща агрегирани данни за пазарните тенденции и умения |

---

## 7. 📋 Поетапен План за Изпълнение (Roadmap за новия агент)

### Фаза 1: Подготовка на Backend API (`src/api/`)
1. Създаване на FastAPI приложение в `src/api/main.py`.
2. Добавяне на рутери за скрапване, CV парсване и генериране на мотивационни писма.
3. Интегриране на съществуващия код от `src/intelligence/` и `src/scrapers/`.

### Фаза 2: Инициализиране на React Frontend (`frontend/`)
1. Създаване на Vite проект в директория `frontend/`:
   ```bash
   npm create vite@latest frontend -- --template react-ts
   cd frontend
   npm install
   npm install @supabase/supabase-js lucide-react clsx tailwindcss-animate
   ```
2. Конфигуриране на Tailwind CSS и дизайн система (тъмна тема, чиста естетика).
3. Настройка на Supabase Client (`src/lib/supabase.ts`) с променливи от `.env`.

### Фаза 3: Автентикация & Waitlist
1. Екран за Вход (`/login`) с автоматично запазване на сесията в браузъра.
2. Екран за Заявка за достъп (`WaitlistForm`).
3. Защитени маршрути (`ProtectedRoute`), пренасочващи нелогнати потребители.

### Фаза 4: Главен Дашборд за Обяви (`/jobs`)
1. Зареждане на позициите на потребителя от `user_jobs` + `jobs`.
2. Изглед Списък и Kanban борд със статуси (`New`, `Applied`, `Interview`, `Offer`, `Rejected`).
3. Филтриране по рейтинг, заплата, източник и ключови думи.
4. Модален прозорец с детайли за обявата и генератор на мотивационни писма.

### Фаза 5: CV Интелигентност & Профил (`/profile`)
1. Drag-and-drop компонент за качване на PDF.
2. Извикване на `/api/cv/parse` и визуализиране на уменията в тагове.
3. Синхронизиране на профила в таблица `user_settings`.

### Фаза 6: Търсачка & Real-time Logs (`/search`)
1. Форма за стартиране на търсене по източници.
2. Визуален терминал с логове в реално време за всяка обходена обява.

### Фаза 7: Пазарен Анализ, Настройки & Админ Панел
1. Графики за най-търсени умения и Skill Roadmap.
2. Управление на Gemini API ключ и черен списък.
3. Админ изглед за преглед и одобряване на чакащите кандидати от `access_requests`.

### Фаза 8: Финален Тест & Миграция
1. Тестване на адаптивността на телефони (iOS Safari / Android Chrome).
2. Верификация на изолацията на сесиите (множество потребители).
3. Мърджване на `feature/ui-v2` в `main`.

---

## 8. 🔑 Ключови Файлове и Референции в Проекта

- `supabase_schema.sql` — Пълната SQL схема с таблиците и RLS политиките.
- `src/intelligence/gemini_analyzer.py` — Логика за съвпадение на профил с обяви и генериране на резюмета.
- `src/intelligence/cv_parser.py` — AI екстрактор за умения от CV.
- `src/scrapers/` — Модули за обхождане на dev.bg, jobs.bg, linkedin и дистанционни портали.
- `run.py` — CLI и оркестратор на търсенето.
