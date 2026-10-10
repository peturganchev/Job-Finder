import React from 'react';
import type { Job, ApplicationStatus } from '../types';
import {
  MapPin,
  Building,
  Sparkles,
  ExternalLink,
  DollarSign,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface JobCardProps {
  job: Job;
  onSelect: (job: Job) => void;
  onStatusChange?: (jobId: string | number, status: ApplicationStatus) => void;
  showColumnControls?: boolean;
}

const STATUS_ORDER: ApplicationStatus[] = [
  'new',
  'applied',
  'interview',
  'offer',
  'rejected',
];

const SOURCE_COLORS: Record<string, string> = {
  'dev.bg': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'jobs.bg': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  linkedin: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  himalayas: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  euremotejobs: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  hackernews: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onSelect,
  onStatusChange,
  showColumnControls = true,
}) => {
  const score = job.match_score ?? null;
  const scoreBadgeColor =
    score !== null
      ? score >= 80
        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
        : score >= 60
        ? 'bg-teal-500/15 text-teal-400 border-teal-500/30'
        : 'bg-slate-800 text-slate-400 border-slate-700'
      : 'bg-slate-800 text-slate-400 border-slate-700';

  const sourceClass =
    SOURCE_COLORS[job.source?.toLowerCase()] ||
    'bg-slate-800 text-slate-300 border-slate-700';

  const currentIdx = STATUS_ORDER.indexOf(job.status as ApplicationStatus);

  const handleMovePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIdx > 0 && onStatusChange) {
      onStatusChange(job.id, STATUS_ORDER[currentIdx - 1]);
    }
  };

  const handleMoveNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIdx < STATUS_ORDER.length - 1 && onStatusChange) {
      onStatusChange(job.id, STATUS_ORDER[currentIdx + 1]);
    }
  };

  return (
    <div
      onClick={() => onSelect(job)}
      className="group relative rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/90 p-4 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-500/5 cursor-pointer flex flex-col justify-between gap-3"
    >
      {/* Top Header: Source & Match Score */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${sourceClass}`}
        >
          {job.source || 'Portal'}
        </span>

        {score !== null && (
          <div
            className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${scoreBadgeColor}`}
          >
            <Sparkles className="w-3 h-3" />
            <span>{score}%</span>
          </div>
        )}
      </div>

      {/* Main Title & Company */}
      <div>
        <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
          {job.title}
        </h4>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
          <Building className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="truncate">{job.company || 'Компания'}</span>
        </div>
      </div>

      {/* Location & Salary */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        {job.location && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate max-w-[140px]">{job.location}</span>
          </div>
        )}
        {job.salary && (
          <div className="flex items-center gap-1 text-emerald-400/90 font-medium">
            <DollarSign className="w-3 h-3 shrink-0" />
            <span className="truncate">{job.salary}</span>
          </div>
        )}
      </div>

      {/* Skills chips preview */}
      {job.matched_skills && job.matched_skills.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {job.matched_skills.slice(0, 3).map((skill, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium"
            >
              {skill}
            </span>
          ))}
          {job.matched_skills.length > 3 && (
            <span className="text-[10px] text-slate-500 px-1 self-center">
              +{job.matched_skills.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Bottom Actions: Move buttons or Direct Link */}
      <div
        className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-1 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition text-[11px]"
        >
          <span>Обява</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        {showColumnControls && onStatusChange && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleMovePrev}
              disabled={currentIdx <= 0}
              title="Премести в предишна колонка"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleMoveNext}
              disabled={currentIdx >= STATUS_ORDER.length - 1}
              title="Премести в следваща колонка"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
