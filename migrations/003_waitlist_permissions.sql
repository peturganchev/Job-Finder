-- ==============================================================================
-- Migration 003: Waitlist Access Requests Permissions & Policies
-- ==============================================================================

-- 1. Ensure table structure
CREATE TABLE IF NOT EXISTS public.access_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON public.access_requests(email);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.access_requests(status);

-- 3. Enable RLS
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- 4. Allow public insert (anyone can join waitlist)
DROP POLICY IF EXISTS "Allow public insert on access_requests" ON public.access_requests;
CREATE POLICY "Allow public insert on access_requests"
    ON public.access_requests FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 5. Allow read (for whitelist verification during registration and admin view)
DROP POLICY IF EXISTS "Allow public read access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Allow authenticated read access_requests" ON public.access_requests;
CREATE POLICY "Allow public read access_requests"
    ON public.access_requests FOR SELECT
    TO anon, authenticated
    USING (true);

-- 6. Allow update (for approving or rejecting requests)
DROP POLICY IF EXISTS "Allow update access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Allow authenticated update access_requests" ON public.access_requests;
CREATE POLICY "Allow update access_requests"
    ON public.access_requests FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 7. Allow delete (for removing requests)
DROP POLICY IF EXISTS "Allow delete access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "Allow authenticated delete access_requests" ON public.access_requests;
CREATE POLICY "Allow delete access_requests"
    ON public.access_requests FOR DELETE
    TO anon, authenticated
    USING (true);
