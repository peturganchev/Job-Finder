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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ROADMAP_SKILLS = [
  // Ниво 1: Foundation (Основи)
  { id: 'sk_p1', level: 1, title: 'Prompt Eng & Context Strategy', default: true },
  { id: 'sk_p2', level: 1, title: 'AI Python & Pydantic Validation', default: true },
  { id: 'sk_p3', level: 1, title: 'Building Systems with LLM APIs', default: true },
  { id: 'sk_p4', level: 1, title: 'LangChain Chaining & Chat with Data', default: true },

  // Ниво 2: Core Track (Агентно Ядро)
  { id: 'sk_p5', level: 2, title: '4-те Модела на Andrew Ng (Reflection, Tools, Plan, Multi-Agent)', default: true },
  { id: 'sk_p6', level: 2, title: 'Function & Tool Calling в код', default: true },
  { id: 'sk_p7', level: 2, title: 'Multi-Agent екипи с CrewAI', default: false },
  { id: 'sk_p8', level: 2, title: 'Event-Driven & Human-in-the-Loop Flows', default: false },

  // Ниво 3: Role Specialization (Agentic Systems)
  { id: 'sk_p9', level: 3, title: 'Model Context Protocol (MCP) Сървъри', default: true },
  { id: 'sk_p10', level: 3, title: 'LangGraph StateGraphs & Дългосрочна Памет', default: false },
  { id: 'sk_p11', level: 3, title: 'Eval Harness (Оценка на точност & токени)', default: false },
  { id: 'sk_p12', level: 3, title: 'Advanced RAG & Unstructured Data Prep', default: false },
];

const DEEPLEARNING_COURSES = [
  {
    level: 1,
    title: 'Ниво 1: Foundation (Основи & AI-First Разработка)',
    courses: [
      { name: 'ChatGPT Prompt Engineering for Developers', by: 'DeepLearning.AI & OpenAI' },
      { name: 'Building Systems with the ChatGPT API', by: 'DeepLearning.AI & OpenAI' },
      { name: 'LangChain for LLM Application Development', by: 'Harrison Chase & Andrew Ng' },
      { name: 'LangChain: Chat with Your Data', by: 'Harrison Chase (LangChain)' },
    ],
  },
  {
    level: 2,
    title: 'Ниво 2: Core Track (Агентни Архитектури & Tool Calling)',
    courses: [
      { name: 'Functions, Tools and Agents with LangChain', by: 'Harrison Chase (LangChain)' },
      { name: 'Multi AI Agent Systems with crewAI', by: 'João Moura (crewAI)' },
      { name: 'AI Agents in LangGraph', by: 'Tawhid Abdul-Jalil (LangChain)' },
      { name: 'Building Your Own Custom Agent with Tools', by: 'DeepLearning.AI' },
    ],
  },
  {
    level: 3,
    title: 'Ниво 3: Role Specialization (Agentic Systems Engineering)',
    courses: [
      { name: 'Advanced Retrieval for AI with Chroma', by: 'Chroma & Anton Troynikov' },
      { name: 'Building Agentic RAG with LlamaIndex', by: 'Jerry Liu (LlamaIndex)' },
      { name: 'Evaluating and Debugging Generative AI Models', by: 'Weights & Biases' },
      { name: 'Automated Multi-Agent Collaboration with AutoGen', by: 'Microsoft & Chi Wang' },
    ],
  },
];

