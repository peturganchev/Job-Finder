import React, { useState, useEffect } from 'react';
import {
  Award,
  BookOpen,
  FolderGit2,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Save,
  Loader2,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Link2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type ProjectStatus = 'production' | 'in_progress' | 'planned';

const ROADMAP_VERSION = 2;
const ROADMAP_STORAGE_KEY = 'jobfinder_v2_main_roadmap';

const ROADMAP_SKILLS = [
  { id: 'sk_p1', level: 1, title: 'Prompt Engineering for Developers (Завършен)', default: true },
  { id: 'sk_p2', level: 1, title: 'AI-Assisted Prototyping (Build with Andrew)', default: false },
  { id: 'sk_p3', level: 1, title: 'AI Python for Beginners (Тестване & Дебъгване)', default: false },
  { id: 'sk_p4', level: 1, title: 'Spec-Driven Development с Coding Agents', default: false },

  { id: 'sk_p5', level: 2, title: '4-те Агентни Модела (Reflection, Tools, Plan, Multi-Agent)', default: false },
  { id: 'sk_p6', level: 2, title: 'Structured LLM Output (Стриктни JSON Схеми)', default: false },
  { id: 'sk_p7', level: 2, title: 'Agentic RAG & Document Routing (LlamaIndex)', default: false },
  { id: 'sk_p8', level: 2, title: 'Multi-Step Tool Execution & Контекстни Пайплайни', default: false },

  { id: 'sk_p9', level: 3, title: 'Evaluating AI Agents & Trajectory Tracing (Arize AI)', default: false },
  { id: 'sk_p10', level: 3, title: 'Production RAG Architecture & Evaluation (35h Track)', default: false },
  { id: 'sk_p11', level: 3, title: 'Model Context Protocol (MCP) с Anthropic', default: false },
  { id: 'sk_p12', level: 3, title: 'Agent Skills Workflows (Coding, Research & Data)', default: false },
];

const DEEPLEARNING_COURSES = [
  {
    level: 1,
    title: 'Ниво 1: Foundation (Prompting, AI Python & Spec-Driven Разработка)',
    courses: [
      { name: 'ChatGPT Prompt Engineering for Developers', by: 'DeepLearning.AI & OpenAI', meta: 'Завършен' },
      { name: 'Build with Andrew', by: 'DeepLearning.AI', meta: '1.5h · Introductory' },
      { name: 'AI Python for Beginners', by: 'DeepLearning.AI', meta: '4.5h · Introductory' },
      { name: 'Spec-Driven Development with Coding Agents', by: 'JetBrains', meta: '1.3h · Beginner' },
    ],
  },
  {
    level: 2,
    title: 'Ниво 2: Core Track (Агентни Архитектури, Agentic RAG & Structured Output)',
    courses: [
      { name: 'Agentic AI with Andrew Ng', by: 'DeepLearning.AI', meta: '8.2h · Intermediate' },
      { name: 'Getting Structured LLM Output', by: 'DotTxt', meta: '1.5h · Intermediate' },
      { name: 'Building Agentic RAG with LlamaIndex', by: 'LlamaIndex', meta: '1h · Introductory' },
    ],
  },
  {
    level: 3,
    title: 'Ниво 3: Specialization & Production (Eval Harness, RAG & Anthropic)',
    courses: [
      { name: 'Evaluating AI Agents', by: 'Arize AI', meta: '2.5h · Introductory' },
      { name: 'Retrieval Augmented Generation (RAG) Course', by: 'DeepLearning.AI', meta: '35h · Explore more' },
      { name: 'MCP: Build Rich-Context AI Apps with Anthropic', by: 'Anthropic', meta: '2h · Explore more' },
      { name: 'Agent Skills with Anthropic', by: 'Anthropic', meta: '2.5h · Explore more' },
    ],
  },
];

const PORTFOLIO_PROJECTS: Array<{
  id: string;
  name: string;
  defaultStatus: ProjectStatus;
  level: string;
  desc: string;
  stack: string[];
  proof: string;
}> = [
  {
    id: '1',
    name: '1. 🤖 Job-Finder v2 & Market Intelligence Agent',
    defaultStatus: 'production',
    level: 'Intermediate',
    desc: 'Автономна система за агрегиране и оценяване на AI/ML позиции (dev.bg, jobs.bg, LinkedIn, EU Remote Jobs, HackerNews) с FastAPI, Supabase RLS, Cloudflare Workers, React 19 и структуриран Gemini BYOK анализ.',
    stack: ['FastAPI', 'React 19', 'TypeScript', 'Supabase RLS', 'Cloudflare Workers', 'Gemini API'],
    proof: 'End-to-end Spec-Driven разработка, мулти-тенант сигурност и структуриран LLM изход.',
  },
  {
    id: '2',
    name: '2. 📐 Spec-Driven Coding Agent & Reusable Agent Skills',
    defaultStatus: 'planned',
    level: 'Beginner to Intermediate',
    desc: 'Колекция от специализирани Agent Skills и Spec-Driven работни потоци (spec -> plan -> test -> verify), които снабдяват кодиращи агенти с детерминистични правила и контекст без vibe coding.',
    stack: ['Spec-Driven Dev', 'Agent Skills', 'Python', 'pytest', 'Markdown Specs'],
    proof: 'Умение за изграждане на предвидими, поддържаеми системи с кодиращи агенти.',
  },
  {
    id: '3',
    name: '3. 🧠 Personal Context & Knowledge Server (MCP Server)',
    defaultStatus: 'planned',
    level: 'Intermediate',
    desc: 'Персонализиран сървър по Model Context Protocol (MCP) на Anthropic, който излага локални ресурси, бази данни и инструменти със стриктни JSON схеми към AI клиенти и автономни агенти.',
    stack: ['Python', 'Anthropic MCP SDK', 'JSON Schema', 'Pydantic', 'FastAPI'],
    proof: 'Свързване на външен контекст и надеждни tool контракти към LLM приложения.',
  },
  {
    id: '4',
    name: '4. 📚 Agentic RAG Document Router & Research Assistant',
    defaultStatus: 'planned',
    level: 'Intermediate to Advanced',
    desc: 'Агентен RAG пайплайн с LlamaIndex, който интелигентно маршрутизира заявки между хетерогенни документи, синтезира отговори и прилага итеративни агентни модели (Reflection, Planning, Tool Use).',
    stack: ['LlamaIndex', 'Python', 'Agentic RAG', 'Structured Output', 'Vector Retrieval'],
    proof: 'Интелигентно извличане и маршрутизиране на сложни колекции от документи.',
  },
  {
    id: '5',
    name: '5. 🧪 AI Agent Trajectory Eval & Tracing Harness',
    defaultStatus: 'planned',
    level: 'Intermediate to Advanced',
    desc: 'Систематична рамка за трасиране и оценка (benchmarking) на многостъпкови агентни траектории. Диагностицира грешки при извикване на инструменти, халюцинации, латентност и разход на токени.',
    stack: ['Arize Phoenix / Evals', 'OpenTelemetry', 'Python', 'pytest', 'JSON Schema'],
    proof: 'Eval-Driven инженерство и систематична диагностика на автономни AI агенти.',
  },
];

const STATUS_META: Record<ProjectStatus, { label: string; badgeClass: string }> = {
  production: {
    label: 'В ПРОИЗВОДСТВО',
    badgeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  },
  in_progress: {
    label: 'В РАЗРАБОТКА',
    badgeClass: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  },
  planned: {
    label: 'ПЛАНИРАН (Roadmap)',
    badgeClass: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
  },
};

const buildDefaultSkills = (): Record<string, boolean> => {
  const initial: Record<string, boolean> = {};
  ROADMAP_SKILLS.forEach((s) => {
    initial[s.id] = s.default;
  });
  return initial;
};

const buildDefaultProjectLinks = (): Record<string, string> => {
  const initial: Record<string, string> = {};
  PORTFOLIO_PROJECTS.forEach((p) => {
    initial[p.id] = '';
  });
  return initial;
};

const buildDefaultProjectStatuses = (): Record<string, ProjectStatus> => {
  const initial: Record<string, ProjectStatus> = {};
  PORTFOLIO_PROJECTS.forEach((p) => {
    initial[p.id] = p.defaultStatus;
  });
  return initial;
};

const isSafeHttpUrl = (value: string): boolean => /^https?:\/\/\S+/i.test(value.trim());

const parseStoredPayload = (raw: unknown) => {
  const defaultSkills = buildDefaultSkills();
  const defaultLinks = buildDefaultProjectLinks();
  const defaultStatuses = buildDefaultProjectStatuses();

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      skills: defaultSkills,
      links: defaultLinks,
      statuses: defaultStatuses,
      uiPrefs: undefined as Record<string, unknown> | undefined,
    };
  }

  const obj = raw as Record<string, unknown>;
  const uiPrefs =
    obj._ui_preferences && typeof obj._ui_preferences === 'object' && !Array.isArray(obj._ui_preferences)
      ? (obj._ui_preferences as Record<string, unknown>)
      : undefined;

  if (obj._roadmap_version !== ROADMAP_VERSION) {
    return { skills: defaultSkills, links: defaultLinks, statuses: defaultStatuses, uiPrefs };
  }

  const skills: Record<string, boolean> = { ...defaultSkills };
  ROADMAP_SKILLS.forEach((s) => {
    if (typeof obj[s.id] === 'boolean') {
      skills[s.id] = obj[s.id] as boolean;
    }
  });

  const links: Record<string, string> = { ...defaultLinks };
  if (obj._project_links && typeof obj._project_links === 'object' && !Array.isArray(obj._project_links)) {
    const rawLinks = obj._project_links as Record<string, unknown>;
    PORTFOLIO_PROJECTS.forEach((p) => {
      if (typeof rawLinks[p.id] === 'string') {
        links[p.id] = rawLinks[p.id] as string;
      }
    });
  }

  const statuses: Record<string, ProjectStatus> = { ...defaultStatuses };
  if (obj._project_statuses && typeof obj._project_statuses === 'object' && !Array.isArray(obj._project_statuses)) {
    const rawStatuses = obj._project_statuses as Record<string, unknown>;
    PORTFOLIO_PROJECTS.forEach((p) => {
      const val = rawStatuses[p.id];
      if (val === 'production' || val === 'in_progress' || val === 'planned') {
        statuses[p.id] = val;
      }
    });
  }

  return { skills, links, statuses, uiPrefs };
};

