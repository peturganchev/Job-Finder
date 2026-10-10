import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Key,
  Cpu,
  ShieldBan,
  Building,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  Users,
  Plus,
  X,
  Sliders,
} from 'lucide-react';
import { apiGetSettings, apiUpdateSettings, apiVerifyGeminiKey, type SettingsData } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface SettingsViewProps {
  onOpenAdmin: () => void;
}

const DEFAULT_BLACKLIST_TITLES = [
  'Senior Director',
  'VP of',
  'Head of AI',
  'Lead Architect',
  'Principal Engineer',
  'WordPress',
  'PHP Developer',
  'Frontend React',
  'iOS Developer',
  'Android Developer',
  'Java Developer',
  '.NET Developer',
  'Manual QA',
];

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenAdmin }) => {
  const { session, isWaitlistAdmin } = useAuth();

  // Settings State
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Gemini state
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [maskedKey, setMaskedKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [availableModels, setAvailableModels] = useState<string[]>([
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-2.5-pro',
    'antigravity-preview-latest',
  ]);
  const [verifyingKey, setVerifyingKey] = useState<boolean>(false);
  const [keyValidationStatus, setKeyValidationStatus] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  // Blacklist state
  const [blacklistTitles, setBlacklistTitles] = useState<string[]>(DEFAULT_BLACKLIST_TITLES);
  const [newTitle, setNewTitle] = useState<string>('');

  const [blacklistCompanies, setBlacklistCompanies] = useState<string[]>([]);
  const [newCompany, setNewCompany] = useState<string>('');

  // Search defaults
  const [location, setLocation] = useState<string>('Bulgaria');
  const [remoteLocation, setRemoteLocation] = useState<string>('Worldwide');
  const [maxJobsPerSource, setMaxJobsPerSource] = useState<number>(15);

  // Load settings on mount
  useEffect(() => {
    setLoading(true);
    apiGetSettings(session?.access_token)
      .then((data: SettingsData) => {
        if (data.gemini_api_key_masked) {
          setMaskedKey(data.gemini_api_key_masked);
        }
        if (data.gemini_model) {
          setSelectedModel(data.gemini_model);
        }
        if (data.available_models && data.available_models.length > 0) {
          setAvailableModels(data.available_models);
        }
        if (data.blacklist_title && data.blacklist_title.length > 0) {
          setBlacklistTitles(data.blacklist_title);
        }
        if (data.blacklist_companies) {
          setBlacklistCompanies(data.blacklist_companies);
        }
        if (data.location) setLocation(data.location);
        if (data.remote_location) setRemoteLocation(data.remote_location);
        if (data.max_jobs_per_source) setMaxJobsPerSource(data.max_jobs_per_source);
      })
      .catch((err) => {
        console.error('Failed to load settings:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [session]);

  // Verify Key Handler
  const handleVerifyKey = async () => {
    const keyToTest = apiKeyInput.trim();
    if (!keyToTest) {
      setKeyValidationStatus({
        valid: false,
        message: 'Моля, въведете API ключ преди тестване.',
      });
      return;
    }

    setVerifyingKey(true);
    setKeyValidationStatus(null);
    try {
      const res = await apiVerifyGeminiKey(keyToTest);
      setKeyValidationStatus({
        valid: res.valid,
        message: res.message,
      });
      if (res.valid && res.models && res.models.length > 0) {
        setAvailableModels(res.models);
        if (!res.models.includes(selectedModel)) {
          setSelectedModel(res.models[0]);
        }
      }
    } catch (err: unknown) {
      setKeyValidationStatus({
        valid: false,
        message: err instanceof Error ? err.message : 'Грешка при верификация.',
      });
    } finally {
      setVerifyingKey(false);
    }
  };

  // Blacklist helper
  const addTitleTags = (rawInput: string) => {
    const pieces = rawInput
      .split(/[\n,;]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    if (pieces.length === 0) return;
    setBlacklistTitles((prev) => Array.from(new Set([...prev, ...pieces])));
    setNewTitle('');
  };

  const addCompanyTags = (rawInput: string) => {
    const pieces = rawInput
      .split(/[\n,;]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    if (pieces.length === 0) return;
    setBlacklistCompanies((prev) => Array.from(new Set([...prev, ...pieces])));
    setNewCompany('');
  };

  // Save Settings Handler
  const handleSaveSettings = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const payload: {
        gemini_api_key?: string | null;
        gemini_model?: string;
        blacklist_title?: string[];
        blacklist_companies?: string[];
        location?: string;
        remote_location?: string;
        max_jobs_per_source?: number;
      } = {
        gemini_model: selectedModel,
        blacklist_title: blacklistTitles,
        blacklist_companies: blacklistCompanies,
        location,
        remote_location: remoteLocation,
        max_jobs_per_source: maxJobsPerSource,
      };

      if (apiKeyInput.trim()) {
        payload.gemini_api_key = apiKeyInput.trim();
      }

      const res = await apiUpdateSettings(payload, session?.access_token);
      setStatusMsg({
        type: 'success',
        text: res.message || 'Настройките бяха запазени успешно!',
      });
      if (apiKeyInput.trim()) {
        setMaskedKey(`${apiKeyInput.trim().slice(0, 6)}...${apiKeyInput.trim().slice(-4)}`);
        setApiKeyInput('');
      }
    } catch (err: unknown) {
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Грешка при запис на настройките.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-xs text-slate-400">Зареждане на системните настройки...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Title */}
      <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SettingsIcon className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Системни Настройки &amp; Модели
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Управление на Google Gemini API ключове, модели, филтри за изключване и параметри
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Запазване...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Запази Настройките</span>
            </>
          )}
        </button>
      </div>

      {/* Notification Banner */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-2.5 text-xs animate-in fade-in ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Admin Shortcut if applicable */}
      {isWaitlistAdmin && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-white">Администраторски Панел за Достъп</h4>
              <p className="text-[11px] text-indigo-300/80">
                Вие имате права за одобряване на чакащи потребители от списъка с чакащи (Waitlist).
              </p>
            </div>
          </div>
          <button
            onClick={onOpenAdmin}
            className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold transition shrink-0"
          >
            Отвори Waitlist Admin
          </button>
        </div>
      )}

      {/* Gemini AI Settings Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Key className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Google Gemini API Ключ &amp; Интелигентност</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Използва се за оценка на съответствието, AI резюмета и генерация на мотивационни писма
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-mono">
            BYOK (Bring Your Own Key)
          </span>
        </div>

        {/* API Key Input */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-300">
            Gemini API Key
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={maskedKey ? `Активен ключ: ${maskedKey}` : 'AIzaSy... въведете вашия ключ'}
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 font-mono transition"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleVerifyKey}
              disabled={verifyingKey || (!apiKeyInput.trim() && !maskedKey)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 shrink-0"
            >
              {verifyingKey ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              )}
              <span>Тествай ключа</span>
            </button>
          </div>

          {keyValidationStatus && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                keyValidationStatus.valid
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {keyValidationStatus.valid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{keyValidationStatus.message}</span>
            </div>
          )}
        </div>

        {/* Model Selection Dropdown */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-teal-400" />
            <span>Избор на Gemini Модел за Анализ</span>
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-emerald-500 transition"
          >
            {availableModels.map((m) => (
              <option key={m} value={m} className="bg-slate-900 text-white">
                {m} {m === 'gemini-3.5-flash' ? '(Препоръчителен - бърз & точен)' : ''}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500">
            Списъкът показва реално достъпните модели за вашия акаунт в Google AI Studio.
          </p>
        </div>
      </div>

      {/* Blacklist Job Titles Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <ShieldBan className="w-5 h-5 text-red-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Черен Списък на Заглавия (Blacklist Titles)</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Обяви, чието заглавие съдържа тези термини, се прескачат автоматично
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setBlacklistTitles(DEFAULT_BLACKLIST_TITLES)}
            className="text-xs text-slate-400 hover:text-white underline transition self-start sm:self-auto"
          >
            Възстанови по подразбиране
          </button>
        </div>

        <div className="flex flex-wrap gap-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800 min-h-[50px] items-center">
          {blacklistTitles.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-xs font-medium"
            >
              <span>{t}</span>
              <button
                type="button"
                onClick={() => setBlacklistTitles(blacklistTitles.filter((item) => item !== t))}
                className="hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}

          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTitleTags(newTitle);
                }
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (text && (text.includes(',') || text.includes('\n') || text.includes(';'))) {
                  e.preventDefault();
                  addTitleTags(text);
                }
              }}
              placeholder="+ Добави нежелана позиция (или със запетаи)..."
              className="bg-transparent border-none text-xs text-white placeholder-slate-500 outline-none w-full px-1"
            />
            {newTitle.trim() && (
              <button
                type="button"
                onClick={() => addTitleTags(newTitle)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-red-400 transition shrink-0"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Blacklist Companies Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
        <div className="flex items-center gap-2.5">
          <Building className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Черен Списък на Компании (Blacklist Companies)</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Обяви от тези работодатели няма да бъдат записвани в каталога
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800 min-h-[50px] items-center">
          {blacklistCompanies.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-medium"
            >
              <span>{c}</span>
              <button
                type="button"
                onClick={() => setBlacklistCompanies(blacklistCompanies.filter((item) => item !== c))}
                className="hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}

          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <input
              type="text"
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCompanyTags(newCompany);
                }
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (text && (text.includes(',') || text.includes('\n') || text.includes(';'))) {
                  e.preventDefault();
                  addCompanyTags(text);
                }
              }}
              placeholder="+ Добави компания за изключване..."
              className="bg-transparent border-none text-xs text-white placeholder-slate-500 outline-none w-full px-1"
            />
            {newCompany.trim() && (
              <button
                type="button"
                onClick={() => addCompanyTags(newCompany)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 transition shrink-0"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search Defaults */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span>Параметри на Търсене по Подразбиране</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Основна локация
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Дистанционна локация (Remote)
            </label>
            <input
              type="text"
              value={remoteLocation}
              onChange={(e) => setRemoteLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