const PORTFOLIO_PROJECTS = [
  {
    id: 1,
    name: '1. 🤖 Job-Finder & Market Intelligence Agent',
    status: 'В ПРОИЗВОДСТВО (Active v2.0)',
    statusColor: 'emerald',
    level: 'Intermediate',
    desc: 'Автономна агентна система, която обхожда dev.bg, jobs.bg и LinkedIn, дедуплицира обяви в Supabase PostgreSQL, анализира съответствието с Gemini AI и генерира персонализирани мотивационни писма.',
    stack: ['FastAPI', 'Playwright', 'Google Gemini API', 'Supabase (PostgreSQL + RLS)', 'React 18', 'Tailwind CSS'],
    repo: 'https://github.com/peturganchev/Job-Finder',
    proof: 'End-to-end продуктова разработка, устойчивост при скрапване и пълна интеграция на LLM.',
  },
  {
    id: 2,
    name: '2. 🧠 Personal Context & Knowledge Server (MCP Server)',
    status: 'В ПРОИЗВОДСТВО (Active v1.0)',
    statusColor: 'emerald',
    level: 'Foundational to Intermediate',
    desc: 'Персонализиран сървър по стандарта Model Context Protocol (MCP) на Anthropic. Сигурно излага локални файлове, бази данни и REST API-та като ресурси и инструменти към AI среди (Claude Desktop, Cursor IDE, Custom Agents).',
    stack: ['Python', 'Anthropic MCP SDK', 'FastAPI / AsyncIO', 'JSON Schema', 'Pydantic'],
    repo: 'https://github.com/peturganchev/personal-mcp-server',
    proof: 'Познаване на актуалния индустриален стандарт за свързване на контекст към AI модели.',
  },
  {
    id: 3,
    name: '3. 🧪 Tool-Calling Agent с Eval Harness (Eval-Driven Development)',
    status: 'ПЛАНИРАН (Roadmap)',
    statusColor: 'blue',
    level: 'Intermediate',
    desc: 'Автономен агент за специфична бизнес задача с достъп до външни инструменти и цялостна тестова рамка (eval harness). Автоматично засича халюцинации, мери грешки при избор на инструменти (Tool Calling Accuracy) и оптимизира латентност и разход на токени.',
    stack: ['Python', 'Google Gemini SDK / OpenAI', 'Pydantic', 'pytest', 'Ragas / Evals Framework'],
    repo: 'https://github.com/peturganchev/tool-calling-eval-agent',
    proof: 'Инженерен подход (Eval-Driven Development), липса на халюцинации и контрол върху разходите.',
  },
  {
    id: 4,
    name: '4. 👥 Multi-Agent Research Assistant (LangGraph & Reflection Pattern)',
    status: 'ПЛАНИРАН (Roadmap)',
    statusColor: 'blue',
    level: 'Intermediate to Advanced',
    desc: 'Мултиагентна система, съставена от 3 специализирани агента (Researcher, Analyst, Fact-Checker/Editor). Приема тема, извършва автономно уеб търсене, синтезира информацията и чрез итеративна рефлексия (Reflection Loop) генерира валидиран Markdown доклад.',
    stack: ['LangGraph', 'CrewAI', 'Tavily Search API', 'Pydantic', 'Python'],
    repo: 'https://github.com/peturganchev/multi-agent-researcher',
    proof: 'Оркестрация на споделено състояние (State Management), крайни автомати и контрол върху автономността.',
  },
  {
    id: 5,
    name: '5. 📊 Production Observability Dashboard за AI Агенти',
    status: 'ПЛАНИРАН (Roadmap)',
    statusColor: 'blue',
    level: 'Advanced',
    desc: 'Централизирана система за мониторинг в реално време на агентни сесии. Прихваща индивидуални стъпки (spans) и цялостни пътища на изпълнение (traces), логва неуспешни извиквания на инструменти, следи латентността и консумацията на токени.',
    stack: ['Langfuse / Phoenix (Arize) / LangSmith', 'OpenTelemetry', 'Python', 'Streamlit / Grafana'],
    repo: 'https://github.com/peturganchev/agent-observability-hub',
    proof: 'Enterprise готовност (Production Readiness), мониторинг и зрялост при експлоатация на агентски системи.',
  },
];

const ROADMAP_STORAGE_KEY = 'jobfinder_v2_main_roadmap';

