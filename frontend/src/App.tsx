import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { WaitlistModal } from './components/WaitlistModal';
import { WaitlistAdminModal } from './components/WaitlistAdminModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import { API_BASE_URL } from './lib/supabase';
import {
  Sparkles,
  Search,
  Briefcase,
  TrendingUp,
  CheckCircle,
  FileText,
} from 'lucide-react';

function AppContent() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('jobs');
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState<boolean>(false);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);

  const [apiStatus, setApiStatus] = useState<{
    status: string;
    version: string;
    database: string;
  } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => setApiStatus(data))
      .catch((err) => console.error('FastAPI health check failed:', err));
  }, []);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenWaitlist={() => setIsWaitlistOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
        apiHealthy={apiStatus?.status === 'healthy'}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col">
        {/* Banner if guest */}
        {!user && (
          <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/40 border border-emerald-500/20 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Разглеждате в демо режим (Гост)
                </h4>
                <p className="text-xs text-slate-400">
                  Влезте в профила си или подайте заявка за достъп, за да отключите персоналните AI мач оценки и Kanban статуси.
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

        {/* Tab 1: Jobs & Dashboard */}
        {currentTab === 'jobs' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Briefcase className="w-5 h-5 text-emerald-400" />
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Каталог с Обяви за Работа
                  </h1>
                </div>
                <p className="text-xs text-slate-400">
                  AI/ML роли от dev.bg, jobs.bg, LinkedIn и европейски дистанционни портали
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentTab('search')}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-2 transition"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Стартирай ново търсене</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
                <span className="text-xs text-slate-400">Намерени обяви</span>
                <div className="text-2xl font-bold text-white mt-1">74</div>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3" /> Синхронизирани в PostgreSQL
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
                <span className="text-xs text-slate-400">Среден AI Мач рейтинг</span>
                <div className="text-2xl font-bold text-emerald-400 mt-1">78.5%</div>
                <span className="text-[11px] text-slate-400 mt-1 block">Google Gemini 3.8 Flash</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
                <span className="text-xs text-slate-400">Активни портали</span>
                <div className="text-2xl font-bold text-teal-400 mt-1">6</div>
                <span className="text-[11px] text-slate-400 mt-1 block">dev.bg, jobs.bg, linkedin + remote</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
                <span className="text-xs text-slate-400">Сесия &amp; Защита</span>
                <div className="text-2xl font-bold text-indigo-400 mt-1">RLS Active</div>
                <span className="text-[11px] text-slate-400 mt-1 block">JWT Token в localStorage</span>
              </div>
            </div>

            {/* Placeholder / Board view info */}
            <div className="p-8 rounded-2xl bg-slate-900/30 border border-slate-800/60 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-800/60 flex items-center justify-center text-slate-400">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Готови за Фаза 4: Kanban Табло &amp; Детайли</h3>
              <p className="text-xs text-slate-400 max-w-lg mx-auto mb-6">
                Автентикацията и сесиите вече работят устойчиво. Следва изграждането на колоните с drag-and-drop статуси (New, Applied, Interview, Offer, Rejected) и модала за мотивационни писма.
              </p>
              <div className="inline-flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 font-medium">
                <span>FastAPI ендпойнта <code className="font-mono">/api/jobs</code> доставя 74+ позиции на живо</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Search & Scrape */}
        {currentTab === 'search' && (
          <ProtectedRoute
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenWaitlist={() => setIsWaitlistOpen(true)}
            featureName="автономното търсене и фоново скрапване"
          >
            <div className="space-y-6">
              <div className="pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2 mb-1">
                  <Search className="w-5 h-5 text-emerald-400" />
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Фоново Скрапване &amp; Търсачка
                  </h1>
                </div>
                <p className="text-xs text-slate-400">
                  Стартирайте паралелно обхождане на порталите през FastAPI BackgroundTasks
                </p>
              </div>

              <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
                <p className="text-sm text-slate-300">
                  Добре дошли, <span className="font-semibold text-emerald-400">{user?.email}</span>! Модулът за търсене е защитен и готов за конфигуриране във Фаза 6.
                </p>
              </div>
            </div>
          </ProtectedRoute>
        )}

        {/* Tab 3: Profile & CV */}
        {currentTab === 'profile' && (
          <ProtectedRoute
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenWaitlist={() => setIsWaitlistOpen(true)}
            featureName="качването на CV и редактирането на профил"
          >
            <div className="space-y-6">
              <div className="pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Профил &amp; CV Интелигентност
                  </h1>
                </div>
                <p className="text-xs text-slate-400">
                  Качване на PDF автобиография и автоматично AI извличане на умения
                </p>
              </div>

              <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
                <p className="text-sm text-slate-300">
                  Потребителски профил за <span className="font-semibold text-emerald-400">{user?.email}</span> (Фаза 5).
                </p>
              </div>
            </div>
          </ProtectedRoute>
        )}

        {/* Tab 4: Insights */}
        {currentTab === 'insights' && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Пазарен Анализ &amp; AI Тенденции
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Топ търсени технологии и препоръки за портфолио за Agentic AI роли
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
              <p className="text-sm text-slate-300">
                Пазарни инсайти от FastAPI ендпойнта <code className="text-emerald-400 font-mono">/api/market/stats</code> (Фаза 7).
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
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

      {/* Footer with Archevyn branding and links */}
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