const readInitialLocalState = () => {
  try {
    const saved = localStorage.getItem(ROADMAP_STORAGE_KEY);
    if (saved) {
      return parseStoredPayload(JSON.parse(saved));
    }
  } catch {
    // ignore storage errors
  }
  return parseStoredPayload(null);
};

export const RoadmapPortfolioView: React.FC = () => {
  const { user } = useAuth();
  const isOwner = user?.email?.toLowerCase().trim() === 'peturganchev93@gmail.com';
  const userId = user?.id;

  const [initialState] = useState(readInitialLocalState);
  const [skillProgress, setSkillProgress] = useState<Record<string, boolean>>(initialState.skills);
  const [projectLinks, setProjectLinks] = useState<Record<string, string>>(initialState.links);
  const [projectStatuses, setProjectStatuses] = useState<Record<string, ProjectStatus>>(initialState.statuses);
  const [uiPrefs, setUiPrefs] = useState<Record<string, unknown> | undefined>(initialState.uiPrefs);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [openCourses, setOpenCourses] = useState<number | null>(1);

  useEffect(() => {
    if (!userId || !isOwner) return;
    supabase
      .from('user_settings')
      .select('roadmap_progress')
      .eq('user_id', userId)
      .limit(1)
      .then(({ data, error }) => {
        if (error || !data || !data[0]?.roadmap_progress) return;
        const parsed = parseStoredPayload(data[0].roadmap_progress);
        if (parsed.uiPrefs) {
          setUiPrefs(parsed.uiPrefs);
        }
        const remoteObj = data[0].roadmap_progress as Record<string, unknown>;
        if (remoteObj._roadmap_version === ROADMAP_VERSION) {
          setSkillProgress(parsed.skills);
          setProjectLinks(parsed.links);
          setProjectStatuses(parsed.statuses);
          try {
            localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(remoteObj));
          } catch {
            // ignore
          }
        }
      });
  }, [userId, isOwner]);

  const buildPayload = (
    nextSkills: Record<string, boolean>,
    nextLinks: Record<string, string>,
    nextStatuses: Record<string, ProjectStatus>
  ): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      ...nextSkills,
      _roadmap_version: ROADMAP_VERSION,
      _project_links: nextLinks,
      _project_statuses: nextStatuses,
    };
    if (uiPrefs) {
      payload._ui_preferences = uiPrefs;
    }
    return payload;
  };

  const toggleSkill = (id: string) => {
    setSkillProgress((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(buildPayload(updated, projectLinks, projectStatuses)));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleLinkChange = (projectId: string, url: string) => {
    setProjectLinks((prev) => {
      const updated = { ...prev, [projectId]: url };
      try {
        localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(buildPayload(skillProgress, updated, projectStatuses)));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleStatusChange = (projectId: string, nextStatus: ProjectStatus) => {
    setProjectStatuses((prev) => {
      const updated = { ...prev, [projectId]: nextStatus };
      try {
        localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(buildPayload(skillProgress, projectLinks, updated)));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    const payload = buildPayload(skillProgress, projectLinks, projectStatuses);
    try {
      localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(payload));
      if (userId) {
        const { error } = await supabase.from('user_settings').upsert(
          {
            user_id: userId,
            roadmap_progress: payload,
          },
          { onConflict: 'user_id' }
        );
        if (error) throw error;
        setSaveMsg('Прогресът и линковете бяха успешно запазени в Supabase профила!');
      } else {
        setSaveMsg('Прогресът е запазен локално в браузъра!');
      }
    } catch (e: unknown) {
      setSaveMsg(e instanceof Error ? e.message : 'Грешка при запис.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const completedCount = ROADMAP_SKILLS.filter((s) => Boolean(skillProgress[s.id])).length;
  const totalCount = ROADMAP_SKILLS.length;
  const progressRatio = Math.round((completedCount / totalCount) * 100);

  if (!isOwner) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4 animate-in fade-in duration-200">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Award className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Персонализиран Skill Roadmap &amp; Портфолио</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Този профил няма конфигуриран персонален roadmap за умения. В бъдеща версия тук ще се генерира интерактивен план, съобразен с желаните от вас роли и пазарни изисквания.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">
      <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Skill Roadmap &amp; AI Portfolio
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Пътна карта за специализация: Engineering and Evaluating Autonomous AI Agents &amp; GitHub портфолио
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-on-accent font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition self-start sm:self-auto"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>Запази Прогреса</span>
        </button>
      </div>

      {saveMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveMsg}</span>
        </div>
      )}

      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/40 border border-emerald-500/30 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h4 className="text-sm font-bold text-emerald-300">
            💡 Ключово Инженерно Предимство (Unfair Advantage)
          </h4>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          За разлика от кандидатите, идващи от стандартен уеб девелъпмънт, инженерното образование по <b>Роботика и Мехатроника (ТУ-Варна)</b> и <b>8+ години програмиране на комплексна логика в Dynata</b> дават стабилен фундамент. Теорията на автоматичното управление, крайните автомати (<b>Finite State Machines</b>) и обратните връзки (<b>Feedback Loops</b>) са <u>ТОЧНО фундамента</u>, върху който стъпват съвременните агентни графи и многостъпкови цикли (<b>Reflection, Planning, Tool Execution</b>)!
        </p>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-teal-400" />
              <span>Напредък по 3-те Нива на Специализация</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Синхронизиран с твоя DeepLearning.AI Learning Path + Prompt Engineering
            </p>
          </div>
          <div className="text-xs font-mono px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 self-start sm:self-auto">
            {completedCount} от {totalCount} модула ({progressRatio}%)
          </div>
        </div>

        <div className="space-y-2">
          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-400 rounded-full transition-all duration-500"
              style={{ width: `${progressRatio}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 flex justify-between font-mono">
            <span>0% Основи</span>
            <span>50% Агентно Ядро</span>
            <span>100% Production &amp; Evals</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Ниво 1: Foundation
              </h4>
            </div>
            <div className="space-y-2">
              {ROADMAP_SKILLS.filter((s) => s.level === 1).map((s) => (
                <label
                  key={s.id}
                  className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 select-none group"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(skillProgress[s.id])}
                    onChange={() => toggleSkill(s.id)}
                    className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <span className={`transition ${skillProgress[s.id] ? 'text-white font-medium' : 'text-slate-400'}`}>
                    {s.title}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Ниво 2: Core Track
              </h4>
            </div>
            <div className="space-y-2">
              {ROADMAP_SKILLS.filter((s) => s.level === 2).map((s) => (
                <label
                  key={s.id}
                  className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 select-none group"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(skillProgress[s.id])}
                    onChange={() => toggleSkill(s.id)}
                    className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <span className={`transition ${skillProgress[s.id] ? 'text-white font-medium' : 'text-slate-400'}`}>
                    {s.title}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Ниво 3: Specialization
              </h4>
            </div>
            <div className="space-y-2">
              {ROADMAP_SKILLS.filter((s) => s.level === 3).map((s) => (
                <label
                  key={s.id}
                  className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 select-none group"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(skillProgress[s.id])}
                    onChange={() => toggleSkill(s.id)}
                    className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <span className={`transition ${skillProgress[s.id] ? 'text-white font-medium' : 'text-slate-400'}`}>
                    {s.title}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Личен Учебен Път (DeepLearning.AI — 11 Курса)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Engineering and Evaluating Autonomous AI Agents + Prompt Engineering &amp; Explore More
              </p>
            </div>
          </div>
          <a
            href="https://learningpath.deeplearning.ai/share/f5cebde71b3d05be9027b53afd8e3f44"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline font-medium shrink-0"
          >
            <span>Отвори Learning Path</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="space-y-3 pt-2">
          {DEEPLEARNING_COURSES.map((group) => {
            const isOpen = openCourses === group.level;
            return (
              <div
                key={group.level}
                className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenCourses(isOpen ? null : group.level)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-900/50 transition"
                >
                  <span className="text-xs font-bold text-slate-200">{group.title}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-2 border-t border-slate-800/80 pt-3">
                    {group.courses.map((c) => (
                      <div
                        key={c.name}
                        className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                      >
                        <span className="font-medium text-slate-200">{c.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-slate-400">{c.meta}</span>
                          <span className="text-[11px] text-teal-400/90 font-mono">{c.by}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <FolderGit2 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">
              GitHub Portfolio: Architecting AI Agents
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            5 примерни проекта, съпоставени към твоя учебен път — добави своя GitHub URL и статус, след което натисни „Запази Прогреса“
          </p>
        </div>

        <div className="space-y-4">
          {PORTFOLIO_PROJECTS.map((proj) => {
            const currentLink = projectLinks[proj.id] || '';
            const currentStatus = projectStatuses[proj.id] || proj.defaultStatus;
            const statusInfo = STATUS_META[currentStatus];
            const hasValidUrl = isSafeHttpUrl(currentLink);

            return (
              <div
                key={proj.id}
                className="p-5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h4 className="text-sm font-bold text-white">{proj.name}</h4>
                    <select
                      aria-label={`Статус на ${proj.name}`}
                      value={currentStatus}
                      onChange={(e) => handleStatusChange(proj.id, e.target.value as ProjectStatus)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono border bg-slate-950 cursor-pointer focus:outline-none ${statusInfo.badgeClass}`}
                    >
                      <option value="production">В ПРОИЗВОДСТВО</option>
                      <option value="in_progress">В РАЗРАБОТКА</option>
                      <option value="planned">ПЛАНИРАН (Roadmap)</option>
                    </select>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Ниво: {proj.level}</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{proj.desc}</p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {proj.stack.map((tech) => (
                    <span
                      key={tech}
                      className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-2.5 text-xs">
                  <div className="text-slate-400 italic">
                    💡 Доказва: {proj.proof}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <Link2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="url"
                        value={currentLink}
                        onChange={(e) => handleLinkChange(proj.id, e.target.value)}
                        placeholder="https://github.com/peturganchev/..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60"
                      />
                    </div>
                    {hasValidUrl ? (
                      <a
                        href={currentLink.trim()}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 font-semibold text-xs shrink-0 transition"
                      >
                        <span>Виж в GitHub</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 text-xs shrink-0">
                        Няма добавен линк
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
