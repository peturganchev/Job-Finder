import React, { useState, useEffect } from 'react';
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
  FileText,
  Tag,
  Trash2,
  Copy,
  Check,
  Bookmark,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { apiStartSearch, apiUpdateSettings } from '../lib/api';
import { supabase } from '../lib/supabase';
import { TerminalLogs } from './TerminalLogs';
import { useAuth } from '../context/AuthContext';

interface SearchViewProps {
  onViewJobs: () => void;
}

const AVAILABLE_SOURCES = [
  { id: 'dev.bg', name: 'dev.bg', desc: 'България (IT & AI роли)', default: true },
  { id: 'jobs.bg', name: 'jobs.bg', desc: 'Водещ портал за работа в България', default: true },
  { id: 'linkedin', name: 'LinkedIn', desc: 'Професионална мрежа & Remote', default: true },
  { id: 'euremotejobs', name: 'EU Remote Jobs', desc: 'Европейски дистанционни AI роли', default: true },
  { id: 'hackernews', name: 'Hacker News', desc: 'YCombinator "Who is hiring" обяви', default: true },
];

const getStorageKey = (userId?: string | null) =>
  userId ? `jobfinder_v2_keywords_${userId}` : 'jobfinder_v2_keywords_guest';
const ACTIVE_TASK_KEY = 'jobfinder_active_search_task_id';

