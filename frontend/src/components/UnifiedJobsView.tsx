import React, { useState, useMemo } from 'react';
import type { Job, ApplicationStatus } from '../types';
import { JobCard } from './JobCard';
import { KanbanBoard } from './KanbanBoard';
import { AIProgressBar } from './AIProgressBar';
import { useDebounce } from '../lib/useDebounce';
import { useToast } from '../context/ToastContext';
import {
  Search,
  Sparkles,
  RefreshCw,
  X,
  Globe,
  Coins,
  Kanban,
  LayoutList,
  SlidersHorizontal,
} from 'lucide-react';
import { apiStartSearch, apiGetSearchStatus } from '../lib/api';

interface UnifiedJobsViewProps {
  jobs: Job[];
  loading: boolean;
  onRefresh: () => void;
  onSelectJob: (job: Job) => void;
  onStatusChange: (jobId: string | number, status: ApplicationStatus) => void;
  authToken?: string | null;
  activeSources?: string[];
  maxJobsPerSource?: number;
  initialViewMode?: 'list' | 'kanban';
}

export const UnifiedJobsView: React.FC<UnifiedJobsViewProps> = ({
  jobs,
  loading,
  onRefresh,
  onSelectJob,
  onStatusChange,
  authToken,
  activeSources,
  maxJobsPerSource = 25,
  initialViewMode = 'list',
}) => {
  const { showSuccess, showError } = useToast();

  // View Mode: list vs kanban
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(initialViewMode);
  const [prevInitialViewMode, setPrevInitialViewMode] = useState<'list' | 'kanban'>(initialViewMode);

  if (prevInitialViewMode !== initialViewMode) {
    setPrevInitialViewMode(initialViewMode);
    setViewMode(initialViewMode);
  }

  // Tags State
  const [tags, setTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('jf_simple_tags');
      return saved ? JSON.parse(saved) : ['AI Engineer', 'Python'];
    } catch {
      return ['AI Engineer', 'Python'];
    }
  });
  const [inputValue, setInputValue] = useState('');
  const debouncedInput = useDebounce(inputValue, 250);

  // Search execution & AI Progress Bar state
  const [isSearching, setIsSearching] = useState(false);
  const [searchLog, setSearchLog] = useState<string>('');

  // Quick Filters
  const [onlyRemote, setOnlyRemote] = useState(false);
  const [onlyWithSalary, setOnlyWithSalary] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [minSalary, setMinSalary] = useState<number>(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Save tags to localStorage
  const updateTags = (newTags: string[]) => {
    setTags(newTags);
    localStorage.setItem('jf_simple_tags', JSON.stringify(newTags));
  };

  const handleAddTag = (tagText: string) => {
    const trimmed = tagText.trim().replace(/^,+|,+$/g, '');
    if (trimmed && !tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      updateTags([...tags, trimmed]);
    }
    setInputValue('');
  };

  const handleRemoveTag = (indexToRemove: number) => {
    updateTags(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      handleRemoveTag(tags.length - 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(',')) {
      const parts = val.split(',');
      parts.forEach((p) => {
        if (p.trim()) handleAddTag(p);
      });
      setInputValue('');
    } else {
      setInputValue(val);
    }
  };

  // Trigger Live Scraping + AI Search
  const handleStartSearch = async () => {
    if (isSearching) return;

    let currentKeywords = [...tags];
    if (inputValue.trim()) {
      currentKeywords.push(inputValue.trim());
      updateTags(currentKeywords);
      setInputValue('');
    }

    if (currentKeywords.length === 0) {
      currentKeywords = ['AI Engineer', 'Python'];
      updateTags(currentKeywords);
    }

    setIsSearching(true);
    setSearchLog('🚀 Инициализиране на търсенето в избраните платформи...');

    try {
      const sourcesToUse =
        activeSources && activeSources.length > 0
          ? activeSources
          : ['dev_bg', 'jobs_bg', 'linkedin', 'euremotejobs'];

      const startRes = await apiStartSearch(
        {
          sources: sourcesToUse,
          keywords: currentKeywords,
          max_jobs: Number(maxJobsPerSource) || 25,
          clear_new: true,
        },
        authToken
      );

      const taskId = startRes.task_id;
      let lastJobsFound = 0;
      let errorCount = 0;
      let finished = false;
      let failsafe: ReturnType<typeof setTimeout> | undefined;
      let pollInterval: ReturnType<typeof setInterval> | undefined;

      const finish = (message: string, isSuccess = true) => {
        if (finished) return;
        finished = true;
        if (pollInterval) clearInterval(pollInterval);
        if (failsafe) clearTimeout(failsafe);
        setSearchLog(message);
        setIsSearching(false);
        onRefresh();
        setTimeout(() => onRefresh(), 1500);
        if (isSuccess) {
          showSuccess('Търсенето завърши успешно!');
        } else {
          showError(message);
        }
      };

      pollInterval = setInterval(async () => {
        try {
          const statusRes = await apiGetSearchStatus(taskId, authToken);
          errorCount = 0;
          if (statusRes.logs && statusRes.logs.length > 0) {
            setSearchLog(statusRes.logs[statusRes.logs.length - 1]);
          }

          if ((statusRes.jobs_found || 0) > lastJobsFound) {
            lastJobsFound = statusRes.jobs_found;
            onRefresh();
          }

          if (statusRes.status === 'completed') {
            finish('🎉 Търсенето завърши! Обновяване на списъка с нови позиции...', true);
          } else if (statusRes.status === 'failed') {
            finish(`⚠️ Търсенето приключи с грешка${statusRes.error ? `: ${statusRes.error}` : ''}`, false);
          }
        } catch {
          errorCount += 1;
          if (errorCount >= 6) {
            finish('⚠️ Загубена връзка със сървъра. Опреснявам наличните обяви...', false);
          }
        }
      }, 2000);

      failsafe = setTimeout(
        () => finish('⏱️ Търсенето отне твърде дълго. Показвам намерените обяви.', true),
        240000
      );
    } catch (err: any) {
      console.error('Failed to start search:', err);
      const errMsg = err?.message || 'Неуспешна заявка към бекенда';
      setSearchLog(`⚠️ Грешка: ${errMsg}`);
      showError(`Грешка при търсене: ${errMsg}`);
      setTimeout(() => setIsSearching(false), 5000);
    }
  };

  // Available unique sources
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.source && j.source !== 'himalayas') set.add(j.source);
    });
    return Array.from(set).sort();
  }, [jobs]);

  // Available unique categories
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      const cat = (j as any).category;
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [jobs]);

  // Filtered Jobs with debounced input and tags matching
  const { filteredJobs, tagsIgnored } = useMemo(() => {
    const matchesTags = (job: Job) => {
      const textCorpus = `${job.title || ''} ${job.company || ''} ${job.location || ''} ${(job.matched_skills || []).join(' ')} ${job.search_keyword || ''} ${job.description || ''}`.toLowerCase();
      return tags.some((tag) => {
        const lowerTag = tag.toLowerCase().trim();
        if (!lowerTag) return false;
        if (textCorpus.includes(lowerTag)) return true;
        const words = lowerTag.split(/\s+/).filter(Boolean);
        return words.length > 1 && words.every((w) => textCorpus.includes(w));
      });
    };

    const passesOtherFilters = (job: Job) => {
      // Debounced search query
      if (debouncedInput.trim()) {
        const query = debouncedInput.toLowerCase().trim();
        const matchesInput =
          (job.title || '').toLowerCase().includes(query) ||
          (job.company || '').toLowerCase().includes(query) ||
          (job.location || '').toLowerCase().includes(query);
        if (!matchesInput) return false;
      }

      // Only Remote
      if (onlyRemote) {
        const loc = (job.location || '').toLowerCase();
        const tit = (job.title || '').toLowerCase();
        const isRemote = ['remote', 'дистанцион', 'wfh', 'вкъщи', 'хибридно'].some(
          (k) => loc.includes(k) || tit.includes(k)
        );
        if (!isRemote) return false;
      }

      // Only with Salary
      if (onlyWithSalary && !job.salary) {
        return false;
      }

      // Min Salary Filter
      if (minSalary > 0) {
        const sal = (job.salary || '').replace(/[^0-9]/g, '');
        const val = sal ? parseInt(sal, 10) : 0;
        if (val < minSalary) return false;
      }

      // Status Filter
      if (statusFilter !== 'all' && (job.status || 'new') !== statusFilter) {
        return false;
      }

      // Source Filter
      if (sourceFilter !== 'all' && job.source !== sourceFilter) {
        return false;
      }

      // Category Filter
      if (categoryFilter !== 'all') {
        const jobCat = (job as any).category || '';
        if (!jobCat.includes(categoryFilter)) return false;
      }

      // Minimum AI Score
      if (minScoreFilter > 0) {
        const score = job.match_score || 0;
        if (score < minScoreFilter) return false;
      }

      return true;
    };

    const base = jobs.filter(passesOtherFilters);
    if (tags.length === 0) return { filteredJobs: base, tagsIgnored: false };

    const tagged = base.filter(matchesTags);
    if (tagged.length === 0 && base.length > 0) {
      return { filteredJobs: base, tagsIgnored: true };
    }
    return { filteredJobs: tagged, tagsIgnored: false };
  }, [
    jobs,
    tags,
    debouncedInput,
    onlyRemote,
    onlyWithSalary,
    minSalary,
    statusFilter,
    sourceFilter,
    categoryFilter,
    minScoreFilter,
  ]);

  return (
    <div className="space-y-6">
      {/* Search Header Bar with Tag Input & Search Button */}
      <div className="p-4 md:p-6 rounded-2xl bg-card/80 border border-card-border shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          {/* Smart Tags Input Container */}
          <div className="flex-1 flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-background border border-card-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
            <Search className="w-5 h-5 text-muted-foreground ml-1.5 flex-shrink-0" />

            {/* Render Badges for Tags */}
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-accent/15 text-accent border border-accent/30 animate-in fade-in duration-200"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(idx)}
                  className="hover:text-rose-400 hover:bg-black/10 rounded p-0.5 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}

            {/* Text Input */}
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                tags.length === 0
                  ? 'Въведи ключови думи (напр. AI Engineer, Python)...'
                  : 'Добави още тагове със запетая...'
              }
              className="flex-1 min-w-[160px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none px-2 py-1"
            />
          </div>

          {/* Search Button */}
          <button
            type="button"
            onClick={handleStartSearch}
            disabled={isSearching}
            className={`px-6 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 text-white shadow-lg transition-all ${
              isSearching
                ? 'bg-blue-600/50 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/25 hover:shadow-blue-600/40 active:scale-95'
            }`}
          >
            {isSearching ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Търсене...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-blue-200" />
                <span>🚀 Търси</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-card-border text-xs text-muted-foreground">
          <span className="font-medium flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-accent" /> Бързи тагове:
          </span>
          {['AI Engineer', 'Python', 'Agentic AI', 'Machine Learning', 'Data Scientist', 'Remote'].map((sug) => {
            const isAdded = tags.some((t) => t.toLowerCase() === sug.toLowerCase());
            return (
              <button
                key={sug}
                type="button"
                onClick={() => (isAdded ? null : handleAddTag(sug))}
                disabled={isAdded}
                className={`px-2.5 py-0.5 rounded-md transition-colors ${
                  isAdded
                    ? 'bg-muted text-muted-foreground cursor-default'
                    : 'bg-card text-foreground hover:bg-muted border border-card-border'
                }`}
              >
                + {sug}
              </button>
            );
          })}
        </div>

        {/* AI Progress Bar */}
        <AIProgressBar
          isLoading={isSearching}
          currentLog={searchLog}
          onComplete={() => onRefresh()}
        />

        {/* Filters and View Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-card-border">
          <div className="flex flex-wrap items-center gap-2">
            {/* Remote Toggle */}
            <button
              type="button"
              onClick={() => setOnlyRemote(!onlyRemote)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                onlyRemote
                  ? 'bg-accent/20 text-accent border-accent/40 shadow-sm'
                  : 'bg-card text-muted-foreground border-card-border hover:text-foreground'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Само Remote</span>
            </button>

            {/* Salary Toggle */}
            <button
              type="button"
              onClick={() => setOnlyWithSalary(!onlyWithSalary)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                onlyWithSalary
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                  : 'bg-card text-muted-foreground border-card-border hover:text-foreground'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Със заплата</span>
            </button>

            {/* Source Dropdown */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card text-foreground border border-card-border focus:outline-none focus:border-accent"
            >
              <option value="all">Всички източници</option>
              {availableSources.map((src) => (
                <option key={src} value={src}>
                  {src.toUpperCase()}
                </option>
              ))}
            </select>

            {/* Category Dropdown */}
            {availableCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card text-foreground border border-card-border focus:outline-none focus:border-accent max-w-[180px] truncate"
              >
                <option value="all">Всички категории</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

            {/* Min AI Score Dropdown */}
            <select
              value={minScoreFilter}
              onChange={(e) => setMinScoreFilter(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card text-foreground border border-card-border focus:outline-none focus:border-accent"
            >
              <option value={0}>Всички AI оценки</option>
              <option value={70}>⭐ 70%+ рейтинг</option>
              <option value={80}>🔥 80%+ висок рейтинг</option>
              <option value={90}>🚀 90%+ идеален мач</option>
            </select>

            {/* Advanced Filters Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                showAdvancedFilters
                  ? 'bg-accent/20 border-accent/40 text-accent'
                  : 'bg-card border-card-border text-muted-foreground hover:text-foreground'
              }`}
              title="Допълнителни филтри"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right Toolbar: View Mode & Refresh */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 rounded-xl bg-card border border-card-border">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                  viewMode === 'list'
                    ? 'bg-accent text-on-accent shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Списъчен изглед"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Списък</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                  viewMode === 'kanban'
                    ? 'bg-accent text-on-accent shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Kanban табло"
              >
                <Kanban className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              title="Опресни списъка"
              className="p-1.5 rounded-lg bg-card text-muted-foreground hover:text-foreground border border-card-border transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters (Status + Min Salary) */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-card-border/60 animate-in fade-in duration-150">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Статус на кандидатстване
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-card text-foreground border border-card-border focus:outline-none focus:border-accent"
              >
                <option value="all">Всички статуси</option>
                <option value="new">🆕 Нови</option>
                <option value="applied">📨 Кандидатствал</option>
                <option value="interview">💬 Интервю</option>
                <option value="offer">🎉 Оферта</option>
                <option value="rejected">❌ Отхвърлен</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Минимална заплата (€ / лв.)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={minSalary || ''}
                onChange={(e) => setMinSalary(Number(e.target.value) || 0)}
                placeholder="напр. 3000"
                className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-card text-foreground border border-card-border focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Header Count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Показани <strong className="text-foreground">{filteredJobs.length}</strong> от общо{' '}
          <strong className="text-foreground">{jobs.length}</strong> позиции в базата
        </span>
        {filteredJobs.length < jobs.length && (
          <button
            type="button"
            onClick={() => {
              setTags([]);
              setInputValue('');
              setOnlyRemote(false);
              setOnlyWithSalary(false);
              setSourceFilter('all');
              setStatusFilter('all');
              setCategoryFilter('all');
              setMinScoreFilter(0);
              setMinSalary(0);
            }}
            className="text-accent hover:underline font-medium"
          >
            Изчисти филтрите
          </button>
        )}
      </div>

      {tagsIgnored && (
        <div className="px-3 py-2 rounded-lg text-xs bg-amber-500/10 border border-amber-500/30 text-amber-200">
          Няма обяви, съдържащи точно тези ключови думи — показвам всички налични обяви.
        </div>
      )}

      {/* Content: List or Kanban */}
      {viewMode === 'kanban' ? (
        <KanbanBoard
          jobs={filteredJobs}
          onSelectJob={onSelectJob}
          onStatusChange={onStatusChange}
        />
      ) : filteredJobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onSelect={onSelectJob}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-4 rounded-2xl bg-card/40 border border-dashed border-card-border">
          <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground mx-auto flex items-center justify-center mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Няма намерени обяви по тези критерии
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
            Опитай да премахнеш някой таг или натисни бутона <strong>„🚀 Търси“</strong> за сканиране на платформите на живо.
          </p>
          <button
            type="button"
            onClick={handleStartSearch}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-on-accent hover:opacity-90 shadow-md transition-all inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Стартирай ново търсене</span>
          </button>
        </div>
      )}
    </div>
  );
};
