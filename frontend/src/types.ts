export type ApplicationStatus =
  | 'new'
  | 'saved'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'archived';

export interface Job {
  id: string | number;
  job_id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  salary?: string | null;
  posted_date?: string | null;
  description?: string | null;
  source: string;
  status: ApplicationStatus;
  match_score?: number | null;
  ai_summary?: string | null;
  matched_skills?: string[];
  missing_skills?: string[];
  cover_letter?: string | null;
  search_keyword?: string | null;
  scraped_at?: string;
  notified?: boolean;
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  current_title?: string;
  skills?: string[];
  experience_years?: number;
}

export interface MarketSkillItem {
  skill: string;
  count: number;
  percentage: number;
}

export interface MarketStats {
  total_jobs: number;
  avg_match_score: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  top_skills: MarketSkillItem[];
}

export type UIMode = 'simple' | 'pro';
export type UITheme = 'dark' | 'light';

export interface UserSettings {
  gemini_api_key_masked?: string | null;
  gemini_model?: string;
  available_models?: string[];
  blacklist_title?: string[];
  blacklist_companies?: string[];
  search_keywords?: string[];
  active_sources?: string[];
  max_jobs_per_source?: number;
  location?: string;
  remote_location?: string;
  roadmap_progress?: Record<string, any>;
  ui_mode?: UIMode;
  theme?: UITheme;
}

