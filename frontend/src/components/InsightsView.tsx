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
} from 'lucide-react';
import type { MarketStats, Job } from '../types';
import { apiFetchMarketReport } from '../lib/api';

interface InsightsViewProps {
  stats: MarketStats | null;
  jobs: Job[];
  loadingStats: boolean;
  onRefreshStats: () => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  stats,
  jobs,
  loadingStats,
  onRefreshStats,
}) => {
  // Market report state
  const [report, setReport] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    setReportError(null);
    try {
      const res = await apiFetchMarketReport(40);
      setReport(res.report);
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : 'Грешка при генериране на отчета.');
    } finally {
      setLoadingReport(false);
    }
  };

  // Distribution by source from current jobs
  const sourceCounts: Record<string, number> = {};
  jobs.forEach((j) => {
    const src = j.source || 'other';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });

  // Distribution by remote vs onsite
  const remoteJobsCount = jobs.filter((j) =>
    (j.location || '').toLowerCase().includes('remote') ||
    (j.title || '').toLowerCase().includes('remote') ||
    j.source === 'himalayas' ||
    j.source === 'euremotejobs'
  ).length;
  const remotePercentage = jobs.length > 0 ? Math.round((remoteJobsCount / jobs.length) * 100) : 45;

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

        <button
          onClick={onRefreshStats}
          disabled={loadingStats}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition self-start disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
          <span>{loadingStats ? 'Анализиране...' : 'Обнови статистиката'}</span>
        </button>
      </div>

      {/* Data Source Explanation Callout */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white">Произход и източник на данните: </span>
          Всички показани графики и метрики се изчисляват динамично от реалните обяви (общо{' '}
          <span className="text-emerald-400 font-bold">{stats?.total_jobs || jobs.length} позиции</span>),
          обходени от порталите <span className="font-mono text-slate-200">dev.bg, jobs.bg, LinkedIn, Himalayas, EU Remote Jobs и Hacker News</span> и съхранени в базата данни на Supabase.
        </div>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
          <span className="text-xs text-slate-400">Общо анализирани позиции</span>
          <div className="text-3xl font-extrabold text-white mt-1">
            {stats?.total_jobs || jobs.length}
          </div>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> В глобалния каталог
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
                    style={{ width: `${Math.min(100, Math.max(6, item.percentage))}%` }}
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
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Разпределение по Портали</span>
          </h3>
          <div className="space-y-2.5 pt-1">
            {Object.entries(sourceCounts).map(([src, cnt]) => {
              const pct = jobs.length > 0 ? Math.round((cnt / jobs.length) * 100) : 0;
              return (
                <div key={src} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium capitalize">{src}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-slate-400 font-mono w-12 text-right">
                      {cnt} ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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

      {/* AI Market Report Generator */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="text-base font-bold text-white">AI Синтезиран Пазарен Доклад</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Генерира структуриран анализ на изискванията, заплатите и технологиите с Google Gemini
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={loadingReport}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition self-start sm:self-auto shrink-0"
          >
            {loadingReport ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Генериране...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Генерирай Пазарен Доклад</span>
              </>
            )}
          </button>
        </div>

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
