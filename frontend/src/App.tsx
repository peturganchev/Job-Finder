import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { MobileNav } from './components/MobileNav';
import { AuthModal } from './components/AuthModal';
import { WaitlistModal } from './components/WaitlistModal';
import { WaitlistAdminModal } from './components/WaitlistAdminModal';
import { JobsListView } from './components/JobsListView';
import { JobDetailModal } from './components/JobDetailModal';
import { SearchView } from './components/SearchView';
import { ProfileView } from './components/ProfileView';
import { InsightsView } from './components/InsightsView';
import { SettingsView } from './components/SettingsView';
import { ProtectedRoute } from './components/ProtectedRoute';
import { apiFetchJobs, apiUpdateJobStatus, apiDeleteJob, apiFetchMarketStats } from './lib/api';
import type { Job, ApplicationStatus, MarketStats } from './types';
import { API_BASE_URL } from './lib/supabase';
import { Sparkles } from 'lucide-react';


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
          <InsightsView
            stats={marketStats}
            jobs={jobs}
            loadingStats={loadingStats}
            onRefreshStats={loadStats}
          />
        )}

        {/* Tab 5: System Settings & Gemini BYOK */}
        {currentTab === 'settings' && (
          <SettingsView onOpenAdmin={() => setIsAdminOpen(true)} />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        jobsCount={jobs.length}
      />


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
