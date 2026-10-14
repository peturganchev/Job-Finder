import React, { useState, useMemo } from 'react';
import type { Job, ApplicationStatus } from '../types';
import { JobCard } from './JobCard';
import { AIProgressBar } from './AIProgressBar';
import {
  Search,
  Sparkles,
  RefreshCw,
  X,
  Globe,
  Coins,
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
}) => {
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

  // Search execution & AI Progress Bar state
  const [isSearching, setIsSearching] = useState(false);
  const [searchLog, setSearchLog] = useState<string>('');

  // Quick Filters
  const [onlyRemote, setOnlyRemote] = useState(false);
  const [onlyWithSalary, setOnlyWithSalary] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);

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

    // Flush any pending text in input into tags
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
      const sourcesToUse = activeSources && activeSources.length > 0
        ? activeSources
        : ['dev_bg', 'jobs_bg', 'linkedin', 'euremotejobs'];

      const startRes = await apiStartSearch(
        {
          sources: sourcesToUse,
          keywords: currentKeywords,
          max_jobs: maxJobsPerSource,
        },
        authToken
      );

      const taskId = startRes.task_id;

      // Poll task progress
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await apiGetSearchStatus(taskId);
          if (statusRes.logs && statusRes.logs.length > 0) {
            setSearchLog(statusRes.logs[statusRes.logs.length - 1]);
          }

          if (statusRes.status === 'completed' || statusRes.status === 'failed') {
            clearInterval(pollInterval);
            setIsSearching(false);
            onRefresh();
          }
        } catch {
          // If polling fails, gracefully finish
          clearInterval(pollInterval);
          setIsSearching(false);
          onRefresh();
        }
      }, 1500);

      // Failsafe timeout after 45s
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsSearching(false);
        onRefresh();
      }, 45000);
    } catch (err: any) {
      console.error('Failed to start search:', err);
      setSearchLog(`⚠️ Грешка: ${err.message || 'Неуспешна заявка'}`);
      setTimeout(() => setIsSearching(false), 3000);
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

  // Filtered Jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Tags filter (OR matching across title, skills, description)
      if (tags.length > 0) {
        const textCorpus = `${job.title} ${job.company} ${job.location} ${(job.matched_skills || []).join(' ')} ${job.description || ''}`.toLowerCase();
        const matchesTag = tags.some((tag) => textCorpus.includes(tag.toLowerCase()));
        if (!matchesTag) return false;
      }

      // Input value realtime filter
      if (inputValue.trim()) {
        const query = inputValue.toLowerCase().trim();
        const matchesInput =
          job.title.toLowerCase().includes(query) ||
          job.company.toLowerCase().includes(query) ||
          job.location.toLowerCase().includes(query);
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
    });
  }, [jobs, tags, inputValue, onlyRemote, onlyWithSalary, sourceFilter, categoryFilter, minScoreFilter]);

  return (
    <div className="space-y-6">
      {/* Search Header Bar with Tag Input & Search Button */}
      <div className="p-4 md:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          {/* Smart Tags Input Container */}
          <div className="flex-1 flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-700/60 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <Search className="w-5 h-5 text-slate-400 ml-1.5 flex-shrink-0" />

            {/* Render Badges for Tags */}
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-300 border border-blue-500/30 animate-in fade-in duration-200"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(idx)}
                  className="hover:text-red-400 hover:bg-blue-900/40 rounded p-0.5 transition-colors"
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
              placeholder={tags.length === 0 ? 'Въведи ключови думи (напр. AI Engineer, Python)...' : 'Добави още тагове със запетая...'}
              className="flex-1 min-w-[160px] bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none px-2 py-1"
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
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-800/60 text-xs text-slate-400">
          <span className="font-medium text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Бързи тагове:
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
                    ? 'bg-slate-800 text-slate-400 cursor-default'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50'
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

        {/* Quick Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800/80">
          {/* Remote Toggle */}
          <button
            type="button"
            onClick={() => setOnlyRemote(!onlyRemote)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
              onlyRemote
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm shadow-blue-500/20'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:text-slate-200'
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
                ? 'bg-amber-600/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:text-slate-200'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Със заплата</span>
          </button>

          {/* Source Dropdown */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 text-slate-300 border border-slate-700/50 focus:outline-none focus:border-blue-500"
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
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 text-slate-300 border border-slate-700/50 focus:outline-none focus:border-blue-500 max-w-[180px] truncate"
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
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 text-slate-300 border border-slate-700/50 focus:outline-none focus:border-blue-500"
          >
            <option value={0}>Всички AI оценки</option>
            <option value={70}>⭐ 70%+ рейтинг</option>
            <option value={80}>🔥 80%+ висок рейтинг</option>
            <option value={90}>🚀 90%+ идеален мач</option>
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            title="Опресни списъка"
            className="p-1.5 rounded-lg bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/50 transition-colors ml-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Results Header Count */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          Показани <strong className="text-slate-200">{filteredJobs.length}</strong> от общо{' '}
          <strong className="text-slate-200">{jobs.length}</strong> позиции в базата
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
              setCategoryFilter('all');
              setMinScoreFilter(0);
            }}
            className="text-blue-400 hover:underline"
          >
            Изчисти филтрите
          </button>
        )}
      </div>

      {/* Clean Vertical Job List */}
      {filteredJobs.length > 0 ? (
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
        <div className="text-center py-16 px-4 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-500 mx-auto flex items-center justify-center mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-200 mb-1">Няма намерени обяви по тези критерии</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Опитай да премахнеш някой таг или натисни бутона <strong>„🚀 Търси“</strong> за сканиране на платформите на живо.
          </p>
          <button
            type="button"
            onClick={handleStartSearch}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/30 transition-all inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Стартирай ново търсене</span>
          </button>
        </div>
      )}
    </div>
  );
};
