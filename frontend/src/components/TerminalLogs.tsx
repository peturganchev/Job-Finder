import React, { useEffect, useState, useRef } from 'react';
import { apiGetSearchStatus, type SearchStatusResponse } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Terminal,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface TerminalLogsProps {
  taskId: string;
  onDone?: () => void;
  onViewJobs?: () => void;
}

export const TerminalLogs: React.FC<TerminalLogsProps> = ({
  taskId,
  onDone,
  onViewJobs,
}) => {
  const { session } = useAuth();
  const [taskData, setTaskData] = useState<SearchStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let intervalId: any = null;
    let isMounted = true;

    const pollStatus = async () => {
      try {
        const data = await apiGetSearchStatus(taskId, session?.access_token);
        if (isMounted) {
          setTaskData(data);
          // Auto-scroll logs
          if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
          }

          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(intervalId);
            if (onDone) onDone();
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Грешка при зареждане на прогреса.');
        }
      }
    };

    pollStatus();
    intervalId = setInterval(pollStatus, 1500);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [taskId, session, onDone]);

  const progress = taskData?.progress ?? 0;
  const status = taskData?.status ?? 'running';
  const logs = taskData?.logs ?? [];
  const jobsFound = taskData?.jobs_found ?? 0;

  return (
    <div className="rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-slate-400 font-sans text-xs ml-2 font-medium flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Job-Finder Scraper Engine • task-{taskId.slice(0, 8)}</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-sans">
            <span>Открити позиции:</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
              {jobsFound}
            </span>
          </div>

          <div
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
              status === 'completed'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : status === 'failed'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-teal-500/20 text-teal-400 border border-teal-500/30 animate-pulse'
            }`}
          >
            {status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
            <span>{status === 'running' ? 'Active' : status}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-900 h-1.5">
        <div
          className={`h-full transition-all duration-300 ${
            status === 'failed' ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Logs Console */}
      <div
        ref={logContainerRef}
        className="p-5 h-80 overflow-y-auto space-y-2 bg-[#060911] text-slate-300 font-mono text-xs leading-relaxed"
      >
        {logs.length === 0 ? (
          <div className="flex items-center gap-2 text-slate-500 py-4">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Инициализиране на скрапърите...</span>
          </div>
        ) : (
          logs.map((log, index) => {
            const isHighlight = log.includes('✨') || log.includes('🎉');
            const isWarning = log.includes('⚠️');
            const isError = log.includes('❌');

            let textColor = 'text-slate-300';
            if (isHighlight) textColor = 'text-emerald-400 font-semibold';
            if (isWarning) textColor = 'text-amber-300';
            if (isError) textColor = 'text-red-400';

            return (
              <div key={index} className={`flex items-start gap-2 ${textColor}`}>
                <span className="text-slate-600 select-none">{String(index + 1).padStart(2, '0')}</span>
                <span className="break-all">{log}</span>
              </div>
            );
          })
        )}

        {status === 'running' && (
          <div className="flex items-center gap-2 text-emerald-400/70 pt-2 animate-pulse">
            <span>▍</span>
            <span>Обхождане на избраните портали...</span>
          </div>
        )}
      </div>

      {/* Footer Banner when Complete */}
      {status === 'completed' && (
        <div className="p-4 bg-emerald-950/30 border-t border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 font-sans">
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Скрапването и AI оценката завършиха успешно! Намерени са <strong>{jobsFound}</strong> нови позиции.
            </span>
          </div>

          {onViewJobs && (
            <button
              onClick={onViewJobs}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition shrink-0"
            >
              <span>Прегледай Обявите</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {status === 'failed' && (
        <div className="p-4 bg-red-950/30 border-t border-red-500/20 flex items-center gap-2 text-xs text-red-300 font-sans">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>Грешка при изпълнение на задачата: {taskData?.error || error}</span>
        </div>
      )}
    </div>
  );
};
