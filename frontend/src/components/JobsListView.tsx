import React, { useState, useMemo } from 'react';
import type { Job, ApplicationStatus } from '../types';
import { KanbanBoard } from './KanbanBoard';
import { JobCard } from './JobCard';
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Sparkles,
  RefreshCw,
  Globe,
  Coins,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';

interface JobsListViewProps {
  jobs: Job[];
  loading: boolean;
  onRefresh: () => void;
  onSelectJob: (job: Job) => void;
  onStatusChange: (jobId: string | number, status: ApplicationStatus) => void;
}

/** Extracts numeric salary from string (e.g. '2 500 - 3 500 EUR' -> 3500) */
export function extractSalaryNum(salaryStr?: string | null): number | null {
  if (!salaryStr) return null;
  const cleaned = salaryStr.replace(/(\d)\s+(\d)/g, '$1$2');
  const nums = cleaned.match(/\b\d{3,6}\b/g);
  if (nums && nums.length > 0) {
    const parsed = nums.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
    return parsed.length > 0 ? Math.max(...parsed) : null;
  }
  return null;
}

const REMOTE_KEYWORDS = ['remote', 'дистанцион', 'wfh', 'anywhere', 'дистанционна'];

/** Determines whether a job is remote based on location or title */
export function isRemoteJob(j: Job): boolean {
  const loc = (j.location || '').toLowerCase();
  const tit = (j.title || '').toLowerCase();
  return REMOTE_KEYWORDS.some((kw) => loc.includes(kw) || tit.includes(kw));
}

