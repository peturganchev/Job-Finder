import { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { MobileNav } from './components/MobileNav';
import { AuthModal } from './components/AuthModal';
import { WaitlistModal } from './components/WaitlistModal';
import { WaitlistAdminModal } from './components/WaitlistAdminModal';
import { UnifiedJobsView } from './components/UnifiedJobsView';
import { JobDetailModal } from './components/JobDetailModal';
import { SearchView } from './components/SearchView';
import { ProfileView } from './components/ProfileView';
import { InsightsView } from './components/InsightsView';
import { SettingsView } from './components/SettingsView';
import { RoadmapPortfolioView } from './components/RoadmapPortfolioView';
import { apiFetchJobs, apiUpdateJobStatus, apiDeleteJob, apiFetchMarketStats, apiGetSettings, apiCheckHealth, apiWakeBackend } from './lib/api';
import type { Job, ApplicationStatus, MarketStats, UIMode } from './types';
import { Sparkles, Lock, LogIn, Cpu } from 'lucide-react';


function AppContent() {
  const { user, session, loading: authLoading } = useAuth();
  const { applyServerTheme } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();

  // 1. Detect if the user arrived via registration/invite link (?register=true, #register, or #type=invite)
  const initialInvite = (() => {
    try {
      const search = window.location.search || '';
      const hash = window.location.hash || '';

      // Check search query (e.g. ?register=true&email=...)
      if (search.includes('register') || search.includes('email=')) {
        const params = new URLSearchParams(search);
        return {
          isInvite: true,
          email: params.get('email') || '',
          mode: 'signup' as const,
        };
      }

      // Check hash (e.g. #register?email=... or #register)
      if (hash.startsWith('#register')) {
        const queryPart = hash.includes('?') ? hash.split('?')[1] : '';
        const params = new URLSearchParams(queryPart);
        return {
          isInvite: true,
          email: params.get('email') || '',
          mode: 'signup' as const,
        };
      }

      // Check Supabase invite/recovery token (e.g. #type=invite or #type=recovery)
      if (hash.includes('type=invite') || hash.includes('type=recovery')) {
        return {
          isInvite: true,
          email: '',
          mode: 'signup' as const,
        };
      }
    } catch {
      // ignore
    }
    return { isInvite: false, email: '', mode: 'signin' as const };
  })();

  const [currentTab, setCurrentTab] = useState<string>(() => {
    try {
      if (!initialInvite.isInvite) {
        const hash = window.location.hash.replace('#', '');
        const validTabs = ['jobs', 'search', 'roadmap', 'profile', 'insights', 'settings'];
        if (hash && validTabs.includes(hash)) {
          return hash;
        }
        const saved = localStorage.getItem('jobfinder_active_tab');
        if (saved && validTabs.includes(saved)) {
          return saved;
        }
      }
    } catch {
      // ignore
    }
    return 'jobs';
  });

  // Modals state initialized directly from URL!
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(initialInvite.isInvite);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>(initialInvite.mode);
  const [authModalEmail, setAuthModalEmail] = useState<string>(initialInvite.email ? decodeURIComponent(initialInvite.email) : '');
  const [isWaitlistOpen, setIsWaitlistOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin', email: string = '') => {
    setAuthModalMode(mode);
    setAuthModalEmail(email);
    setIsAuthOpen(true);
  };

  // Selected Job for Detail Modal
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Jobs data (always loaded fresh from the API for the signed-in user)
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(true);

  // Market stats data for insights tab
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  // FastAPI health check & wakeup state
  const [apiHealthy, setApiHealthy] = useState<boolean>(false);
  const [apiWaking, setApiWaking] = useState<boolean>(false);

  // Always use the latest access token without re-creating callbacks on every token refresh
  const tokenRef = useRef<string | undefined>(session?.access_token);
  useEffect(() => {
    tokenRef.current = session?.access_token;
  }, [session?.access_token]);

  // Monotonic counter: only the most recent jobs request may update the state
  const jobsRequestId = useRef(0);

  // Load jobs from API
  const loadJobs = useCallback(async () => {
    const requestId = ++jobsRequestId.current;
    setLoadingJobs(true);
    try {
      const data = await apiFetchJobs({}, tokenRef.current);
      if (requestId !== jobsRequestId.current) return; // stale response
      setJobs(data.jobs || []);
      setApiHealthy(true);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      if (requestId === jobsRequestId.current) setLoadingJobs(false);
    }
  }, []);

  // Wake FastAPI backend on Render
  const handleWakeBackend = useCallback(async () => {
    if (apiWaking || apiHealthy) return;
    setApiWaking(true);
    showInfo('⚡ Стартиране на FastAPI сървъра в Render... Обикновено отнема ~35-45 секунди.');
    try {
      const ok = await apiWakeBackend((attempt, max) => {
        console.log(`[FastAPI Wakeup] Attempt ${attempt}/${max}...`);
      });
      if (ok) {
        setApiHealthy(true);
        setApiWaking(false);
        showSuccess('✅ FastAPI сървърът е онлайн и готов за търсене!');
        loadJobs();
      } else {
        setApiWaking(false);
        showError('⚠️ Сървърът се забави. Моля, опитайте отново след малко.');
      }
    } catch (err) {
      console.error('Error waking backend:', err);
      setApiWaking(false);
      showError('⚠️ Възникна грешка при събуждане на сървъра.');
    }
  }, [apiWaking, apiHealthy, showInfo, showSuccess, showError, loadJobs]);

  // Load market statistics (with deduplication support)
  const loadStats = useCallback(async (deduplicate: boolean = true) => {
    setLoadingStats(true);
    try {
      const data = await apiFetchMarketStats(deduplicate, tokenRef.current);
      setMarketStats(data);
      setApiHealthy(true);
    } catch (err) {
      console.error('Error fetching market stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // UI Mode (Simple vs Pro)
  const [uiMode, setUiMode] = useState<UIMode>(() => {
    try {
      const saved = localStorage.getItem('jf_ui_mode');
      return saved === 'pro' ? 'pro' : 'simple';
    } catch {
      return 'simple';
    }
  });

  const proOnlyTabs = ['search', 'roadmap', 'insights'];
  const activeTab = uiMode === 'simple' && proOnlyTabs.includes(currentTab) ? 'jobs' : currentTab;

  useEffect(() => {
    try {
      if (!initialInvite.isInvite) {
        localStorage.setItem('jobfinder_active_tab', activeTab);
        window.location.hash = activeTab;
      }
    } catch {
      // ignore
    }
  }, [activeTab, initialInvite.isInvite]);

  const [activeSources, setActiveSources] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('jf_active_sources');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((s: string) => s.replace('.', '_'));
        }
      }
    } catch {}
    return [
      'dev_bg',
      'jobs_bg',
      'linkedin',
      'euremotejobs',
      'hackernews',
    ];
  });
  const [maxJobsPerSource, setMaxJobsPerSource] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('jf_max_jobs_per_source');
      if (saved) return Number(saved) || 25;
    } catch {}
    return 25;
  });

  // Load settings on login to sync UI Mode, Sources, and Limits
  const loadSettings = useCallback(async () => {
    try {
      const data = await apiGetSettings(tokenRef.current);
      if (data.ui_mode) {
        setUiMode(data.ui_mode);
        localStorage.setItem('jf_ui_mode', data.ui_mode);
      }
      if (data.theme) {
        applyServerTheme(data.theme);
      }
      if (data.active_sources && data.active_sources.length > 0) {
        const normalized = data.active_sources.map((s) => s.replace('.', '_'));
        setActiveSources(normalized);
        localStorage.setItem('jf_active_sources', JSON.stringify(normalized));
      }
      if (data.max_jobs_per_source) {
        setMaxJobsPerSource(data.max_jobs_per_source);
        localStorage.setItem('jf_max_jobs_per_source', String(data.max_jobs_per_source));
      }
      setApiHealthy(true);
    } catch (err) {
      console.error('Failed to load settings in App:', err);
    }
  }, [applyServerTheme]);

  // Initial health check & auto-wake on mount
  const wakeTriggeredRef = useRef(false);
  useEffect(() => {
    if (wakeTriggeredRef.current) return;
    wakeTriggeredRef.current = true;
    apiCheckHealth().then((isHealthy) => {
      if (isHealthy) {
        setApiHealthy(true);
      } else {
        handleWakeBackend();
      }
    });
  }, [handleWakeBackend]);

  const currentUserId = user?.id ?? null;
  const [prevAuthUserId, setPrevAuthUserId] = useState<string | null>(currentUserId);
  if (prevAuthUserId !== currentUserId) {
    setPrevAuthUserId(currentUserId);
    if (!currentUserId) {
      setJobs([]);
      setMarketStats(null);
      setLoadingJobs(false);
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    if (!currentUserId) return;
    const initTimer = setTimeout(() => {
      loadJobs();
    }, 0);
    const timer = setTimeout(() => {
      loadSettings();
      loadStats();
    }, 400);
    return () => {
      clearTimeout(initTimer);
      clearTimeout(timer);
    };
  }, [currentUserId, loadJobs, loadStats, loadSettings]);

  // Auto-refresh whenever the user returns to the jobs tab
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (currentUserId && activeTab === 'jobs' && prevTabRef.current !== 'jobs') {
      const refreshTimer = setTimeout(() => {
        loadJobs();
      }, 0);
      prevTabRef.current = activeTab;
      return () => clearTimeout(refreshTimer);
    }
    prevTabRef.current = activeTab;
  }, [activeTab, currentUserId, loadJobs]);

  // Optimistic Job Status Update
  const handleStatusChange = async (jobId: string | number, newStatus: ApplicationStatus) => {
    const prevJobs = [...jobs];
    // Optimistic UI update
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
    );
    if (selectedJob && selectedJob.id === jobId) {
      setSelectedJob({ ...selectedJob, status: newStatus });
    }

    try {
      await apiUpdateJobStatus(jobId, newStatus, session?.access_token);
    } catch (err) {
      console.error('Status update failed, rolling back:', err);
      setJobs(prevJobs); // Rollback
    }
  };

  // Job Delete
  const handleDeleteJob = async (jobId: string | number) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    try {
      await apiDeleteJob(jobId, session?.access_token);
    } catch (err) {
      console.error('Job delete failed:', err);
      loadJobs();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-pulse">
            <Cpu className="w-7 h-7 text-on-accent font-bold" />
          </div>
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium tracking-wide">Проверка на защитена сесия...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Navigation */}
      <Navbar
        currentTab={activeTab}
        onSelectTab={setCurrentTab}
        onOpenAuth={() => handleOpenAuth('signin')}
        onOpenWaitlist={() => setIsWaitlistOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        apiHealthy={apiHealthy}
        apiWaking={apiWaking}
        onWakeBackend={handleWakeBackend}
        uiMode={uiMode}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 pb-24 md:pb-8 flex flex-col">
        {!user ? (
          <div className="flex-1 flex items-center justify-center py-8 sm:py-16">
            <div className="max-w-xl w-full mx-auto p-8 sm:p-12 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-xl text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
              {/* Background Ambient Glow */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                <Lock className="w-8 h-8" />
              </div>

              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
                Защитена AI Платформа
              </span>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
                Изисква се Вход в Системата
              </h2>

              <p className="text-sm text-slate-300 leading-relaxed mb-8 max-w-md mx-auto">
                За достъп до обявите, Kanban таблото, автономния скрапър, пазарните анализи и AI инструментите, моля влезте с вашия профил.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                <button
                  onClick={() => handleOpenAuth('signin')}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-on-accent font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Вход в Профила</span>
                </button>
                <button
                  onClick={() => setIsWaitlistOpen(true)}
                  className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 font-semibold text-sm flex items-center justify-center gap-2 transition hover:bg-slate-700/80"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Поискай достъп (Waitlist)</span>
                </button>
              </div>

              {/* Security info card */}
              <div className="pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
                  <h4 className="text-xs font-bold text-slate-200 mb-1">🔐 Row-Level Security</h4>
                  <p className="text-[11px] text-slate-400">Пълна изолация на данните и настройките в Supabase.</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
                  <h4 className="text-xs font-bold text-slate-200 mb-1">🤖 Autonomous Agent</h4>
                  <p className="text-[11px] text-slate-400">Playwright скрапване на dev.bg, jobs.bg и LinkedIn.</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
                  <h4 className="text-xs font-bold text-slate-200 mb-1">⚡ Gemini 2.5 Flash</h4>
                  <p className="text-[11px] text-slate-400">Моментален Match Score и мотивационни писма.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Tab 1: Jobs & Unified / Kanban Dashboard */}
            {activeTab === 'jobs' && (
              <UnifiedJobsView
                jobs={jobs}
                loading={loadingJobs}
                onRefresh={loadJobs}
                onSelectJob={(j) => setSelectedJob(j)}
                onStatusChange={handleStatusChange}
                authToken={session?.access_token}
                activeSources={activeSources}
                maxJobsPerSource={maxJobsPerSource}
                initialViewMode={uiMode === 'pro' ? 'kanban' : 'list'}
              />
            )}

            {/* Tab 2: Autonomous Scraper & Search (Pro Mode only) */}
            {activeTab === 'search' && uiMode === 'pro' && (
              <SearchView
                onViewJobs={() => {
                  setCurrentTab('jobs');
                  loadJobs();
                }}
                onOpenAuth={() => setIsAuthOpen(true)}
              />
            )}

            {/* Tab 3: Skill Roadmap & Portfolio (Pro Mode only) */}
            {activeTab === 'roadmap' && uiMode === 'pro' && (
              <RoadmapPortfolioView />
            )}

            {/* Tab 4: Profile & CV Intelligence */}
            {activeTab === 'profile' && (
              <ProfileView />
            )}

            {/* Tab 5: Market Insights & Analytics (Pro Mode only) */}
            {activeTab === 'insights' && uiMode === 'pro' && (
              <InsightsView
                stats={marketStats}
                jobs={jobs}
                loadingStats={loadingStats}
                onRefreshStats={loadStats}
              />
            )}

            {/* Tab 6: System Settings & Gemini BYOK */}
            {activeTab === 'settings' && (
              <SettingsView
                onOpenAdmin={() => setIsAdminOpen(true)}
                uiMode={uiMode}
                onUIModeChange={(newMode) => setUiMode(newMode)}
                onSettingsSaved={(newSources, newMaxJobs) => {
                  setActiveSources(newSources);
                  setMaxJobsPerSource(newMaxJobs);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar - Only visible when user is logged in */}
      {user && (
        <MobileNav
          currentTab={activeTab}
          onSelectTab={setCurrentTab}
          jobsCount={jobs.length}
          uiMode={uiMode}
        />
      )}


      {/* Modals */}
      <JobDetailModal
        job={selectedJob}
        isOpen={Boolean(selectedJob)}
        onClose={() => setSelectedJob(null)}
        onStatusChange={handleStatusChange}
        onDelete={handleDeleteJob}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onOpenWaitlist={() => setIsWaitlistOpen(true)}
        initialMode={authModalMode}
        prefilledEmail={authModalEmail}
      />

      <WaitlistModal
        isOpen={isWaitlistOpen}
        onClose={() => setIsWaitlistOpen(false)}
      />

      <WaitlistAdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
      />

      {/* Footer (Desktop & Tablet only) */}
      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
