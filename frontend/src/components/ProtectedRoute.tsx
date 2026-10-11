import React from 'react';
import { Lock, LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  onOpenAuth: () => void;
  onOpenWaitlist: () => void;
  featureName?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  onOpenAuth,
  onOpenWaitlist,
  featureName = 'тази функционалност',
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center shadow-xl backdrop-blur-sm animate-in fade-in duration-300">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Изисква се Вход в Системата</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          За да използвате <span className="text-slate-200 font-semibold">{featureName}</span>, да запазвате персонални статуси на обяви и да генерирате AI мотивационни писма, е необходимо да влезете в профила си.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onOpenAuth}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
          >
            <LogIn className="w-4 h-4" />
            <span>Вход с Имейл & Парола</span>
          </button>
          <button
            onClick={onOpenWaitlist}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 transition"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Поискай ранен достъп (Waitlist)</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
