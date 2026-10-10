import React, { useState, useMemo } from 'react';
import type { Job, ApplicationStatus } from '../types';
import { KanbanBoard } from './KanbanBoard';
import { JobCard } from './JobCard';
import {
  Search,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface JobsListViewProps {
  jobs: Job[];
  loading: boolean;
  onRefresh: () => void;
  onSelectJob: (job: Job) => void;
  onStatusChange: (jobId: string | number, status: ApplicationStatus) => void;
}

export const JobsListView: React.FC<JobsListViewProps> = ({
  jobs,
  loading,
  onRefresh,
  onSelectJob,
  onStatusChange,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);

  // Available unique sources
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.source) set.add(j.source);
    });
    return Array.from(set);
  }, [jobs]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      // Search query
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

      // Source
      if (sourceFilter !== 'all' && j.source !== sourceFilter) {
        return false;
      }

      // Status
      if (statusFilter !== 'all' && j.status !== statusFilter) {
        return false;
      }

      // Min match score
      if (minScoreFilter > 0 && (j.match_score ?? 0) < minScoreFilter) {
        return false;
      }

      return true;
    });
  }, [jobs, searchQuery, sourceFilter, statusFilter, minScoreFilter]);

  return (
    <div className="space-y-6">
      {/* Top Filter and Controls Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Търси по заглавие, компания, умение..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* View Mode Toggle and Refresh */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 transition"
              title="Презареди обявите"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  viewMode === 'kanban'
                    ? 'bg-slate-800 text-emerald-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Kanban Табло"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>

              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  viewMode === 'list'
                    ? 'bg-slate-800 text-emerald-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Списъчен Изглед"
              >
                <ListIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Списък</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800/60 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>Филтри:</span>
          </div>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs outline-none focus:border-emerald-500"
          >
            <option value="all">Всички източници</option>
            {availableSources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Status Filter (applicable in list view) */}
          {viewMode === 'list' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs outline-none focus:border-emerald-500"
            >
              <option value="all">Всички статуси</option>
              <option value="new">Нови</option>
              <option value="applied">Кандидатствал</option>
              <option value="interview">Интервю</option>
              <option value="offer">Оферта</option>
              <option value="rejected">Отказани</option>
            </select>
          )}

          {/* Score Filter */}
          <select
            value={minScoreFilter}
            onChange={(e) => setMinScoreFilter(Number(e.target.value))}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs outline-none focus:border-emerald-500"
          >
            <option value={0}>Всички оценки</option>
            <option value={70}>70%+ AI Мач</option>
            <option value={80}>80%+ AI Мач</option>
            <option value={90}>90%+ AI Мач</option>
          </select>

          {/* Results count pill */}
          <div className="ml-auto text-slate-400 text-xs">
            Намерени: <span className="font-bold text-emerald-400">{filteredJobs.length}</span>{' '}
            от {jobs.length}
          </div>
        </div>
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
            Опитайте да изчистите част от филтрите или стартирайте ново търсене от таб "Търсене & Скрапване".
          </p>
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
