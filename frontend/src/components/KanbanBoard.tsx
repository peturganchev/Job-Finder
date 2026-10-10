import React from 'react';
import type { Job, ApplicationStatus } from '../types';
import { JobCard } from './JobCard';
import { Inbox, Send, MessageSquare, Award, XCircle } from 'lucide-react';

interface KanbanBoardProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onStatusChange: (jobId: string | number, status: ApplicationStatus) => void;
}

interface ColumnDef {
  id: ApplicationStatus;
  title: string;
  icon: React.ReactNode;
  headerColor: string;
  badgeBg: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: 'new',
    title: 'Нови',
    icon: <Inbox className="w-4 h-4 text-emerald-400" />,
    headerColor: 'text-emerald-400 border-emerald-500/30',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  {
    id: 'applied',
    title: 'Кандидатствал',
    icon: <Send className="w-4 h-4 text-blue-400" />,
    headerColor: 'text-blue-400 border-blue-500/30',
    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  {
    id: 'interview',
    title: 'Интервю',
    icon: <MessageSquare className="w-4 h-4 text-purple-400" />,
    headerColor: 'text-purple-400 border-purple-500/30',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  {
    id: 'offer',
    title: 'Оферта',
    icon: <Award className="w-4 h-4 text-amber-400" />,
    headerColor: 'text-amber-400 border-amber-500/30',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  {
    id: 'rejected',
    title: 'Отказани',
    icon: <XCircle className="w-4 h-4 text-rose-400" />,
    headerColor: 'text-rose-400 border-rose-500/30',
    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  jobs,
  onSelectJob,
  onStatusChange,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colJobs = jobs.filter((j) => (j.status || 'new') === col.id);

        return (
          <div
            key={col.id}
            className="flex flex-col rounded-2xl bg-slate-900/40 border border-slate-800/80 p-3 min-w-[260px] max-w-full"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80 px-1">
              <div className="flex items-center gap-2">
                {col.icon}
                <span className="font-bold text-sm text-slate-200">{col.title}</span>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold border ${col.badgeBg}`}
              >
                {colJobs.length}
              </span>
            </div>

            {/* Cards Stack */}
            <div className="space-y-3 min-h-[300px]">
              {colJobs.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800/80 rounded-xl text-slate-500 text-xs">
                  <span>Няма обяви</span>
                </div>
              ) : (
                colJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onSelect={onSelectJob}
                    onStatusChange={onStatusChange}
                    showColumnControls={true}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
