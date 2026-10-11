import React, { useState } from 'react';
import type { Job, ApplicationStatus } from '../types';
import {
  X,
  Building,
  MapPin,
  DollarSign,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  Trash2,
} from 'lucide-react';
import { apiGenerateCoverLetter } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface JobDetailModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (jobId: string | number, status: ApplicationStatus) => void;
  onDelete: (jobId: string | number) => void;
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: 'Нова',
  applied: 'Кандидатствал',
  interview: 'Интервю',
  offer: 'Оферта',
  rejected: 'Отказана',
  saved: 'Запазена',
  archived: 'Архивирана',
};

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  isOpen,
  onClose,
  onStatusChange,
  onDelete,
}) => {
  const { session } = useAuth();
  const [coverLetter, setCoverLetter] = useState<string | null>(job?.cover_letter || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !job) return null;

  const handleGenerateLetter = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const res = await apiGenerateCoverLetter(
        {
          job_id: job.id,
          title: job.title,
          company: job.company,
          description: job.description || '',
        },
        session?.access_token
      );
      setCoverLetter(res.cover_letter);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Грешка при генериране на писмото.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!coverLetter) return;
    navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const score = job.match_score ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                {job.source}
              </span>
              {score !== null && (
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                    score >= 80
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : score >= 60
                      ? 'bg-teal-500/15 text-teal-400 border-teal-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{score}% AI Съвпадение</span>
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              {job.title}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1 text-slate-300">
                <Building className="w-3.5 h-3.5 text-slate-500" />
                <span>{job.company}</span>
              </div>
              {job.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{job.location}</span>
                </div>
              )}
              {job.salary && (
                <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>{job.salary}</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Status and Direct Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Статус:</span>
              <select
                value={job.status}
                onChange={(e) => onStatusChange(job.id, e.target.value as ApplicationStatus)}
                className="bg-slate-900 border border-slate-700 text-emerald-400 text-xs font-semibold rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-500"
              >
                {Object.entries(STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition"
              >
                <span>Към Обявата</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => {
                  if (confirm('Сигурни ли сте, че искате да изтриете тази позиция?')) {
                    onDelete(job.id);
                    onClose();
                  }
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                title="Изтрий обявата"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* AI Summary Box */}
          {job.ai_summary && (
            <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Анализ & Резюме на Позицията</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{job.ai_summary}</p>
            </div>
          )}

          {/* Matched & Missing Skills Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Matched Skills */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Съвпадащи умения ({job.matched_skills?.length || 0})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {job.matched_skills && job.matched_skills.length > 0 ? (
                  job.matched_skills.map((s, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">Няма открити съвпадения</span>
                )}
              </div>
            </div>

            {/* Missing Skills */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <AlertCircle className="w-4 h-4" />
                <span>Липсващи изисквания ({job.missing_skills?.length || 0})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {job.missing_skills && job.missing_skills.length > 0 ? (
                  job.missing_skills.map((s, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium"
                    >
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">Няма регистрирани липси</span>
                )}
              </div>
            </div>
          </div>

          {/* Cover Letter Generator Section */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Персонализирано Мотивационно Писмо
                </h4>
              </div>

              <button
                onClick={handleGenerateLetter}
                disabled={isGenerating}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Генериране...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{coverLetter ? 'Регенерирай' : 'Генерирай с Gemini AI'}</span>
                  </>
                )}
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {errorMsg}
              </div>
            )}

            {coverLetter && (
              <div className="relative mt-2">
                <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line max-h-60 overflow-y-auto">
                  {coverLetter}
                </div>
                <button
                  onClick={handleCopy}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1 text-[11px]"
                  title="Копирай писмото"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Копирано</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Копирай</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Пълно Описание на Позицията
            </h4>
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {job.description || 'Няма въведено пълно текстово описание за тази позиция.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
