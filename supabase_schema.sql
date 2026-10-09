-- ==============================================================================
-- Job Finder & Intelligence: Supabase Database Schema
-- Run this in the Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Глобален пул от обяви (Shared Jobs Pool)
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL,
    job_id TEXT NOT NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    salary TEXT,
    posted_date TEXT,
    description TEXT,
    search_keyword TEXT,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Индекси за бързо търсене и филтриране
CREATE INDEX IF NOT EXISTS idx_jobs_url ON public.jobs(url);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON public.jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_scraped_at ON public.jobs(scraped_at DESC);

-- 3. Персонални взаимодействия с обяви (User-Job Interactions)
-- Всеки потребител има свой собствен статус, бележки и AI оценки за дадена обява
CREATE TABLE IF NOT EXISTS public.user_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'new', -- 'new', 'applied', 'interview', 'offer', 'rejected', 'saved'
    match_score INTEGER,
    ai_summary TEXT,
    matched_skills JSONB DEFAULT '[]'::jsonb,
    missing_skills JSONB DEFAULT '[]'::jsonb,
    cover_letter TEXT,
    notes TEXT,
    notified BOOLEAN DEFAULT FALSE,
    notified_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_user_jobs_user_id ON public.user_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_jobs_status ON public.user_jobs(status);
CREATE INDEX IF NOT EXISTS idx_user_jobs_score ON public.user_jobs(match_score DESC);

-- 4. Лични потребителски настройки & Gemini API ключове
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    gemini_api_key TEXT,
    gemini_model TEXT DEFAULT 'antigravity',
    keywords JSONB DEFAULT '["AI Engineer", "Agentic", "LLM", "Generative AI"]'::jsonb,
    location TEXT DEFAULT 'Bulgaria',
    remote_location TEXT DEFAULT 'Worldwide',
    sources JSONB DEFAULT '{"dev_bg": true, "jobs_bg": true, "linkedin": true, "himalayas": true, "euremotejobs": true, "hackernews": true}'::jsonb,
    blacklist_titles JSONB DEFAULT '["Python Developer", "Python Dev", "Backend", "Frontend"]'::jsonb,
    blacklist_companies JSONB DEFAULT '[]'::jsonb,
    roadmap_progress JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Опашка за задачи за скрейпване (Scrape Tasks Queue)
CREATE TABLE IF NOT EXISTS public.scrape_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    sources JSONB DEFAULT '[]'::jsonb,
    keywords JSONB DEFAULT '[]'::jsonb,
    clean_choice TEXT DEFAULT 'keep_existing',
    log TEXT DEFAULT '',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scrape_tasks_status ON public.scrape_tasks(status);

-- ==============================================================================
-- 6. Row Level Security (RLS) Политики за сигурност
-- ==============================================================================

-- Активиране на RLS за всички таблици
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_tasks ENABLE ROW LEVEL SECURITY;

-- 6.1. Политики за 'jobs': Всички (анонимни и автентикирани) могат да четат и добавят обяви в общия каталог
DROP POLICY IF EXISTS "Allow authenticated users to read jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow authenticated users to insert jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow authenticated users to update jobs" ON public.jobs;

CREATE POLICY "Allow read jobs"
    ON public.jobs FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Allow insert jobs"
    ON public.jobs FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "Allow update jobs"
    ON public.jobs FOR UPDATE
    TO anon, authenticated
    USING (true);

-- 6.2. Политики за 'user_jobs': Потребителят има достъп САМО до своите записи
CREATE POLICY "Users can only read own job interactions"
    ON public.user_jobs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert own job interactions"
    ON public.user_jobs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update own job interactions"
    ON public.user_jobs FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete own job interactions"
    ON public.user_jobs FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 6.3. Политики за 'user_settings': Всеки потребител вижда/променя САМО своя API ключ и настройки
CREATE POLICY "Users can only read own settings"
    ON public.user_settings FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert/update own settings"
    ON public.user_settings FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update own settings"
    ON public.user_settings FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- 6.4. Политики за 'scrape_tasks'
CREATE POLICY "Users can read own tasks"
    ON public.scrape_tasks FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
    ON public.scrape_tasks FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
    ON public.scrape_tasks FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- 7. Автоматичен Trigger: Създаване на начален профил в user_settings при регистрация
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
