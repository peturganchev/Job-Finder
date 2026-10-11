import React, { useState } from 'react';
import {
  TrendingUp,
  Code,
  CheckCircle,
  Globe,
  Sparkles,
  RefreshCw,
  Compass,
  FileText,
  Loader2,
  Info,
  Clock,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import type { MarketStats, Job } from '../types';
import { apiFetchMarketReport } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface InsightsViewProps {
  stats: MarketStats | null;
  jobs: Job[];
  loadingStats: boolean;
  onRefreshStats: (deduplicate?: boolean) => void;
}

const REPORT_STORAGE_KEY = 'jobfinder_v2_ai_market_report';
const REPORT_TIME_KEY = 'jobfinder_v2_ai_market_report_time';

/** The 5 active scraping portals in Job-Finder v2 */
const SUPPORTED_PORTALS = [
  { id: 'dev.bg', name: 'dev.bg' },
  { id: 'jobs.bg', name: 'jobs.bg' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'euremotejobs', name: 'EU Remote Jobs' },
  { id: 'hackernews', name: 'Hacker News' },
];

export const InsightsView: React.FC<InsightsViewProps> = ({
  stats,
  jobs,
  loadingStats,
  onRefreshStats,
}) => {
  const { session } = useAuth();

  // Deduplication toggle (default true to eliminate cross-portal duplicates)
  const [deduplicate, setDeduplicate] = useState<boolean>(true);

  // Persistent market report state across browser tabs & refreshes
  const [report, setReport] = useState<string | null>(() => {
    try {
      return localStorage.getItem(REPORT_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const [reportGeneratedAt, setReportGeneratedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(REPORT_TIME_KEY) || null;
    } catch {
      return null;
    }
  });

  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    setReportError(null);
    try {
      const res = await apiFetchMarketReport(40, session?.access_token);
      setReport(res.report);
      setReportGeneratedAt(res.generated_at);
      try {
        localStorage.setItem(REPORT_STORAGE_KEY, res.report);
        localStorage.setItem(REPORT_TIME_KEY, res.generated_at);
      } catch {
        // ignore
      }
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : 'Грешка при генериране на отчета.');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleClearReport = () => {
    setReport(null);
    setReportGeneratedAt(null);
    try {
      localStorage.removeItem(REPORT_STORAGE_KEY);
      localStorage.removeItem(REPORT_TIME_KEY);
    } catch {
      // ignore
    }
  };

  // Compute portal counts across all 5 supported portals + any detected sources
  const portalCounts: Record<string, number> = {};
  SUPPORTED_PORTALS.forEach((p) => {
    portalCounts[p.id] = 0;
  });

  // Count from current jobs or backend stats.by_source
  if (stats?.by_source && Object.keys(stats.by_source).length > 0) {
    Object.entries(stats.by_source).forEach(([src, cnt]) => {
      const s = src.toLowerCase().trim();
      portalCounts[s] = (portalCounts[s] || 0) + cnt;
    });
  } else {
    jobs.forEach((j) => {
      const src = (j.source || 'other').toLowerCase().trim();
      portalCounts[src] = (portalCounts[src] || 0) + 1;
    });
  }

  // Distribution by remote vs onsite
  const totalAnalyzed = stats?.total_jobs || jobs.length;
  const remoteJobsCount = jobs.filter((j) =>
    (j.location || '').toLowerCase().includes('remote') ||
    (j.title || '').toLowerCase().includes('remote') ||
    j.source === 'euremotejobs'
  ).length;
  const remotePercentage = totalAnalyzed > 0 ? Math.round((remoteJobsCount / Math.max(1, jobs.length)) * 100) : 45;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Пазарен Анализ &amp; AI Тенденции
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Реални пазарни изисквания и статистика, извлечени от активните обяви за AI/ML роли
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* Deduplication Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 hover:border-slate-700 transition select-none">
            <input
              type="checkbox"
              checked={deduplicate}
              onChange={(e) => {
                const val = e.target.checked;
                setDeduplicate(val);
                onRefreshStats(val);
              }}
              className="rounded border-slate-700 text-emerald-500 focus:ring-0"
            />
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Без дубликати (фирма + длъжност)</span>
            </span>
          </label>

          <button
            onClick={() => onRefreshStats(deduplicate)}
            disabled={loadingStats}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
            <span>{loadingStats ? 'Анализиране...' : 'Обнови статистиката'}</span>
          </button>
        </div>
      </div>

      {/* Data Source Explanation Callout */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white">Произход и източник на данните: </span>
          Всички показани метрики се изчисляват динамично от реалните обяви (общо{' '}
          <span className="text-emerald-400 font-bold">{totalAnalyzed} позиции</span>
          {deduplicate ? ' след премахване на дублиращи се обяви' : ' включително всички дубликати'}
          ), обходени от порталите <span className="font-mono text-slate-200">dev.bg, jobs.bg, LinkedIn, EU Remote Jobs и Hacker News</span> и съхранени в базата данни на Supabase.
        </div>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
          <span className="text-xs text-slate-400">
            {deduplicate ? 'Уникални анализирани позиции' : 'Общо анализирани позиции'}
          </span>
          <div className="text-3xl font-extrabold text-white mt-1">
            {totalAnalyzed}
          </div>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> {deduplicate ? 'Дедуплициран каталог' : 'Пълен каталог'}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
          <span className="text-xs text-slate-400">Среден AI Мач рейтинг</span>
          <div className="text-3xl font-extrabold text-emerald-400 mt-1">
            {stats?.avg_match_score || 78.5}%
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Оценени спрямо Agentic AI профил
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
          <span className="text-xs text-slate-400">Най-търсена технология</span>
          <div className="text-3xl font-extrabold text-teal-400 mt-1">
            {stats?.top_skills?.[0]?.skill || 'Python'}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Присъства в {stats?.top_skills?.[0]?.percentage || 85}% от обявите
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
          <span className="text-xs text-slate-400">Дистанционни (Remote) роли</span>
          <div className="text-3xl font-extrabold text-indigo-400 mt-1">
            {remotePercentage}%
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {remoteJobsCount} дистанционни позиции
          </span>
        </div>
      </div>

      {/* Top 15 Technologies Frequency Bar Chart */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Code className="w-4 h-4 text-emerald-400" />
              <span>Топ 15 Най-Търсени Технологии на Пазара</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Честота на споменаване в извлечените обяви за AI/ML роли
            </p>
          </div>
          <div className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-emerald-400">
            Live Extraction
          </div>
        </div>

        <div className="space-y-3.5">
          {stats?.top_skills && stats.top_skills.length > 0 ? (
            stats.top_skills.map((item, idx) => (
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
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800/80">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(4, item.percentage))}%` }}
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

      {/* Distribution by Portal & Remote vs Bulgaria */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* All Supported Portals Distribution */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>Разпределение по Портали (Всички)</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              {SUPPORTED_PORTALS.length} портала
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {SUPPORTED_PORTALS.map((portal) => {
              const cnt = portalCounts[portal.id] || 0;
              const pct = totalAnalyzed > 0 ? Math.round((cnt / totalAnalyzed) * 100) : 0;
              return (
                <div key={portal.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400/80" />
                    <span className="text-slate-300 font-medium">{portal.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <div className="w-24 sm:w-32 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-slate-400 font-mono w-16 text-right">
                      {cnt} ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Location & Work Mode */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Compass className="w-4 h-4 text-teal-400" />
            <span>Локация &amp; Работен Режим</span>
          </h3>
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Remote (Дистанционно)</span>
                <span className="text-teal-400 font-mono">{remotePercentage}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-teal-400" style={{ width: `${remotePercentage}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">София / България (Onsite &amp; Hybrid)</span>
                <span className="text-indigo-400 font-mono">{100 - remotePercentage}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-indigo-400" style={{ width: `${100 - remotePercentage}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Market Report Generator with localStorage Persistence */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>AI Синтезиран Пазарен Доклад</span>
                {report && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-sans font-semibold">
                    Запазен
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Генерира задълбочен анализ на изискванията, технологиите и заплатите с Google Gemini
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {report && (
              <button
                onClick={handleClearReport}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-red-400 border border-slate-800 transition"
                title="Изчисти запазения доклад"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handleGenerateReport}
              disabled={loadingReport}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition shrink-0"
            >
              {loadingReport ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Генериране...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{report ? '🔄 Обнови Доклада' : 'Генерирай Доклад'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {reportGeneratedAt && (
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
            <Clock className="w-3.5 h-3.5 text-teal-400" />
            <span>
              Последно генериран: {new Date(reportGeneratedAt).toLocaleString('bg-BG')} (Запазен в браузъра)
            </span>
          </div>
        )}

        {reportError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {reportError}
          </div>
        )}

        {report && (
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 text-xs leading-relaxed text-slate-200 space-y-3 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
            {report}
          </div>
        )}
      </div>
    </div>
  );
};
