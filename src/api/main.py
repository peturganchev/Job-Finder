"""
Job-Finder v2 FastAPI Main Application.
Provides REST API endpoints for the React frontend, background scrapers, and Gemini AI intelligence.
"""
import os
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.schemas import HealthResponse
from src.api.routers import jobs, search, cv, market, settings

app = FastAPI(
    title="Job-Finder Market Intelligence API",
    description="Autonomous AI/ML job search, matching, and intelligence platform for Bulgaria & Remote",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Configuration for React Frontend
origins = [
    "http://localhost:5173",  # Vite Dev Server
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", summary="Root index")
def root_index():
    return {
        "name": "Job-Finder Market Intelligence API",
        "version": "2.0.0",
        "docs": "/docs",
        "status": "active",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/health", response_model=HealthResponse, summary="Service health check")
def health_check():
    """Returns server and database status."""
    is_supabase = bool(os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")))
    return HealthResponse(
        status="healthy",
        version="2.0.0",
        timestamp=datetime.now().isoformat(),
        database="Supabase (PostgreSQL)" if is_supabase else "SQLite (Local fallback)",
    )


# Include modular route handlers
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(search.router, prefix="/api/search", tags=["Search & Scraping"])
app.include_router(cv.router, prefix="/api/cv", tags=["CV & Applications"])
app.include_router(market.router, prefix="/api/market", tags=["Market Intelligence"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.api.main:app", host="0.0.0.0", port=8000, reload=True)
