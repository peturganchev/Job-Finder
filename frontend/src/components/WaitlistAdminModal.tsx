import React, { useEffect, useState } from 'react';
import { X, Check, Trash2, Clock, Users, RefreshCw, AlertCircle, Copy, CheckCircle2, UserCheck, UserX, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiGetWaitlistRequests, apiApproveWaitlist, apiRejectWaitlist, type WaitlistRequestItem } from '../lib/api';

interface WaitlistAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'pending' | 'approved' | 'rejected';

export const WaitlistAdminModal: React.FC<WaitlistAdminModalProps> = ({ isOpen, onClose }) => {
  const { session } = useAuth();
  const [requests, setRequests] = useState<WaitlistRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiGetWaitlistRequests(session?.access_token);
      setRequests(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Грешка при зареждане на заявките.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRequests();
    }
  }, [isOpen, session?.access_token]);

  const handleApprove = async (req: WaitlistRequestItem) => {
    setActionLoadingId(req.id);
    setErrorMsg(null);
    try {
      const res = await apiApproveWaitlist(
        { id: req.id, email: req.email, full_name: req.full_name },
        session?.access_token
      );
      // Update state: immediately updates status so it disappears from 'pending' tab
      setRequests((prev) =>
        prev.map((item) => (item.id === req.id ? { ...item, status: 'approved' } : item))
      );
      setSuccessMsg(res.message);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Грешка при одобряване.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (req: WaitlistRequestItem) => {
    setActionLoadingId(req.id);
    setErrorMsg(null);
    try {
      const res = await apiRejectWaitlist(req.id, session?.access_token);
      setRequests((prev) =>
        prev.map((item) => (item.id === req.id ? { ...item, status: 'rejected' } : item))
      );
      setSuccessMsg(res.message);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Грешка при отказване.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getInviteUrl = (email: string) => {
    return `https://job-finder.archevyn.dev/#register?email=${encodeURIComponent(email)}`;
  };

  const handleCopyInvite = (req: WaitlistRequestItem) => {
    const url = getInviteUrl(req.email);
    navigator.clipboard.writeText(url);
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  if (!isOpen) return null;

  const pendingList = requests.filter((r) => r.status === 'pending');
  const approvedList = requests.filter((r) => r.status === 'approved');
  const rejectedList = requests.filter((r) => r.status === 'rejected');

  const currentList =
    activeTab === 'pending'
      ? pendingList
      : activeTab === 'approved'
      ? approvedList
      : rejectedList;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Управление на Waitlist</h2>
                {pendingList.length > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold animate-pulse">
                    {pendingList.length} чакащи
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Преглед, whitelisting и одобряване на покани за ранен достъп
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchRequests}
              disabled={loading}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Презареди"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 px-6 pt-2 bg-slate-900/60">
          <button
            onClick={() => { setActiveTab('pending'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`pb-3 pt-2 font-semibold text-xs flex items-center gap-2 relative transition ${
              activeTab === 'pending' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Чакащи ({pendingList.length})</span>
            {activeTab === 'pending' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => { setActiveTab('approved'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`ml-6 pb-3 pt-2 font-semibold text-xs flex items-center gap-2 relative transition ${
              activeTab === 'approved' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Одобрени ({approvedList.length})</span>
            {activeTab === 'approved' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => { setActiveTab('rejected'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`ml-6 pb-3 pt-2 font-semibold text-xs flex items-center gap-2 relative transition ${
              activeTab === 'rejected' ? 'text-red-400' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Отказани ({rejectedList.length})</span>
            {activeTab === 'rejected' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400 rounded-t-full" />
            )}
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button
                onClick={() => setSuccessMsg(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {currentList.length === 0 && !loading ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              {activeTab === 'pending'
                ? 'Няма чакащи заявки. Всички кандидати са обслужени!'
                : activeTab === 'approved'
                ? 'Все още няма одобрени кандидати.'
                : 'Няма отказани заявки.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {currentList.map((req) => (
                <div key={req.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{req.full_name}</span>
                      <span className="text-xs text-slate-400">({req.email})</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          req.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : req.status === 'rejected'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {req.status === 'approved' ? 'Одобрен' : req.status === 'rejected' ? 'Отказан' : 'Чакащ'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      {req.target_job_title && (
                        <span>🎯 Роля: <strong className="text-slate-300">{req.target_job_title}</strong></span>
                      )}
                      {req.years_of_experience && (
                        <span>⏳ Опит: <strong className="text-slate-300">{req.years_of_experience} г.</strong></span>
                      )}
                      {req.linkedin_url && (
                        <a
                          href={req.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline underline-offset-2"
                        >
                          LinkedIn <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {req.created_at && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>Подадена: {new Date(req.created_at).toLocaleString('bg-BG')}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions depending on Tab */}
                  <div className="flex items-center gap-2 shrink-0">
                    {activeTab === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={actionLoadingId === req.id}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{actionLoadingId === req.id ? 'Одобряване...' : 'Одобри'}</span>
                        </button>
                        <button
                          onClick={() => handleReject(req)}
                          disabled={actionLoadingId === req.id}
                          className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{actionLoadingId === req.id ? '...' : 'Откажи'}</span>
                        </button>
                      </>
                    )}

                    {activeTab === 'approved' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyInvite(req)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
                          title="Копирай директен линк за регистрация"
                        >
                          {copiedId === req.id ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-semibold">Копиран!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span>Копирай покана</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {activeTab === 'rejected' && (
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={actionLoadingId === req.id}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Одобри все пак</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
