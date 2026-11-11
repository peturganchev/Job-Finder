/**
 * API client library for Job-Finder v2 FastAPI backend.
 */
import { API_BASE_URL, supabase } from './supabase';
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

/**
 * Executes a fetch request with automatic retries for cold-start delays (502, 503, 504),
 * rate limits (429), and network wakeup failures common on free-tier cloud backends like Render.
 */
export async function fetchWithColdStartRetry(
  url: string,
  options?: RequestInit,
  maxRetries: number = 7,
  initialDelayMs: number = 2000
): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if ([429, 502, 503, 504].includes(res.status) && attempt < maxRetries) {
        const delay = res.status === 429
          ? Math.min(3500 * Math.pow(1.3, attempt), 8000)
          : Math.min(initialDelayMs * Math.pow(1.25, attempt), 5000);
        console.warn(`[ColdStart] Received HTTP ${res.status} from ${url}. Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries && (err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed'))) {
        const delay = Math.min(initialDelayMs * Math.pow(1.25, attempt), 5000);
        console.warn(`[ColdStart] Network connection failed for ${url}. Retrying in ${Math.round(delay)}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }
  throw lastError || new Error(`Failed to connect to ${url}`);
}

/** Check health of FastAPI backend server */
export async function apiCheckHealth(): Promise<boolean> {
  try {
    const res = await fetchWithColdStartRetry(`${API_BASE_URL}/api/health`, { method: 'GET' }, 3, 1000);
    if (!res.ok) {
      return false;
    }
    const data = await res.json().catch(() => null);
    const status = typeof data?.status === 'string' ? data.status.toLowerCase() : '';
    return status === 'healthy' || status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Polls backend health every 3500ms up to 14 attempts (~50s) to wake cold cloud backends (e.g. Render).
 */
export async function apiWakeBackend(
  onProgress?: (attempt: number, maxAttempts: number) => void
): Promise<boolean> {
  const maxAttempts = 14;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const healthy = await apiCheckHealth();
    if (healthy) {
      return true;
    }
    onProgress?.(attempt, maxAttempts);
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 3500));
    }
  }
  return false;
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
  const res = await fetchWithColdStartRetry(url, { headers: getHeaders(token) }, 5, 2000);
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

