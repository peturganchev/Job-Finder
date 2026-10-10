import React, { useState } from 'react';
import {
  Search,
  Globe,
  Sliders,
  Sparkles,
  Plus,
  X,
  Play,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { apiStartSearch } from '../lib/api';
import { TerminalLogs } from './TerminalLogs';
import { useAuth } from '../context/AuthContext';

interface SearchViewProps {
  onViewJobs: () => void;
}

const AVAILABLE_SOURCES = [
  { id: 'dev.bg', name: 'dev.bg', desc: 'България (IT & AI роли)', default: true },
  { id: 'jobs.bg', name: 'jobs.bg', desc: 'Водещ портал за работа в България', default: true },
  { id: 'linkedin', name: 'LinkedIn', desc: 'Професионална мрежа & Remote', default: true },
  { id: 'himalayas', name: 'Himalayas', desc: 'Дистанционни роли от световен мащаб', default: true },
  { id: 'euremotejobs', name: 'EU Remote Jobs', desc: 'Европейски дистанционни AI роли', default: true },
  { id: 'hackernews', name: 'Hacker News', desc: 'YCombinator "Who is hiring" обяви', default: true },
];

export const SearchView: React.FC<SearchViewProps> = ({ onViewJobs }) => {
  const { session } = useAuth();

  const [selectedSources, setSelectedSources] = useState<string[]>([
    'dev.bg',
    'jobs.bg',
    'linkedin',
    'himalayas',
    'euremotejobs',
    'hackernews',
  ]);

  const [keywords, setKeywords] = useState<string[]>([
    'AI Engineer',
    'Agentic',
    'LLM',
    'Generative AI',
    'Python',
  ]);
  const [newKeyword, setNewKeyword] = useState('');
  const [maxJobs, setMaxJobs] = useState<number>(10);
  const [clearNew, setClearNew] = useState<boolean>(false);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleSource = (sourceId: string) => {
    if (selectedSources.includes(sourceId)) {
      if (selectedSources.length === 1) return; // keep at least 1
      setSelectedSources(selectedSources.filter((s) => s !== sourceId));
    } else {
      setSelectedSources([...selectedSources, sourceId]);
    }
  };

  const handleAddKeyword = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const val = newKeyword.trim();
    if (val && !keywords.includes(val)) {
      setKeywords([...keywords, val]);
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (kwToRemove: string) => {
    setKeywords(keywords.filter((k) => k !== kwToRemove));
  };

  const handleStartSearch = async () => {
    setIsStarting(true);
    setErrorMsg(null);
    try {
      const res = await apiStartSearch(
        {
          sources: selectedSources,
          keywords,
          max_jobs: maxJobs,
          clear_new: clearNew,
        },
        session?.access_token
      );
      setActiveTaskId(res.task_id);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Грешка при стартиране на търсенето.');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <Search className="w-5 h-5 text-emerald-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Автономно Търсене &amp; Скрапване
          </h1>
        </div>
        <p className="text-xs text-slate-400">
          Конфигурирайте източниците и ключовите думи за автоматично обхождане и AI оценка
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Live Terminal Output Section */}
      {activeTaskId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Резултат от Търсенето в Реално Време</span>
            </h3>
            <button
              onClick={() => setActiveTaskId(null)}
              className="text-xs text-slate-400 hover:text-white transition"
            >
              Скрий конзолата
            </button>
          </div>

          <TerminalLogs taskId={activeTaskId} onViewJobs={onViewJobs} />
        </div>
      )}

      {/* Configuration Form */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-8">
        {/* Source Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>Източници за Търсене ({selectedSources.length})</span>
            </label>
            <span className="text-[11px] text-slate-500">Кликнете за включване/изключване</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {AVAILABLE_SOURCES.map((source) => {
              const isSelected = selectedSources.includes(source.id);
              return (
                <div
                  key={source.id}
                  onClick={() => toggleSource(source.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                    isSelected
                      ? 'bg-slate-900/90 border-emerald-500/50 shadow-md shadow-emerald-500/5'
                      : 'bg-slate-950/40 border-slate-800/80 opacity-60 hover:opacity-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-0"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-white">{source.name}</h4>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                      {source.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Keywords Tags */}
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Search className="w-4 h-4 text-teal-400" />
              <span>Ключови Думи ({keywords.length})</span>
            </label>
            <span className="text-[11px] text-slate-500">Натиснете Enter за добавяне</span>
          </div>

          <div className="flex flex-wrap gap-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800 min-h-[50px] items-center">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-medium"
              >
                <span>{kw}</span>
                <button
                  onClick={() => handleRemoveKeyword(kw)}
                  className="hover:text-white transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={handleAddKeyword}
                placeholder="+ Добави дума..."
                className="bg-transparent border-none text-xs text-white placeholder-slate-500 outline-none w-36 px-1"
              />
              {newKeyword.trim() && (
                <button
                  onClick={handleAddKeyword}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-400 transition"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Limit & Cleanup Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-800/80">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Макс позиции на източник: {maxJobs}</span>
            </label>
            <input
              type="range"
              min={3}
              max={25}
              step={1}
              value={maxJobs}
              onChange={(e) => setMaxJobs(Number(e.target.value))}
              className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
              <span>3</span>
              <span>10</span>
              <span>25</span>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 select-none">
              <input
                type="checkbox"
                checked={clearNew}
                onChange={(e) => setClearNew(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-0"
              />
              <span>Изчисти предишни обяви със статус 'Нови' преди търсенето</span>
            </label>
            <p className="text-[11px] text-slate-500 mt-1 pl-6">
              Запазва позициите със статус 'Кандидатствал', 'Интервю' и 'Оферта' непокътнати.
            </p>
          </div>
        </div>

        {/* Launch Button */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end">
          <button
            onClick={handleStartSearch}
            disabled={isStarting || selectedSources.length === 0}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/20 disabled:opacity-50 transition"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Инициализиране...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Стартирай Автономно Търсене</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
