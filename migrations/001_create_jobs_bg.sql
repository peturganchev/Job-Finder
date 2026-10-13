-- ==============================================================================
-- Migration: Create jobs_bg Catalog Table
-- Run this in Supabase Dashboard -> SQL Editor
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.jobs_bg (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id TEXT, -- Външен ID в jobs.bg (напр. "8651561")
    url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    salary TEXT,
    description TEXT,
    skills JSONB DEFAULT '[]'::jsonb,
    category TEXT, -- Вътрешна категоризация (напр. 'IT - Software', 'Finance', 'Marketing'...)
    posted_date TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Индекси за светкавично търсене и филтриране
CREATE INDEX IF NOT EXISTS idx_jobs_bg_url ON public.jobs_bg(url);
CREATE INDEX IF NOT EXISTS idx_jobs_bg_active ON public.jobs_bg(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_bg_category ON public.jobs_bg(category);
CREATE INDEX IF NOT EXISTS idx_jobs_bg_created_at ON public.jobs_bg(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_bg_skills ON public.jobs_bg USING GIN(skills);

-- Row Level Security (RLS)
ALTER TABLE public.jobs_bg ENABLE ROW LEVEL SECURITY;

-- Публично четене за всички потребители (анонимни и автентикирани)
DROP POLICY IF EXISTS "Allow public read on jobs_bg" ON public.jobs_bg;
CREATE POLICY "Allow public read on jobs_bg" 
ON public.jobs_bg FOR SELECT 
USING (true);

-- Запис и обновяване от бекенда (Service role & Authenticated)
DROP POLICY IF EXISTS "Allow authenticated insert on jobs_bg" ON public.jobs_bg;
CREATE POLICY "Allow authenticated insert on jobs_bg" 
ON public.jobs_bg FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update on jobs_bg" ON public.jobs_bg;
CREATE POLICY "Allow authenticated update on jobs_bg" 
ON public.jobs_bg FOR UPDATE 
USING (true);