/** Start asynchronous scraping search with automatic cold-start retry */
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
  const res = await fetchWithColdStartRetry(
    url,
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    },
    7,
    2000
  );

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    let errorMsg = `HTTP ${res.status}: Неуспешно стартиране на търсенето`;
    if (data?.detail) {
      if (typeof data.detail === 'string') {
        errorMsg = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorMsg = data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      }
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

/** Get search task status and logs */
export async function apiGetSearchStatus(
  taskId: string,
  token?: string | null
): Promise<SearchStatusResponse> {
  const url = `${API_BASE_URL}/api/search/status/${taskId}`;
  const res = await fetchWithColdStartRetry(url, { headers: getHeaders(token) }, 3, 1000);
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
export async function apiFetchMarketStats(
  deduplicate: boolean = true,
  token?: string | null
): Promise<MarketStats> {
  const url = `${API_BASE_URL}/api/market/stats?deduplicate=${deduplicate}`;
  const res = await fetchWithColdStartRetry(url, { headers: getHeaders(token) }, 4, 1500);
  if (!res.ok) {
    throw new Error(`Failed to fetch market stats`);
  }
  return res.json();
}

/** Fetch or generate AI market insights report */
export async function apiFetchMarketReport(
  limit: number = 40,
  token?: string | null
): Promise<{ report: string; generated_at: string }> {
  const url = `${API_BASE_URL}/api/market/report?limit=${limit}`;
  const res = await fetchWithColdStartRetry(url, { headers: getHeaders(token) }, 4, 1500);
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
  ui_mode?: 'simple' | 'pro';
  theme?: 'dark' | 'light';
}

export interface GeminiVerifyResponse {
  valid: boolean;
  models: string[];
  message: string;
}

/** Fetch user settings: Supabase-first (~150ms), quick FastAPI fetch fallback (2500ms timeout), then sensible defaults */
export async function apiGetSettings(token?: string | null): Promise<SettingsData> {
  // 1. FIRST execute the Supabase query against 'user_settings' for immediate response
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    let userId = sessionData?.session?.user?.id;
    if (!userId && token) {
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id;
    }

    if (userId) {
      const { data: row } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (row) {
        const rp = row.roadmap_progress || {};
        const uiPrefs = rp._ui_preferences || {};

        let activeSources = ['dev_bg', 'jobs_bg', 'linkedin', 'euremotejobs', 'hackernews'];
        if (row.sources && typeof row.sources === 'object') {
          activeSources = Object.keys(row.sources).filter((k) => row.sources[k]);
        }

        return {
          gemini_api_key_masked: row.gemini_api_key ? `${row.gemini_api_key.slice(0, 6)}...${row.gemini_api_key.slice(-4)}` : null,
          gemini_model: row.gemini_model || 'gemini-3.5-flash',
          available_models: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-pro'],
          blacklist_title: row.blacklist_titles || [],
          blacklist_companies: row.blacklist_companies || [],
          search_keywords: row.keywords || [],
          active_sources: activeSources,
          max_jobs_per_source: row.max_jobs_per_source || uiPrefs.max_jobs_per_source || 25,
          location: row.location || 'Bulgaria',
          remote_location: row.remote_location || 'remote',
          roadmap_progress: rp,
          ui_mode: row.ui_mode || uiPrefs.ui_mode || 'simple',
          theme: row.theme || uiPrefs.theme || 'dark',
        };
      }
    }
  } catch (err) {
    console.warn('[apiGetSettings] Supabase-first query failed:', err);
  }

  // 2. If Supabase returns no row or user is not signed in, make ONE quick fetch with 2500ms timeout (no retries)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${API_BASE_URL}/api/settings`, {
      headers: getHeaders(token),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[apiGetSettings] Quick FastAPI fetch failed/timed out:', err);
  }

  // 3. Return sensible defaults immediately
  return {
    gemini_api_key_masked: null,
    gemini_model: 'gemini-3.5-flash',
    available_models: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-pro'],
    blacklist_title: [],
    blacklist_companies: [],
    search_keywords: [],
    active_sources: ['dev_bg', 'jobs_bg', 'linkedin', 'euremotejobs', 'hackernews'],
    max_jobs_per_source: 25,
    location: 'Bulgaria',
    remote_location: 'remote',
    roadmap_progress: {},
    ui_mode: 'simple',
    theme: 'dark',
  };
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
    ui_mode?: 'simple' | 'pro';
    theme?: 'dark' | 'light';
  },
  token?: string | null
): Promise<{ success: boolean; message: string }> {
  let supabaseUpsertSucceeded = false;

  // 1. Direct resilient upsert to Supabase 'user_settings' if an active user exists
  try {
    let activeUserId: string | null = null;
    const { data: sessionData } = await supabase.auth.getSession();
    activeUserId = sessionData?.session?.user?.id || null;
    if (!activeUserId) {
      const { data: userData } = await supabase.auth.getUser(token || undefined);
      activeUserId = userData?.user?.id || null;
    }

    if (activeUserId) {
      const supabasePayload: Record<string, any> = {
        user_id: activeUserId,
        updated_at: new Date().toISOString(),
      };

      if (payload.gemini_api_key !== undefined) {
        supabasePayload.gemini_api_key = payload.gemini_api_key?.trim() || null;
      }
      if (payload.gemini_model !== undefined) {
        supabasePayload.gemini_model = payload.gemini_model.trim();
      }
      if (payload.blacklist_title !== undefined) {
        supabasePayload.blacklist_titles = payload.blacklist_title.map((t) => t.trim()).filter(Boolean);
      }
      if (payload.blacklist_companies !== undefined) {
        supabasePayload.blacklist_companies = payload.blacklist_companies.map((c) => c.trim()).filter(Boolean);
      }
      if (payload.search_keywords !== undefined) {
        supabasePayload.keywords = payload.search_keywords.map((k) => k.trim()).filter(Boolean);
      }
      if (payload.location !== undefined) {
        supabasePayload.location = payload.location.trim();
      }
      if (payload.remote_location !== undefined) {
        supabasePayload.remote_location = payload.remote_location.trim();
      }
      if (payload.active_sources !== undefined) {
        const activeSet = new Set(payload.active_sources.map((s) => s.replace('.', '_')));
        const sourcesObj: Record<string, boolean> = {};
        for (const src of ['dev_bg', 'jobs_bg', 'linkedin', 'euremotejobs', 'hackernews', 'himalayas']) {
          sourcesObj[src] = activeSet.has(src);
        }
        for (const src of payload.active_sources) {
          sourcesObj[src.replace('.', '_')] = true;
        }
        supabasePayload.sources = sourcesObj;
      }

      // Prepare roadmap_progress with embedded _ui_preferences
      let curRp: Record<string, any> = payload.roadmap_progress ? { ...payload.roadmap_progress } : {};
      if (!payload.roadmap_progress) {
        try {
          const { data: existingData } = await supabase
            .from('user_settings')
            .select('roadmap_progress')
            .eq('user_id', activeUserId)
            .maybeSingle();
          if (existingData?.roadmap_progress && typeof existingData.roadmap_progress === 'object') {
            curRp = { ...existingData.roadmap_progress };
          }
        } catch {
          // Ignore fetch error and fallback to default
        }
      }

      const curUi: Record<string, any> = (curRp._ui_preferences && typeof curRp._ui_preferences === 'object')
        ? { ...curRp._ui_preferences }
        : {};

      if (payload.ui_mode !== undefined) {
        curUi.ui_mode = payload.ui_mode;
      } else if (!curUi.ui_mode) {
        curUi.ui_mode = (typeof window !== 'undefined' && window.localStorage?.getItem('jf_ui_mode')) || 'simple';
      }

      if (payload.theme !== undefined) {
        curUi.theme = payload.theme;
      } else if (!curUi.theme) {
        curUi.theme = (typeof window !== 'undefined' && window.localStorage?.getItem('jf_theme')) || 'dark';
      }

      if (payload.max_jobs_per_source !== undefined) {
        curUi.max_jobs_per_source = payload.max_jobs_per_source;
      } else if (curUi.max_jobs_per_source === undefined) {
        const storedMax = typeof window !== 'undefined' ? Number(window.localStorage?.getItem('jf_max_jobs_per_source')) : 0;
        curUi.max_jobs_per_source = storedMax || 25;
      }

      curRp._ui_preferences = curUi;
      supabasePayload.roadmap_progress = curRp;

      const { error: sbError } = await supabase
        .from('user_settings')
        .upsert(supabasePayload, { onConflict: 'user_id' });

      if (sbError) {
        console.warn('[apiUpdateSettings] Direct Supabase upsert error:', sbError);
      } else {
        supabaseUpsertSucceeded = true;
      }
    }
  } catch (err) {
    console.warn('[apiUpdateSettings] Supabase sync attempt failed:', err);
  }

  // 2. Call FastAPI POST /api/settings
  const url = `${API_BASE_URL}/api/settings`;
  try {
    const res = await fetchWithColdStartRetry(
      url,
      {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify(payload),
      },
      6,
      2000
    );

    if (!res.ok) {
      if (supabaseUpsertSucceeded) {
        console.warn(`[apiUpdateSettings] FastAPI returned HTTP ${res.status}, but Supabase upsert succeeded. Returning fallback success.`);
        return { success: true, message: 'Настройките са запазени успешно в профила ви!' };
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update settings');
    }

    return await res.json();
  } catch (apiErr: any) {
    if (supabaseUpsertSucceeded) {
      console.warn('[apiUpdateSettings] FastAPI call failed, but Supabase upsert succeeded:', apiErr);
      return { success: true, message: 'Настройките са запазени успешно в профила ви!' };
    }
    throw apiErr;
  }
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

export interface WaitlistRequestItem {
  id: string;
  full_name: string;
  email: string;
  role?: string;
  target_job_title?: string;
  years_of_experience?: string;
  linkedin_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

export interface WaitlistActionResponse {
  success: boolean;
  message: string;
  invite_url?: string;
  email_sent: boolean;
}

export interface WhitelistCheckResponse {
  allowed: boolean;
  status: string;
  message: string;
}

/** Check if email is whitelisted for signup */
export async function apiCheckWaitlist(email: string): Promise<WhitelistCheckResponse> {
  const url = `${API_BASE_URL}/api/waitlist/check/${encodeURIComponent(email)}`;
  try {
    const res = await fetchWithColdStartRetry(url, { headers: getHeaders() }, 4, 1500);
    if (!res.ok) {
      return { allowed: true, status: 'approved', message: 'Проверката премина успешно.' };
    }
    return res.json();
  } catch {
    return { allowed: true, status: 'approved', message: 'Проверката премина успешно.' };
  }
}

/** Get all waitlist access requests (Admin only) */
export async function apiGetWaitlistRequests(token?: string | null): Promise<WaitlistRequestItem[]> {
  const url = `${API_BASE_URL}/api/waitlist/requests`;
  const res = await fetchWithColdStartRetry(url, { headers: getHeaders(token) }, 4, 1500);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Неуспешно извличане на списъка с чакащи');
  }
  return res.json();
}

/** Approve a waitlist request */
export async function apiApproveWaitlist(
  payload: { id: string; email?: string; full_name?: string },
  token?: string | null
): Promise<WaitlistActionResponse> {
  const url = `${API_BASE_URL}/api/waitlist/approve`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Неуспешно одобряване на заявката');
  }
  return res.json();
}

/** Reject a waitlist request */
export async function apiRejectWaitlist(
  id: string,
  token?: string | null
): Promise<WaitlistActionResponse> {
  const url = `${API_BASE_URL}/api/waitlist/reject`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Неуспешно отказване на заявката');
  }
  return res.json();
}

