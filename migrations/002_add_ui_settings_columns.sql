-- Migration 002: Add ui_mode, theme, and max_jobs_per_source to public.user_settings
-- Run this in the Supabase SQL Editor if you want native columns in the table.
-- The backend also supports automatic fallback embedding inside roadmap_progress.

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS ui_mode TEXT DEFAULT 'simple';

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark';

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS max_jobs_per_source INTEGER DEFAULT 25;