export const JobsListView: React.FC<JobsListViewProps> = ({
  jobs,
  loading,
  onRefresh,
  onSelectJob,
  onStatusChange,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Filters State matching main branch + enhanced UX
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [keywordFilter, setKeywordFilter] = useState('all');
  const [onlyRemote, setOnlyRemote] = useState(false);
  const [onlyWithSalary, setOnlyWithSalary] = useState(false);
  const [minSalary, setMinSalary] = useState<number>(0);
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Available unique sources
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.source) set.add(j.source);
    });
    return Array.from(set).sort();
  }, [jobs]);

  // Available unique keywords (search_keyword from scrapers)
  const availableKeywords = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.search_keyword && j.search_keyword.trim()) {
        set.add(j.search_keyword.trim());
      }
    });
    return Array.from(set).sort();
  }, [jobs]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      // 1. Text Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = j.title?.toLowerCase().includes(q);
        const matchesCompany = j.company?.toLowerCase().includes(q);
        const matchesLocation = j.location?.toLowerCase().includes(q);
        const matchesSkill = j.matched_skills?.some((s) => s.toLowerCase().includes(q));
        if (!matchesTitle && !matchesCompany && !matchesLocation && !matchesSkill) {
          return false;
        }
      }

      // 2. Source Filter
      if (sourceFilter !== 'all' && j.source !== sourceFilter) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter !== 'all' && j.status !== statusFilter) {
        return false;
      }

      // 4. Keyword Filter (Position / Search term)
      if (keywordFilter !== 'all' && j.search_keyword !== keywordFilter) {
        return false;
      }

      // 5. Remote Only
      if (onlyRemote && !isRemoteJob(j)) {
        return false;
      }

      // 6. With Salary Only
      if (onlyWithSalary && (!j.salary || j.salary.trim().length === 0)) {
        return false;
      }

      // 7. Minimum Salary Threshold
      if (minSalary > 0) {
        const salaryNum = extractSalaryNum(j.salary);
        if (salaryNum === null || salaryNum < minSalary) {
          return false;
        }
      }

      // 8. Minimum AI Match Score
      if (minScoreFilter > 0 && (j.match_score ?? 0) < minScoreFilter) {
        return false;
      }

      return true;
    });
  }, [
    jobs,
    searchQuery,
    sourceFilter,
    statusFilter,
    keywordFilter,
    onlyRemote,
    onlyWithSalary,
    minSalary,
    minScoreFilter,
  ]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    sourceFilter !== 'all' ||
    statusFilter !== 'all' ||
    keywordFilter !== 'all' ||
    onlyRemote ||
    onlyWithSalary ||
    minSalary > 0 ||
    minScoreFilter > 0;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSourceFilter('all');
    setStatusFilter('all');
    setKeywordFilter('all');
    setOnlyRemote(false);
    setOnlyWithSalary(false);
    setMinSalary(0);
    setMinScoreFilter(0);
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Controls Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md space-y-4 shadow-xl shadow-black/20">
        {/* Row 1: Search Input & View Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3.5">
          {/* Search Input */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Търси по заглавие, компания, локация, умение..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Toggle & Refresh */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  viewMode === 'kanban'
                    ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Kanban Табло по етапи на кандидатстване"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Kanban</span>
              </button>

              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  viewMode === 'list'
                    ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Списъчен / Мрежов Изглед"
              >
                <ListIcon className="w-3.5 h-3.5" />
                <span>Списък</span>
              </button>
            </div>

            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition border border-slate-700/60 shrink-0"
              title="Презареди обявите"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Row 2: Quick Filter Chips & Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-800/60 text-xs">
          {/* Quick Toggle: Only Remote */}
          <button
            type="button"
            onClick={() => setOnlyRemote(!onlyRemote)}
            className={`px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition border ${
              onlyRemote
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Само Remote</span>
            {onlyRemote && <Check className="w-3 h-3 text-emerald-400" />}
          </button>

          {/* Quick Toggle: Only With Salary */}
          <button
            type="button"
            onClick={() => setOnlyWithSalary(!onlyWithSalary)}
            className={`px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition border ${
              onlyWithSalary
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Със заплата</span>
            {onlyWithSalary && <Check className="w-3 h-3 text-amber-400" />}
          </button>

          {/* Dropdown: Source */}
          <div className="relative">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs outline-none focus:border-emerald-500 transition cursor-pointer"
            >
              <option value="all">Всички източници</option>
              {availableSources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Dropdown: Keyword Filter */}
          {availableKeywords.length > 0 && (
            <div className="relative">
              <select
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs outline-none focus:border-emerald-500 transition cursor-pointer max-w-[180px] truncate"
                title="Филтрирай по ключова дума, с която позицията е открита"
              >
                <option value="all">Всички ключови думи</option>
                {availableKeywords.map((kw) => (
                  <option key={kw} value={kw}>
                    {kw}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          )}

          {/* Dropdown: Status Filter (List View or Global) */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs outline-none focus:border-emerald-500 transition cursor-pointer"
            >
              <option value="all">Всички статуси</option>
              <option value="new">Нови</option>
              <option value="applied">Кандидатствал</option>
              <option value="interview">Интервю</option>
              <option value="offer">Оферта</option>
              <option value="rejected">Отказани</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Dropdown: AI Match Score */}
          <div className="relative">
            <select
              value={minScoreFilter}
              onChange={(e) => setMinScoreFilter(Number(e.target.value))}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs outline-none focus:border-emerald-500 transition cursor-pointer"
            >
              <option value={0}>Всички AI оценки</option>
              <option value={50}>50%+ AI Мач</option>
              <option value={70}>70%+ AI Мач</option>
              <option value={80}>80%+ AI Мач</option>
              <option value={90}>90%+ AI Мач</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Toggle More / Advanced Filters */}
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition border ${
              isAdvancedOpen || minSalary > 0
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3 text-emerald-400" />
            <span>Заплата &amp; Детайли</span>
            {isAdvancedOpen ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
              title="Изчисти всички зададени филтри"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Изчисти</span>
            </button>
          )}

          {/* Results Count Pill */}
          <div className="ml-auto text-slate-400 text-xs font-mono flex items-center gap-1.5">
            <span>Показани:</span>
            <span className="font-bold text-emerald-400">{filteredJobs.length}</span>
            <span>от {jobs.length}</span>
          </div>
        </div>

        {/* Row 3: Expanded Advanced Filters (Min Salary Input & Score Range) */}
        {(isAdvancedOpen || minSalary > 0 || onlyWithSalary) && (
          <div className="pt-3 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-150">
            {/* Min Salary Input */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>Мин. Заплата: {minSalary > 0 ? `${minSalary.toLocaleString()} EUR/BGN` : 'Без ограничение'}</span>
                </span>
                {minSalary > 0 && (
                  <button
                    onClick={() => setMinSalary(0)}
                    className="text-[11px] text-slate-500 hover:text-red-400"
                  >
                    Нулирай
                  </button>
                )}
              </div>
              <input
                type="range"
                min={0}
                max={10000}
                step={250}
                value={minSalary}
                onChange={(e) => setMinSalary(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0</span>
                <span>2 500</span>
                <span>5 000</span>
                <span>7 500</span>
                <span>10 000+</span>
              </div>
            </div>

            {/* Continuous Min Match Score Slider */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>AI Съвпадение (CV): {minScoreFilter > 0 ? `${minScoreFilter}%+` : 'Всички'}</span>
                </span>
                {minScoreFilter > 0 && (
                  <button
                    onClick={() => setMinScoreFilter(0)}
                    className="text-[11px] text-slate-500 hover:text-red-400"
                  >
                    Нулирай
                  </button>
                )}
              </div>
              <input
                type="range"
                min={0}
                max={95}
                step={5}
                value={minScoreFilter}
                onChange={(e) => setMinScoreFilter(Number(e.target.value))}
                className="w-full accent-teal-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0%</span>
                <span>30%</span>
                <span>50%</span>
                <span>70%</span>
                <span>90%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Jobs Display */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <div className="w-8 h-8 mx-auto rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400">Зареждане на позициите от PostgreSQL...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="py-20 text-center p-8 rounded-2xl bg-slate-900/30 border border-dashed border-slate-800 space-y-3">
          <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Няма открити обяви с тези филтри</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Опитайте да изчистите част от филтрите или стартирайте ново търсене от таб "Търсене &amp; Скрапване".
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Изчисти всички филтри</span>
            </button>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard
          jobs={filteredJobs}
          onSelectJob={onSelectJob}
          onStatusChange={onStatusChange}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onSelect={onSelectJob}
              onStatusChange={onStatusChange}
              showColumnControls={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};
