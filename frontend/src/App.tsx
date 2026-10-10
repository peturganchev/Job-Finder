import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { WaitlistModal } from './components/WaitlistModal';
import { WaitlistAdminModal } from './components/WaitlistAdminModal';
import { JobsListView } from './components/JobsListView';
import { JobDetailModal } from './components/JobDetailModal';
import { SearchView } from './components/SearchView';
import { ProfileView } from './components/ProfileView';
import { ProtectedRoute } from './components/ProtectedRoute';
import { apiFetchJobs, apiUpdateJobStatus, apiDeleteJob, apiFetchMarketStats } from './lib/api';
import type { Job, ApplicationStatus, MarketStats } from './types';
import { API_BASE_URL } from './lib/supabase';
import {
  Sparkles,
  TrendingUp,
  Award,
  Code,
  CheckCircle,
} from 'lucide-react';

function AppContent() {
  const { user, session } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('jobs');

  // Modals state
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);

  // Selected Job for Detail Modal
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Jobs data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(true);

  // Market stats data for insights tab
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  // FastAPI health check
  const [apiHealthy, setApiHealthy] = useState<boolean>(false);

  // Load jobs from API
  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const data = await apiFetchJobs({}, session?.access_token);
      setJobs(data.jobs || []);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  }, [session]);

  // Load market statistics
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await apiFetchMarketStats();
      setMarketStats(data);
    } catch (err) {
      console.error('Error fetching market stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'healthy') setApiHealthy(true);
      })
      .catch(() => setApiHealthy(false));

    loadJobs();
    loadStats();
  }, [loadJobs, loadStats]);

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

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenWaitlist={() => setIsWaitlistOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        apiHealthy={apiHealthy}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col">
        {/* Guest Preview Notice */}
        {!user && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/40 border border-emerald-500/20 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Разглеждате в демо режим (Гост)
                </h4>
                <p className="text-xs text-slate-400">
                  Влезте в профила си или поискайте достъп, за да запазвате персонализирани Kanban статуси и генерирани мотивационни писма.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsWaitlistOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
              >
                Поискай достъп
              </button>
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
              >
                Вход
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Jobs & Kanban Dashboard */}
        {currentTab === 'jobs' && (
          <JobsListView
            jobs={jobs}
            loading={loadingJobs}
            onRefresh={loadJobs}
            onSelectJob={(j) => setSelectedJob(j)}
            onStatusChange={handleStatusChange}
          />
        )}

        {/* Tab 2: Autonomous Scraper & Search */}
        {currentTab === 'search' && (
          <ProtectedRoute
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenWaitlist={() => setIsWaitlistOpen(true)}
            featureName="автономното търсене и скрапване"
          >
            <SearchView
              onViewJobs={() => {
                setCurrentTab('jobs');
                loadJobs();
              }}
            />
          </ProtectedRoute>
        )}

        {/* Tab 3: Profile & CV Intelligence */}
        {currentTab === 'profile' && (
          <ProtectedRoute
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenWaitlist={() => setIsWaitlistOpen(true)}
            featureName="качването на CV и редактирането на умения"
          >
            <ProfileView />
          </ProtectedRoute>
        )}

        {/* Tab 4: Market Insights & Analytics */}
        {currentTab === 'insights' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Пазарен Анализ &amp; AI Тенденции
                  </h1>
                </div>
                <p className="text-xs text-slate-400">
                  Реални изисквания и топ 15 най-търсени умения за AI/ML роли в София и Remote
                </p>
              </div>

              <button
                onClick={loadStats}
                disabled={loadingStats}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition self-start"
              >
                <span>Обнови статистиката</span>
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
                <span className="text-xs text-slate-400">Общо анализирани позиции</span>
                <div className="text-3xl font-extrabold text-white mt-1">
                  {marketStats?.total_jobs || jobs.length}
                </div>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> В глобалния каталог
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
                <span className="text-xs text-slate-400">Среден AI Мач рейтинг</span>
                <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                  {marketStats?.avg_match_score || 78.5}%
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Оценени спрямо Agentic AI инженер профил
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
                <span className="text-xs text-slate-400">Най-търсена технология</span>
                <div className="text-3xl font-extrabold text-teal-400 mt-1">
                  {marketStats?.top_skills?.[0]?.skill || 'Python'}
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Присъства в {marketStats?.top_skills?.[0]?.percentage || 85}% от обявите
                </span>
              </div>
            </div>

            {/* Top In-Demand Skills Frequency Bar Chart */}
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Code className="w-4 h-4 text-emerald-400" />
                    <span>Топ 15 Най-Търсени Технологии на Пазара</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Честота на споменаване в извлечените обяви
                  </p>
                </div>
                <div className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-emerald-400">
                  Live Extraction
                </div>
              </div>

              <div className="space-y-3.5">
                {marketStats?.top_skills && marketStats.top_skills.length > 0 ? (
                  marketStats.top_skills.map((item, idx) => (
                    <div key={item.skill} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-200 flex items-center gap-2">
                          <span className="text-slate-600 font-mono text-[11px]">#{idx + 1}</span>
                          <span>{item.skill}</span>
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          {item.count} обяви ({item.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, item.percentage))}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Статистиката се зарежда...
                  </div>
                )}
              </div>
            </div>

            {/* Recommendations / Roadmap */}
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-teal-400" />
                <span>Препоръчителен Skill Roadmap за Портфолио</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-emerald-400">1. RAG &amp; Vector Search</div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Изграждане на Retrieval-Augmented Generation върху неструктурирани фирмени бази с Python и FastAPI.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-teal-400">2. Multi-Agent Systems</div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Оркестрация на агенти с CrewAI / LangGraph със специализирани роли и споделен контекст.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-indigo-400">3. Tool Calling &amp; Evals</div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Интеграция на LLM функции с външни REST API-та и автоматизирана оценка на точността.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

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
      />

      <WaitlistModal
        isOpen={isWaitlistOpen}
        onClose={() => setIsWaitlistOpen(false)}
      />

      <WaitlistAdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
