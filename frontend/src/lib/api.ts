/**
 * API client library for Job-Finder v2 FastAPI backend.
 */
import { API_BASE_URL } from './supabase';
import type { Job, MarketStats } from '../types';

export interface JobListResponse {
  jobs: Job[];
  total: number;
}

export interface SearchStartResponse {
  task_id: string;
  status: string;
  progress: number;
  logs: string[];
  jobs_found: number;
}

export interface SearchStatusResponse {
  task_id: string;
  status: string;
  progress: number;
  logs: string[];
  jobs_found: number;
  error?: string | null;
}

export interface CVParseResult {
  name?: string;
  current_title?: string;
  summary?: string;
  current_skills: string[];
  experience_years?: number;
  target_roles: string[];
  languages: string[];
  raw_text?: string;
  success: boolean;
}

export interface CoverLetterResponse {
  job_id?: string | number | null;
  cover_letter: string;
  success: boolean;
}

function getHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/** Fetch jobs with optional filtering */
export async function apiFetchJobs(
  params?: {
    status?: string;
    min_score?: number;
    source?: string;
    search_keyword?: string;
    limit?: number;
  },
  token?: string | null
): Promise<JobListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.min_score !== undefined) query.append('min_score', params.min_score.toString());
  if (params?.source) query.append('source', params.source);
  if (params?.search_keyword) query.append('search_keyword', params.search_keyword);
  if (params?.limit) query.append('limit', params.limit.toString());

  const url = `${API_BASE_URL}/api/jobs${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, { headers: getHeaders(token) });
  if (!res.ok) {
    throw new Error(`Failed to fetch jobs: ${res.statusText}`);
  }
  return res.json();
}

/** Update application status */
export async function apiUpdateJobStatus(
  jobId: string | number,
  newStatus: string,
  token?: string | null
): Promise<{ success: boolean; message: string }> {
  const url = `${API_BASE_URL}/api/jobs/${jobId}/status`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(token),
    body: JSON.stringify({ status: newStatus }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update status`);
  }
  return res.json();
}

/** Delete a job */
export async function apiDeleteJob(
  jobId: string | number,
  token?: string | null
): Promise<{ success: boolean }> {
  const url = `${API_BASE_URL}/api/jobs/${jobId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to delete job`);
  }
  return res.json();
}

/** Generate a customized cover letter */
export async function apiGenerateCoverLetter(
  payload: {
    job_id?: string | number;
    title?: string;
    company?: string;
    description?: string;
    profile_data?: Record<string, unknown>;
  },
  token?: string | null
): Promise<CoverLetterResponse> {
  const url = `${API_BASE_URL}/api/jobs/cover-letter`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to generate cover letter`);
  }
  return res.json();
}

/** Start asynchronous scraping search */
export async function apiStartSearch(
  payload: {
    keywords?: string[];
    sources?: string[];
    max_jobs?: number;
    clear_new?: boolean;
    clear_all?: boolean;
  },
  token?: string | null
): Promise<SearchStartResponse> {
  const url = `${API_BASE_URL}/api/search/start`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to initiate search`);
  }
  return res.json();
}

/** Get search task status and logs */
export async function apiGetSearchStatus(
  taskId: string,
  token?: string | null
): Promise<SearchStatusResponse> {
  const url = `${API_BASE_URL}/api/search/status/${taskId}`;
  const res = await fetch(url, {
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Failed to get search task status`);
  }
  return res.json();
}

/** Parse CV from text or PDF file */
export async function apiParseCV(
  formData: FormData,
  token?: string | null
): Promise<CVParseResult> {
  const url = `${API_BASE_URL}/api/cv/parse`;
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to parse CV`);
  }
  return res.json();
}

/** Parse CV from plain text */
export async function apiParseCVText(
  text: string,
  token?: string | null
): Promise<CVParseResult> {
  const url = `${API_BASE_URL}/api/cv/parse-text`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to parse CV text`);
  }
  return res.json();
}

/** Fetch market statistics */
export async function apiFetchMarketStats(): Promise<MarketStats> {
  const url = `${API_BASE_URL}/api/market/stats`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch market stats`);
  }
  return res.json();
}

/** Fetch or generate AI market insights report */
export async function apiFetchMarketReport(limit: number = 40): Promise<{ report: string; generated_at: string }> {
  const url = `${API_BASE_URL}/api/market/report?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch market report`);
  }
  return res.json();
}


export interface SettingsData {
  gemini_api_key_masked?: string | null;
  gemini_model: string;
  available_models: string[];
  blacklist_title: string[];
  blacklist_companies: string[];
  search_keywords: string[];
  active_sources: string[];
  max_jobs_per_source: number;
  location: string;
  remote_location: string;
  roadmap_progress: Record<string, unknown>;
}

export interface GeminiVerifyResponse {
  valid: boolean;
  models: string[];
  message: string;
}

/** Fetch user settings */
export async function apiGetSettings(token?: string | null): Promise<SettingsData> {
  const url = `${API_BASE_URL}/api/settings`;
  const res = await fetch(url, { headers: getHeaders(token) });
  if (!res.ok) {
    throw new Error(`Failed to fetch settings: ${res.statusText}`);
  }
  return res.json();
}

/** Update user settings */
export async function apiUpdateSettings(
  payload: {
    gemini_api_key?: string | null;
    gemini_model?: string;
    blacklist_title?: string[];
    blacklist_companies?: string[];
    search_keywords?: string[];
    active_sources?: string[];
    max_jobs_per_source?: number;
    location?: string;
    remote_location?: string;
    roadmap_progress?: Record<string, unknown>;
  },
  token?: string | null
): Promise<{ success: boolean; message: string }> {
  const url = `${API_BASE_URL}/api/settings`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update settings');
  }
  return res.json();
}

/** Verify a Gemini API Key */
export async function apiVerifyGeminiKey(apiKey: string): Promise<GeminiVerifyResponse> {
  const url = `${API_BASE_URL}/api/settings/verify-gemini`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to verify key');
  }
  return res.json();
}

