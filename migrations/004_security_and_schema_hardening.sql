-- Migration 004: Security Hardening (RLS + Waitlist Signup Guard) & Schema Alignment

ALTER TABLE public.user_settings
    ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS ui_mode TEXT DEFAULT 'simple',
    ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark',
    ADD COLUMN IF NOT EXISTS max_jobs_per_source INTEGER DEFAULT 25;

ALTER TABLE public.user_settings
    ALTER COLUMN sources SET DEFAULT '{"dev_bg": true, "jobs_bg": true, "linkedin": true, "euremotejobs": true, "hackernews": true}'::jsonb;

ALTER TABLE public.scrape_tasks
    ADD COLUMN IF NOT EXISTS task_id TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS logs JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS jobs_found INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_scrape_tasks_task_id ON public.scrape_tasks(task_id);

-- public.user_jobs strict RLS
ALTER TABLE public.user_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read user_jobs" ON public.user_jobs;
DROP POLICY IF EXISTS "Allow insert user_jobs" ON public.user_jobs;
DROP POLICY IF EXISTS "Allow update user_jobs" ON public.user_jobs;
DROP POLICY IF EXISTS "Allow delete user_jobs" ON public.user_jobs;
DROP POLICY IF EXISTS "Users can only read own job interactions" ON public.user_jobs;
DROP POLICY IF EXISTS "Users can only insert own job interactions" ON public.user_jobs;
DROP POLICY IF EXISTS "Users can only update own job interactions" ON public.user_jobs;
DROP POLICY IF EXISTS "Users can only delete own job interactions" ON public.user_jobs;

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

-- public.access_requests strict RLS
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert on access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Allow public read access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Allow authenticated read access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Allow update access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Allow authenticated update access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Allow delete access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Allow authenticated delete access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Allow admin read access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Allow admin update access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Allow admin delete access_requests" ON public.access_requests;

CREATE POLICY "Allow public insert on access_requests"
    ON public.access_requests FOR INSERT
    TO anon, authenticated
    WITH CHECK (status = 'pending');

CREATE POLICY "Allow admin read access_requests"
    ON public.access_requests FOR SELECT
    TO authenticated
    USING ((auth.jwt() ->> 'email') = 'peturganchev93@gmail.com');

CREATE POLICY "Allow admin update access_requests"
    ON public.access_requests FOR UPDATE
    TO authenticated
    USING ((auth.jwt() ->> 'email') = 'peturganchev93@gmail.com')
    WITH CHECK ((auth.jwt() ->> 'email') = 'peturganchev93@gmail.com');

CREATE POLICY "Allow admin delete access_requests"
    ON public.access_requests FOR DELETE
    TO authenticated
    USING ((auth.jwt() ->> 'email') = 'peturganchev93@gmail.com');

-- public.jobs & public.jobs_bg write restriction
DROP POLICY IF EXISTS "Allow read jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow insert jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow update jobs" ON public.jobs;

CREATE POLICY "Allow read jobs"
    ON public.jobs FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Allow insert jobs"
    ON public.jobs FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow update jobs"
    ON public.jobs FOR UPDATE
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert on jobs_bg" ON public.jobs_bg;
DROP POLICY IF EXISTS "Allow authenticated update on jobs_bg" ON public.jobs_bg;

-- Server-side waitlist signup guard trigger
CREATE OR REPLACE FUNCTION public.enforce_waitlist_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF lower(NEW.email) = 'peturganchev93@gmail.com' OR EXISTS (
        SELECT 1 FROM public.access_requests
        WHERE lower(email) = lower(NEW.email) AND status = 'approved'
    ) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Email % is not approved on the waitlist', NEW.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS check_waitlist_before_signup ON auth.users;
CREATE TRIGGER check_waitlist_before_signup
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.enforce_waitlist_approval();
