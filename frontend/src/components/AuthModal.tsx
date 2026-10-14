import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, Loader2, AlertCircle, CheckCircle2, UserPlus, LogIn, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiCheckWaitlist } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWaitlist: () => void;
  initialMode?: 'signin' | 'signup';
  prefilledEmail?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onOpenWaitlist,
  initialMode = 'signin',
  prefilledEmail = '',
}) => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isWaitlistBlocked, setIsWaitlistBlocked] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      if (prefilledEmail) {
        setEmail(prefilledEmail);
      }
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsWaitlistBlocked(false);
    }
  }, [isOpen, initialMode, prefilledEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsWaitlistBlocked(false);

    const cleanEmail = email.trim();

    if (mode === 'signup' && password !== confirmPassword) {
      setErrorMsg('Паролите не съвпадат.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Паролата трябва да бъде поне 6 символа.');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'signin') {
        const { error } = await signIn(cleanEmail, password);
        if (error) throw error;
        onClose();
      } else {
        // 1. Whitelist Verification
        const check = await apiCheckWaitlist(cleanEmail);
        if (!check.allowed) {
          setIsWaitlistBlocked(true);
          setErrorMsg(check.message || 'Този имейл адрес не е в списъка с одобрени потребители. Моля, първо заявете ранен достъп през Waitlist.');
          setLoading(false);
          return;
        }

        // 2. Perform Supabase Sign Up
        const { error } = await signUp(cleanEmail, password);
        if (error) throw error;

        // 3. Immediately auto-signin so the user lands straight inside the dashboard!
        const { error: signInErr } = await signIn(cleanEmail, password);
        if (!signInErr) {
          setSuccessMsg('Добре дошли! Влизане в таблото...');
          setTimeout(() => {
            onClose();
            // Clean hash if was on register
            if (window.location.hash.startsWith('#register')) {
              window.location.hash = 'jobs';
            }
          }, 600);
        } else {
          setSuccessMsg('Регистрацията е успешна! Можете да влезете в профила си.');
          setMode('signin');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Грешка при автентикация.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsWaitlistBlocked(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Tabs */}
        <div className="flex border-b border-slate-800 mb-6">
          <button
            onClick={() => { setMode('signin'); setErrorMsg(null); setIsWaitlistBlocked(false); }}
            className={`pb-3 font-semibold text-sm transition relative flex items-center gap-2 ${
              mode === 'signin' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Вход в Системата</span>
            {mode === 'signin' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => { setMode('signup'); setErrorMsg(null); setIsWaitlistBlocked(false); }}
            className={`ml-6 pb-3 font-semibold text-sm transition relative flex items-center gap-2 ${
              mode === 'signup' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Регистрация</span>
            {mode === 'signup' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t-full" />
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
            {isWaitlistBlocked ? (
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span>{errorMsg}</span>
              {isWaitlistBlocked && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onOpenWaitlist();
                    }}
                    className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 transition text-xs"
                  >
                    👉 Подайте заявка за достъп сега
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Имейл адрес
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Парола
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Потвърди паролата
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-60 transition"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Зареждане...</span>
              </>
            ) : mode === 'signin' ? (
              <span>Вход</span>
            ) : (
              <span>Регистрация</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400">
            Нямате одобрен акаунт?{' '}
            <button
              type="button"
              onClick={() => {
                handleClose();
                onOpenWaitlist();
              }}
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 transition"
            >
              Поискайте достъп през Waitlist
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