export const SearchView: React.FC<SearchViewProps> = ({ onViewJobs }) => {
  const { user, session } = useAuth();
  const storageKey = getStorageKey(user?.id);

  const [selectedSources, setSelectedSources] = useState<string[]>([
    'dev.bg',
    'jobs.bg',
    'linkedin',
    'euremotejobs',
    'hackernews',
  ]);

  // Load keywords initially from cached local storage
  const [keywords, setKeywords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('jobfinder_v2_keywords_current');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [newKeyword, setNewKeyword] = useState('');
  const [editorMode, setEditorMode] = useState<'tags' | 'textarea'>('tags');
  const [bulkText, setBulkText] = useState(() => keywords.join('\n'));
  const [copied, setCopied] = useState(false);

  const [isSavingKeywords, setIsSavingKeywords] = useState<boolean>(false);
  const [saveKeywordsSuccess, setSaveKeywordsSuccess] = useState<boolean>(false);

  const [maxJobs, setMaxJobs] = useState<number>(10);
  const [clearNew, setClearNew] = useState<boolean>(false);

  // Background task persistence across tabs & reloads
  const [activeTaskId, setActiveTaskId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_TASK_KEY);
    } catch {
      return null;
    }
  });

  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync keywords to local storage cache for offline/instant resume
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(keywords));
      localStorage.setItem('jobfinder_v2_keywords_current', JSON.stringify(keywords));
    } catch {
      // ignore
    }
  }, [keywords, storageKey]);

  // Load saved keywords from Supabase for this authenticated user profile
  useEffect(() => {
    if (!user) return;
    const currentKey = getStorageKey(user.id);

    // 1. Check user-specific localStorage first for instantaneous display
    const cached = localStorage.getItem(currentKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setKeywords(parsed);
          setBulkText(parsed.join('\n'));
        }
      } catch {
        // ignore
      }
    }

    // 2. Fetch authoritative keywords from Supabase user_settings for this account
    supabase
      .from('user_settings')
      .select('keywords')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          console.warn('Could not load user settings keywords from Supabase:', error.message);
          return;
        }
        if (data && data[0] && Array.isArray(data[0].keywords)) {
          const remoteKws = data[0].keywords;
          setKeywords(remoteKws);
          setBulkText(remoteKws.join('\n'));
          try {
            localStorage.setItem(currentKey, JSON.stringify(remoteKws));
            localStorage.setItem('jobfinder_v2_keywords_current', JSON.stringify(remoteKws));
          } catch {
            // ignore
          }
        }
      });
  }, [user]);

  // Sync activeTaskId to localStorage so switching tabs doesn't interrupt or lose the logs
  useEffect(() => {
    try {
      if (activeTaskId) {
        localStorage.setItem(ACTIVE_TASK_KEY, activeTaskId);
      } else {
        localStorage.removeItem(ACTIVE_TASK_KEY);
      }
    } catch {
      // ignore
    }
  }, [activeTaskId]);

  // Keep bulkText in sync when switching to textarea mode
  const handleSwitchMode = (mode: 'tags' | 'textarea') => {
    if (mode === 'textarea') {
      setBulkText(keywords.join('\n'));
    } else {
      // Parse bulkText into keywords
      const parsed = bulkText
        .split(/[\n,;]+/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      const unique = Array.from(new Set(parsed));
      setKeywords(unique);
    }
    setEditorMode(mode);
  };

  const toggleSource = (sourceId: string) => {
    if (selectedSources.includes(sourceId)) {
      if (selectedSources.length === 1) return; // keep at least 1
      setSelectedSources(selectedSources.filter((s) => s !== sourceId));
    } else {
      setSelectedSources([...selectedSources, sourceId]);
    }
  };

  /** Helper to add one or multiple keywords (comma, semicolon, or newline separated) */
  const addKeywordsList = (rawInput: string) => {
    const pieces = rawInput
      .split(/[\n,;]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (pieces.length === 0) return;

    setKeywords((prev) => {
      const merged = new Set(prev);
      pieces.forEach((p) => merged.add(p));
      const res = Array.from(merged);
      setBulkText(res.join('\n'));
      return res;
    });
    setNewKeyword('');
  };

  const handleAddKeyword = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    addKeywordsList(newKeyword);
  };

  const handleRemoveKeyword = (kwToRemove: string) => {
    const updated = keywords.filter((k) => k !== kwToRemove);
    setKeywords(updated);
    setBulkText(updated.join('\n'));
  };

  const saveKeywordsToDb = async (kws: string[]) => {
    if (!user) return;
    try {
      await supabase.from('user_settings').upsert({
        user_id: user.id,
        keywords: kws,
        updated_at: new Date().toISOString(),
      });
      if (session?.access_token) {
        apiUpdateSettings({ search_keywords: kws }, session.access_token).catch(() => {});
      }
    } catch (e) {
      console.warn('Error saving keywords to Supabase:', e);
    }
  };

  const handleClearAllKeywords = () => {
    setKeywords([]);
    setBulkText('');
  };

  const handleCopyKeywords = () => {
    navigator.clipboard.writeText(keywords.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBulkTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBulkText(val);
    const parsed = val
      .split(/[\n,;]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    setKeywords(Array.from(new Set(parsed)));
  };

  // Explicit save of keywords to Supabase user_settings
  const handleSaveKeywordsToProfile = async () => {
    if (!user) {
      setErrorMsg('Моля, влезте в профила си, за да запазите ключовите думи в Supabase.');
      return;
    }
    setIsSavingKeywords(true);
    setErrorMsg(null);
    try {
      await saveKeywordsToDb(keywords);
      setSaveKeywordsSuccess(true);
      setTimeout(() => setSaveKeywordsSuccess(false), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Грешка при запис в профила.');
    } finally {
      setIsSavingKeywords(false);
    }
  };

  const handleStartSearch = async () => {
    if (keywords.length === 0) {
      setErrorMsg('Моля, въведете поне една ключова дума преди да стартирате търсенето.');
      return;
    }
    setIsStarting(true);
    setErrorMsg(null);
    try {
      // Auto-save user's custom keywords to Supabase in background
      if (user) {
        saveKeywordsToDb(keywords).catch(() => {});
      }
      const res = await apiStartSearch(
        {
          sources: selectedSources,
          keywords: keywords,
          max_jobs: maxJobs,
          clear_new: clearNew,
        },
        session?.access_token
      );
      setActiveTaskId(res.task_id);
      try {
        localStorage.setItem(ACTIVE_TASK_KEY, res.task_id);
      } catch {
        // ignore
      }
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
              onClick={() => {
                setActiveTaskId(null);
                try {
                  localStorage.removeItem(ACTIVE_TASK_KEY);
                } catch {
                  // ignore
                }
              }}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 transition"
              title="Скриване на конзолата (задачата продължава да се изпълнява на сървъра)"
            >
              Скрий конзолата
            </button>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2.5">
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="leading-relaxed">
              <strong>Фонов Режим:</strong> Скрапването и AI оценката се изпълняват автономно на FastAPI сървъра. Дори да превключите към друг таб, да прегледате обявите или да затворите страницата, задачата няма да спре.
            </span>
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

        {/* Keywords Section - Fully Personalized & Saved to Supabase */}
        <div className="space-y-4 pt-4 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-teal-400" />
                <label className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Ключови Думи за Търсене ({keywords.length})
                </label>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Въведете вашите персонализирани ключови думи (чрез тагове или текстов списък). Записват се във вашия Supabase профил.
              </p>
            </div>

            {/* Mode Switcher & Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {/* Save Keywords to Supabase Profile */}
              <button
                type="button"
                onClick={handleSaveKeywordsToProfile}
                disabled={isSavingKeywords || keywords.length === 0}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                  saveKeywordsSuccess
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30'
                } disabled:opacity-40`}
                title="Запази този списък с ключови думи във вашия Supabase профил"
              >
                {isSavingKeywords ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : saveKeywordsSuccess ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
                <span>{saveKeywordsSuccess ? 'Запазено в Профила!' : '💾 Запази в Профила'}</span>
              </button>

              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('tags')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                    editorMode === 'tags'
                      ? 'bg-teal-500/20 text-teal-300 shadow-sm border border-teal-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Изглед тагове"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Тагове</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('textarea')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                    editorMode === 'textarea'
                      ? 'bg-teal-500/20 text-teal-300 shadow-sm border border-teal-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Многоредов текстов редактор (по 1 на ред)"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Текст (Списък)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyKeywords}
                disabled={keywords.length === 0}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition disabled:opacity-40"
                title="Копирай всички ключови думи"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={handleClearAllKeywords}
                disabled={keywords.length === 0}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition disabled:opacity-40"
                title="Изчисти всички думи"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Active Editor (Tags or Textarea) */}
          {editorMode === 'tags' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800 min-h-[56px] items-center">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-medium group"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="text-teal-400/60 hover:text-red-400 transition"
                      title="Премахни"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}

                {keywords.length === 0 && (
                  <span className="text-xs text-slate-500 italic px-1 select-none">
                    Няма въведени ключови думи.
                  </span>
                )}

                <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={handleAddKeyword}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('text');
                      if (text && (text.includes(',') || text.includes('\n') || text.includes(';'))) {
                        e.preventDefault();
                        addKeywordsList(text);
                      }
                    }}
                    placeholder="+ Въведете дума или пейстнете списък (със запетаи)..."
                    className="bg-transparent border-none text-xs text-white placeholder-slate-500 outline-none w-full px-1"
                  />
                  {newKeyword.trim() && (
                    <button
                      type="button"
                      onClick={handleAddKeyword}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-400 transition shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                <span>💡 Можете да въвеждате думи със запетая (напр. <i>AI Engineer, LLM, Python</i>) или да пействате цял текст.</span>
                <span className="font-mono text-slate-400">{keywords.length} активни</span>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <textarea
                  rows={6}
                  value={bulkText}
                  onChange={handleBulkTextChange}
                  placeholder="Въведете или пейстнете ключови думи тук:&#10;AI Engineer&#10;Agentic&#10;LLM&#10;Generative AI&#10;Python AI"
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs font-mono leading-relaxed focus:outline-none focus:border-teal-500 transition resize-y"
                />
                <div className="absolute right-3 bottom-3 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
                  {keywords.length} думи
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>💡 Въведете по 1 ключова дума на ред (или разделени със запетая). Синхронизира се автоматично.</span>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('tags')}
                  className="text-teal-400 hover:underline font-medium"
                >
                  Премини към тагове →
                </button>
              </div>
            </div>
          )}
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