export const RoadmapPortfolioView: React.FC = () => {
  const { user } = useAuth();
  const isOwner = !user || user.email?.toLowerCase().trim() === 'peturganchev93@gmail.com';

  // Roadmap progress state: key-value map e.g. { sk_p1: true, ... }
  const [skillProgress, setSkillProgress] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(ROADMAP_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    const initial: Record<string, boolean> = {};
    ROADMAP_SKILLS.forEach((s) => {
      initial[s.id] = s.default;
    });
    return initial;
  });

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [openCourses, setOpenCourses] = useState<number | null>(null);

  // Load from Supabase user_settings
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_settings')
      .select('roadmap_progress')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data, error }) => {
        if (!error && data && data[0]?.roadmap_progress) {
          const remote = data[0].roadmap_progress;
          if (typeof remote === 'object' && !Array.isArray(remote)) {
            setSkillProgress((prev) => ({ ...prev, ...remote }));
            localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify({ ...skillProgress, ...remote }));
          }
        }
      });
  }, [user]);

  const toggleSkill = (id: string) => {
    setSkillProgress((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      if (user) {
        const { error } = await supabase.from('user_settings').upsert({
          user_id: user.id,
          roadmap_progress: skillProgress,
        });
        if (error) throw error;
        setSaveMsg('Прогресът беше успешно запазен в Supabase профила!');
      } else {
        localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(skillProgress));
        setSaveMsg('Прогресът е запазен локално в браузъра!');
      }
    } catch (e: unknown) {
      setSaveMsg(e instanceof Error ? e.message : 'Грешка при запис.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const completedCount = Object.values(skillProgress).filter(Boolean).length;
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
      {/* View Header */}
      <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Skill Roadmap &amp; AI Portfolio
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Пътна карта за специализация: Agentic Systems Developer &amp; GitHub портфолио
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition self-start sm:self-auto"
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

      {/* Unfair Advantage Callout */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/40 border border-emerald-500/30 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h4 className="text-sm font-bold text-emerald-300">
            💡 Ключово Инженерно Предимство (Unfair Advantage)
          </h4>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          За разлика от кандидатите, идващи от стандартен уеб девелъпмънт, инженерното образование по <b>Роботика и Мехатроника (ТУ-Варна)</b> и <b>8+ години програмиране на комплексна логика в Dynata</b> дават стабилен фундамент. Теорията на автоматичното управление, крайните автомати (<b>Finite State Machines</b>) и обратните връзки (<b>Feedback Loops</b>) са <u>ТОЧНО фундамента</u>, върху който стъпват съвременните агентни графи (<b>LangGraph, StateGraphs, Reflection Loops</b>)!
        </p>
      </div>

      {/* 3-Tier Specialization Roadmap */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-teal-400" />
              <span>Напредък по 3-те Нива на Специализация</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Базиран на съвпаденията между DeepLearning.AI и програмата за Agentic AI роли
            </p>
          </div>
          <div className="text-xs font-mono px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 self-start sm:self-auto">
            {completedCount} от {totalCount} модула ({progressRatio}%)
          </div>
        </div>

        {/* Dynamic Progress Bar */}
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
            <span>100% Full Specialization</span>
          </p>
        </div>

        {/* 3 Columns Grid for Levels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Level 1 */}
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

          {/* Level 2 */}
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

          {/* Level 3 */}
          <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Ниво 3: Role Specialization
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

      {/* DeepLearning.AI Recommended Courses Catalog */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-base font-bold text-white">Каталог с Препоръчани Курсове (DeepLearning.AI)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Препоръчителен курс на подготовка за покриване на всички практически изисквания
            </p>
          </div>
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
                        className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/60 flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-slate-200">{c.name}</span>
                        <span className="text-[11px] text-teal-400/90 font-mono">{c.by}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5 GitHub Portfolio Projects */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <FolderGit2 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">
              GitHub Portfolio: Architecting AI Agents
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Практическо портфолио от 5 специализирани проекта за роли в сферата на Agentic AI &amp; AI Systems
          </p>
        </div>

        <div className="space-y-4">
          {PORTFOLIO_PROJECTS.map((proj) => (
            <div
              key={proj.id}
              className="p-5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h4 className="text-sm font-bold text-white">{proj.name}</h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                      proj.statusColor === 'emerald'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                    }`}
                  >
                    {proj.status}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-mono">Ниво: {proj.level}</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{proj.desc}</p>

              {/* Stack badges */}
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

              {/* Proof statement & Link */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-slate-400 italic">
                  💡 Доказва: {proj.proof}
                </span>

                <a
                  href={proj.repo}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-400 hover:underline font-semibold text-xs shrink-0"
                >
                  <span>Виж в GitHub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
