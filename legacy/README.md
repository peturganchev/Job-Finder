# 📜 Job-Finder v1: Legacy Streamlit Dashboard

This module preserves the original prototype implementation of **Job-Finder v1**, developed with **Streamlit**.

---

## 🎯 Historical Context & Migration to v2

In version 1, the project began as a rapid prototype combining Python scrapers, local SQLite storage, and Google Gemini evaluation inside a single Streamlit monolith (`app.py`).

As the platform evolved to require multi-tenant authentication, cloud data isolation via PostgreSQL, a mobile-first Kanban application board, and real-time streaming scraping telemetry, a strategic architectural transition to **Job-Finder v2** was implemented:
1. **Backend:** Replaced with a modular **FastAPI REST API** (`src/api/`) supporting asynchronous tasks and Server-Sent Events (SSE).
2. **Frontend:** Upgraded to a responsive **React 18 + Vite + TypeScript + Tailwind CSS** SPA client (`frontend/`).
3. **Database & Security:** Migrated to **Supabase PostgreSQL** utilizing strict Row-Level Security (RLS) policies.

---

## 🚀 Running the Legacy Streamlit Dashboard

For historical comparison or review:

```bash
streamlit run legacy/streamlit_app.py
```
or via the root CLI utility:
```bash
python run.py --legacy
```
