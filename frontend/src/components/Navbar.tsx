import React from 'react';
import {
  Cpu,
  LogIn,
  LogOut,
  Sparkles,
  Database,
  Server,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenWaitlist: () => void;
  onOpenAdmin: () => void;
  apiHealthy: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuth,
  onOpenWaitlist,
  onOpenAdmin,
  apiHealthy,
}) => {
  const { user, signOut, isWaitlistAdmin } = useAuth();

  const navItems = [
    { id: 'jobs', label: 'Обяви & Табло' },
    { id: 'search', label: 'Търсене & Скрапване' },
    { id: 'profile', label: 'CV & Профил' },
    { id: 'insights', label: 'Пазарен Анализ' },
    { id: 'settings', label: 'Настройки' },
  ];

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => onSelectTab('jobs')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Cpu className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Job-Finder
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v2
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Archevyn Autonomous AI Systems
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-800">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  currentTab === item.id
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700/80'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Status Indicators & Auth Actions */}
        <div className="flex items-center gap-3">
          {/* Status Pills */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${apiHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <Server className="w-3 h-3 text-slate-500" />
              <span>FastAPI</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-teal-400" />
              <Database className="w-3 h-3 text-slate-500" />
              <span>Supabase RLS</span>
            </div>
          </div>

          {/* User state */}
          {user ? (
            <div className="flex items-center gap-2">
              {isWaitlistAdmin && (
                <button
                  onClick={onOpenAdmin}
                  className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Административен панел за одобрение на чакащи потребители"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Waitlist Admin</span>
                </button>
              )}

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-xs text-slate-200">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                  {user.email?.[0].toUpperCase() || 'U'}
                </div>
                <span className="font-medium max-w-[120px] sm:max-w-[160px] truncate">
                  {user.email}
                </span>
              </div>

              <button
                onClick={signOut}
                className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800/80 transition"
                title="Изход от профила"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenWaitlist}
                className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Заявка за достъп</span>
              </button>

              <button
                onClick={onOpenAuth}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Вход</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
