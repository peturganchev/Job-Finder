import React, { useState, useEffect } from 'react';
import {
  Upload,
  Sparkles,
  Save,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  User,
  Clock,
  Code,
  Globe,
} from 'lucide-react';
import { apiParseCV } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export const ProfileView: React.FC = () => {
  const { user, session } = useAuth();

  const [fullName, setFullName] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [experienceYears, setExperienceYears] = useState<number>(3);
  const [skills, setSkills] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);

  // Tag inputs
  const [newSkill, setNewSkill] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newLanguage, setNewLanguage] = useState('');

  // UI status
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load existing profile from Supabase user_settings
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_settings')
      .select('profile_data, keywords')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data, error }) => {
        if (!error && data && data[0]?.profile_data) {
          const p = data[0].profile_data;
          if (p.name) setFullName(p.name);
          if (p.current_title) setCurrentTitle(p.current_title);
          if (p.summary) setSummary(p.summary);
          if (p.experience_years) setExperienceYears(p.experience_years);
          if (p.current_skills) setSkills(p.current_skills);
          if (p.target_roles) setTargetRoles(p.target_roles);
          if (p.languages) setLanguages(p.languages);
        }
      });
  }, [user]);

  // Handle PDF file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setStatusMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiParseCV(formData, session?.access_token);
      if (res.name) setFullName(res.name);
      if (res.current_title) setCurrentTitle(res.current_title);
      if (res.summary) setSummary(res.summary);
      if (res.experience_years) setExperienceYears(res.experience_years);
      if (res.current_skills?.length) setSkills(res.current_skills);
      if (res.target_roles?.length) setTargetRoles(res.target_roles);
      if (res.languages?.length) setLanguages(res.languages);

      setStatusMsg({
        type: 'success',
        text: `CV "${file.name}" беше анализирано успешно с Gemini AI!`,
      });
    } catch (err: unknown) {
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Грешка при парсване на CV.',
      });
    } finally {
      setParsing(false);
    }
  };

  // Add tag helpers
  const handleAddSkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const val = newSkill.trim();
    if (val && !skills.includes(val)) {
      setSkills([...skills, val]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleAddRole = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const val = newRole.trim();
    if (val && !targetRoles.includes(val)) {
      setTargetRoles([...targetRoles, val]);
      setNewRole('');
    }
  };

  const handleRemoveRole = (roleToRemove: string) => {
    setTargetRoles(targetRoles.filter((r) => r !== roleToRemove));
  };

  const handleAddLanguage = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const val = newLanguage.trim();
    if (val && !languages.includes(val)) {
      setLanguages([...languages, val]);
      setNewLanguage('');
    }
  };

  const handleRemoveLanguage = (langToRemove: string) => {
    setLanguages(languages.filter((l) => l !== langToRemove));
  };

  // Save profile to Supabase user_settings
  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setStatusMsg(null);

    const profileData = {
      name: fullName,
      current_title: currentTitle,
      summary,
      experience_years: experienceYears,
      current_skills: skills,
      target_roles: targetRoles,
      languages,
    };

    try {
      const { error } = await supabase.from('user_settings').upsert({
        user_id: user.id,
        profile_data: profileData,
        keywords: targetRoles.length > 0 ? targetRoles : ['AI Engineer', 'Python'],
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setStatusMsg({
        type: 'success',
        text: 'Профилът и техническите умения бяха запазени успешно в Supabase!',
      });
    } catch (err: unknown) {
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Грешка при запис на профила.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Title */}
      <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <User className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              CV Интелигентност &amp; Профил
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Качете автобиография (PDF) за автоматично извличане на умения с Gemini AI
          </p>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={saving || parsing}
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
              <span>Запази Профила</span>
            </>
          )}
        </button>
      </div>

      {/* Notification Banner */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-2.5 text-xs ${
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

      {/* Upload Box */}
      <div className="relative p-8 rounded-2xl bg-slate-900/40 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 transition-colors text-center group cursor-pointer">
        <input
          type="file"
          accept=".pdf"
          disabled={parsing}
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
            {parsing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">
              {parsing ? 'Gemini AI анализира вашето CV...' : 'Качи CV в PDF формат'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Кликнете или плъзнете файл тук. Изкуственият интелект ще извлече автоматично вашите практически умения и години опит.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Fields Form */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-emerald-400" />
          <span>Лична и Професионална Информация</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Пълно Име
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Петър Иванов"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Настояща или Последна Позиция
            </label>
            <input
              type="text"
              value={currentTitle}
              onChange={(e) => setCurrentTitle(e.target.value)}
              placeholder="Senior Software Engineer"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Години Общ Професионален Опит
          </label>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-slate-500" />
            <input
              type="number"
              min={0}
              max={50}
              value={experienceYears}
              onChange={(e) => setExperienceYears(Number(e.target.value))}
              className="w-28 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
            />
            <span className="text-xs text-slate-400">години</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Кратко Професионално Резюме (Summary)
          </label>
          <textarea
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Опитен инженер с фокус върху Agentic AI системи, LLM orchestration и Python..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition resize-none leading-relaxed"
          />
        </div>

        {/* Technical Skills Tags */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Code className="w-4 h-4 text-emerald-400" />
              <span>Технически Умения ({skills.length})</span>
            </label>
            <span className="text-[11px] text-slate-500">Натиснете Enter за добавяне</span>
          </div>

          <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 min-h-[50px] items-center">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium"
              >
                <span>{skill}</span>
                <button
                  onClick={() => handleRemoveSkill(skill)}
                  className="hover:text-white transition"
                  title="Премахни"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={handleAddSkill}
                placeholder="+ Добави умение..."
                className="bg-transparent border-none text-xs text-white placeholder-slate-500 outline-none w-32 px-1"
              />
              {newSkill.trim() && (
                <button
                  onClick={handleAddSkill}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 transition"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Target Roles Tags */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-teal-400" />
              <span>Търсени Роли ({targetRoles.length})</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 min-h-[50px] items-center">
            {targetRoles.map((role) => (
              <span
                key={role}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-medium"
              >
                <span>{role}</span>
                <button
                  onClick={() => handleRemoveRole(role)}
                  className="hover:text-white transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={handleAddRole}
                placeholder="+ Добави роля..."
                className="bg-transparent border-none text-xs text-white placeholder-slate-500 outline-none w-32 px-1"
              />
              {newRole.trim() && (
                <button
                  onClick={handleAddRole}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-400 transition"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Languages Tags */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-indigo-400" />
            <span>Говорими Езици ({languages.length})</span>
          </label>

          <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 min-h-[50px] items-center">
            {languages.map((lang) => (
              <span
                key={lang}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-medium"
              >
                <span>{lang}</span>
                <button
                  onClick={() => handleRemoveLanguage(lang)}
                  className="hover:text-white transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                onKeyDown={handleAddLanguage}
                placeholder="+ Добави език..."
                className="bg-transparent border-none text-xs text-white placeholder-slate-500 outline-none w-32 px-1"
              />
              {newLanguage.trim() && (
                <button
                  onClick={handleAddLanguage}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-400 transition"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
