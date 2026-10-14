import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';

interface AIProgressBarProps {
  isLoading: boolean;
  activeSources?: string[];
  currentLog?: string;
  onComplete?: () => void;
}

const DEFAULT_PHASES = [
  { pct: 15, msg: '🔍 Сканиране на Dev.bg за активни роли...' },
  { pct: 40, msg: '🌐 Извличане на оферти от EU Remote Jobs & HackerNews...' },
  { pct: 68, msg: '⚡ Търсене в LinkedIn и българския Jobs.bg каталог...' },
  { pct: 88, msg: '🤖 AI валидиране на изисквания и съпоставяне на умения...' },
  { pct: 98, msg: '✨ Финализиране и подреждане по рейтинг...' },
];

export const AIProgressBar: React.FC<AIProgressBarProps> = ({
  isLoading,
  currentLog,
  onComplete,
}) => {
  const [progress, setProgress] = useState<number>(0);
  const [phaseIndex, setPhaseIndex] = useState<number>(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isLoading) {
      if (progress > 0 && progress < 100) {
        setProgress(100);
        const timer = setTimeout(() => {
          setProgress(0);
          setPhaseIndex(0);
          if (onCompleteRef.current) onCompleteRef.current();
        }, 1200);
        return () => clearTimeout(timer);
      }
      return;
    }

    setProgress(5);
    setPhaseIndex(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev; // Hold at 92 until finished
        const next = prev + Math.floor(Math.random() * 8) + 4;
        return Math.min(next, 92);
      });
    }, 900);

    const phaseInterval = setInterval(() => {
      setPhaseIndex((prev) => (prev < DEFAULT_PHASES.length - 1 ? prev + 1 : prev));
    }, 2800);

    return () => {
      clearInterval(interval);
      clearInterval(phaseInterval);
    };
  }, [isLoading]);

  if (!isLoading && progress === 0) return null;

  const currentPhase = DEFAULT_PHASES[phaseIndex] || DEFAULT_PHASES[0];
  const displayMsg = currentLog || currentPhase.msg;

  return (
    <div className="w-full my-4 p-4 rounded-xl bg-slate-900/90 border border-blue-500/30 shadow-lg shadow-blue-500/10 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {progress === 100 ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-bounce" />
          ) : (
            <Sparkles className="w-5 h-5 text-blue-400 animate-spin" style={{ animationDuration: '3s' }} />
          )}
          <span className="text-sm font-medium text-slate-200">
            {progress === 100 ? '✅ Търсенето завърши успешно!' : displayMsg}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {progress < 100 && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
          <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-800/40">
            {progress}%
          </span>
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-500 ease-out shadow-sm shadow-emerald-500/50"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-between items-center mt-2 text-[11px] text-slate-400">
        <span>Обхождане на избраните платформи...</span>
        <span>{progress < 100 ? 'Моля изчакайте' : 'Готово'}</span>
      </div>
    </div>
  );
};
