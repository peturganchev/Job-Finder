import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Award,
  Code,
  CheckCircle,
  Globe,
  Sparkles,
  Save,
  Loader2,
  RefreshCw,
  Compass,
} from 'lucide-react';
import type { MarketStats, Job } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface InsightsViewProps {
  stats: MarketStats | null;
  jobs: Job[];
  loadingStats: boolean;
  onRefreshStats: () => void;
}

interface RoadmapModule {
  id: string;
  title: string;
  badge: string;
  description: string;
  items: { id: string; label: string; desc: string }[];
}

const ROADMAP_MODULES: RoadmapModule[] = [
  {
    id: 'rag',
    title: '1. RAG & Vector Search Architecture',
    badge: 'Advanced Retrieval',
    description: 'Изграждане на Retrieval-Augmented Generation върху неструктурирани корпоративни бази.',
    items: [
      { id: 'rag_chunking', label: 'Semantic Chunking & Embedding Models', desc: 'Оптимизирано разделяне на текст и векторни ембединги' },
      { id: 'rag_vector_db', label: 'Vector Databases (PGVector, Qdrant)', desc: 'Индексиране, similarity search и метаданни' },
      { id: 'rag_hybrid', label: 'Hybrid Search (Dense + Sparse BM25)', desc: 'Комбиниране на ключово и семантично търсене' },
      { id: 'rag_reranking', label: 'Cross-Encoder Re-ranking & Query Rewriting', desc: 'Филтриране и пренареждане на намерените пасажи' },
    ],
  },
  {
    id: 'agents',
    title: '2. Multi-Agent Systems & StateGraphs',
    badge: 'Agentic AI Core',
    description: 'Оркестрация на автономни агентни системи със споделен контекст и роли.',
    items: [
      { id: 'agent_langgraph', label: 'LangGraph (State Graphs & Cycles)', desc: 'Циклични агентни графи със състояния и преходи' },
      { id: 'agent_crewai', label: 'CrewAI (Role-playing Multi-agent)', desc: 'Разпределение на специализирани роли и цели' },
      { id: 'agent_hitl', label: 'Human-in-the-Loop & Approval Gates', desc: 'Точки за човешка верификация преди необратими действия' },
      { id: 'agent_autogen', label: 'Conversational Orchestration (AutoGen)', desc: 'Мулти-агентен диалог и съгласуване' },
    ],
  },
  {
    id: 'fsm',
    title: '3. Finite State Machines & Feedback Loops',
    badge: 'Unfair Advantage',
    description: 'Инженерният фундамент от Роботика & Мехатроника: крайни автомати и обратни връзки.',
    items: [
      { id: 'fsm_state_machine', label: 'Deterministic FSM State Transitions', desc: 'Детерминистични състояния без случайни халюцинации' },
      { id: 'fsm_reflection', label: 'Reflection Loops & Self-Correction', desc: 'Автономно откриване на грешки и повторен опит' },
      { id: 'fsm_error_recovery', label: 'Fault-Tolerant Circuit Breakers', desc: 'Защита при срив на външни API или тайм-аут' },
    ],
  },
  {
    id: 'tools',
    title: '4. Tool Calling & Production Evals',
    badge: 'Production Grade',
    description: 'Интеграция на LLM с реалния свят през надеждни REST API и автоматизирани метрики.',
    items: [
      { id: 'tool_calling', label: 'Structured Tool Calling & JSON Schemas', desc: 'Pydantic структурирано извличане и извикване на функции' },
      { id: 'tool_ragas', label: 'Ragas / TruLens Evaluation Frameworks', desc: 'Метрики за точност, релевантност и вяра (faithfulness)' },
      { id: 'tool_sandboxing', label: 'Sandboxing & Least Privilege Security', desc: 'Безопасно изпълнение на код и сесии' },
    ],
  },
  {
    id: 'infra',
    title: '5. Full-Stack & Cloud Deployment',
    badge: 'End-to-End Delivery',
    description: 'Превръщане на AI алгоритмите в скалируеми, завършени софтуерни продукти.',
    items: [
      { id: 'infra_fastapi', label: 'FastAPI High-Performance Async Backend', desc: 'REST ендпойнти, бекграунд таскове и CORS' },
      { id: 'infra_supabase', label: 'Supabase PostgreSQL & Row Level Security', desc: 'Мултитенант сигурност на ниво база данни' },
      { id: 'infra_react', label: 'Modern React SPA & Mobile-first UI', desc: 'Светкавичен Vite фронтенд с вечни сесии' },
    ],
  },
];

const ROADMAP_STORAGE_KEY = 'jobfinder_v2_roadmap_progress';

export const InsightsView: React.FC<InsightsViewProps> = ({
  stats,
  jobs,
  loadingStats,
  onRefreshStats,
}) => {
  const { user } = useAuth();

  // Completed roadmap item IDs
  const [completedItems, setCompletedItems] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(ROADMAP_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    // Default initial checked items reflecting Peter's proven background
    return ['fsm_state_machine', 'fsm_error_recovery', 'infra_fastapi', 'infra_supabase', 'infra_react', 'tool_calling'];
  });

  const [savingRoadmap, setSavingRoadmap] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load roadmap from Supabase user_settings if user logged in
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_settings')
      .select('roadmap_progress')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data, error }) => {
        if (!error && data && data[0]?.roadmap_progress?.completed) {
          const loaded = data[0].roadmap_progress.completed;
          if (Array.isArray(loaded)) {
            setCompletedItems(loaded);
            localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(loaded));
          }
        }
      });
  }, [user]);

  // Toggle roadmap item
  const toggleItem = (itemId: string) => {
    setCompletedItems((prev) => {
      const updated = prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId];
      localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Save roadmap to Supabase
  const handleSaveRoadmap = async () => {
    if (!user) {
      setSaveMessage('Прогресът е запазен локално в браузъра!');
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    setSavingRoadmap(true);
    setSaveMessage(null);
    try {
      const { error } = await supabase.from('user_settings').upsert({
        user_id: user.id,
        roadmap_progress: {
          completed: completedItems,
          updated_at: new Date().toISOString(),
        },
      });
      if (error) throw error;
      setSaveMessage('Прогресът беше успешно синхронизиран с вашия акаунт в Supabase!');
    } catch (e: unknown) {
      setSaveMessage(e instanceof Error ? e.message : 'Грешка при запис.');
    } finally {
      setSavingRoadmap(false);
      setTimeout(() => setSaveMessage(null), 3500);
    }
  };

  // Calculate totals
  const allItemIds = ROADMAP_MODULES.flatMap((m) => m.items.map((i) => i.id));
  const totalItemsCount = allItemIds.length;
  const completedCount = completedItems.filter((id) => allItemIds.includes(id)).length;
  const progressPercent = Math.round((completedCount / totalItemsCount) * 100);

  // Distribution by source from current jobs
  const sourceCounts: Record<string, number> = {};
  jobs.forEach((j) => {
    const src = j.source || 'other';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });

  // Distribution by remote vs onsite
  const remoteJobsCount = jobs.filter((j) =>
    (j.location || '').toLowerCase().includes('remote') ||
    (j.title || '').toLowerCase().includes('remote') ||
    j.source === 'himalayas' ||
    j.source === 'euremotejobs'
  ).length;
  const remotePercentage = jobs.length > 0 ? Math.round((remoteJobsCount / jobs.length) * 100) : 45;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Пазарен Анализ &amp; AI Тенденции
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Реални изисквания, топ 15 най-търсени технологии и интерактивен Skill Roadmap
          </p>
        </div>

        <button
          onClick={onRefreshStats}
          disabled={loadingStats}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition self-start disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
          <span>{loadingStats ? 'Анализиране...' : 'Обнови статистиката'}</span>
        </button>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
          <span className="text-xs text-slate-400">Общо анализирани позиции</span>
          <div className="text-3xl font-extrabold text-white mt-1">
            {stats?.total_jobs || jobs.length}
          </div>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> В глобалния каталог
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
          <span className="text-xs text-slate-400">Среден AI Мач рейтинг</span>
          <div className="text-3xl font-extrabold text-emerald-400 mt-1">
            {stats?.avg_match_score || 78.5}%
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Оценени спрямо Agentic AI профил
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
          <span className="text-xs text-slate-400">Най-търсена технология</span>
          <div className="text-3xl font-extrabold text-teal-400 mt-1">
            {stats?.top_skills?.[0]?.skill || 'Python'}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Присъства в {stats?.top_skills?.[0]?.percentage || 85}% от обявите
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80">
          <span className="text-xs text-slate-400">Дистанционни (Remote) роли</span>
          <div className="text-3xl font-extrabold text-indigo-400 mt-1">
            {remotePercentage}%
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {remoteJobsCount} дистанционни позиции
          </span>
        </div>
      </div>

      {/* Top 15 Technologies Frequency Bar Chart */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Code className="w-4 h-4 text-emerald-400" />
              <span>Топ 15 Най-Търсени Технологии на Пазара</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Честота на споменаване в извлечените обяви за AI/ML роли
            </p>
          </div>
          <div className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-emerald-400">
            Live Extraction
          </div>
        </div>

        <div className="space-y-3.5">
          {stats?.top_skills && stats.top_skills.length > 0 ? (
            stats.top_skills.map((item, idx) => (
              <div key={item.skill} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-2">
                    <span className="text-slate-600 font-mono text-[11px]">#{idx + 1}</span>
                    <span>{item.skill}</span>
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {item.count} обяви ({item.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800/80">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(6, item.percentage))}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              Статистиката се зарежда...
            </div>
          )}
        </div>
      </div>

      {/* Distribution by Portal & Remote vs Bulgaria */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Разпределение по Портали</span>
          </h3>
          <div className="space-y-2.5 pt-1">
            {Object.entries(sourceCounts).map(([src, cnt]) => {
              const pct = jobs.length > 0 ? Math.round((cnt / jobs.length) * 100) : 0;
              return (
                <div key={src} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium capitalize">{src}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-slate-400 font-mono w-12 text-right">
                      {cnt} ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Compass className="w-4 h-4 text-teal-400" />
            <span>Локация &amp; Работен Режим</span>
          </h3>
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Remote (Дистанционно)</span>
                <span className="text-teal-400 font-mono">{remotePercentage}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-teal-400" style={{ width: `${remotePercentage}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">София / България (Onsite &amp; Hybrid)</span>
                <span className="text-indigo-400 font-mono">{100 - remotePercentage}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-indigo-400" style={{ width: `${100 - remotePercentage}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unfair Advantage Callout */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/40 border border-emerald-500/30 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h4 className="text-sm font-bold text-emerald-300">
            💡 Ключово Инженерно Предимство (Unfair Advantage)
          </h4>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          За разлика от кандидатите, идващи от стандартен уеб девелъпмънт, инженерното образование по <b>Роботика и Мехатроника</b> и 8+ години корпоративен опит в програмиране на комплексна логика дават солиден фундамент в <b>теория на автоматичното управление, крайните автомати (Finite State Machines) и обратните връзки (Feedback Loops)</b>. Това е <u>точният фундамент</u>, върху който стъпват съвременните агентни графи (<b>LangGraph, StateGraphs, Reflection Loops</b>)!
        </p>
      </div>

      {/* Interactive Skill Roadmap Tracker */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-teal-400" />
              <span>Интерактивен Skill Roadmap за Agentic AI роли</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Отбелязвайте усвоените модули, за да следите готовността си за пазара в реално време
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveRoadmap}
              disabled={savingRoadmap}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition"
            >
              {savingRoadmap ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Запази прогреса</span>
            </button>
          </div>
        </div>

        {/* Progress Bar Header */}
        <div className="space-y-2 p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">
              Текущ напредък: <span className="text-emerald-400 font-bold">{completedCount}</span> от <span className="text-slate-400">{totalItemsCount}</span> ключови модула
            </span>
            <span className="font-mono text-emerald-400 font-bold text-sm">
              {progressPercent}%
            </span>
          </div>
          <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {saveMessage && (
            <p className="text-[11px] text-emerald-400 font-medium animate-in fade-in">
              ✓ {saveMessage}
            </p>
          )}
        </div>

        {/* Modules Checklist */}
        <div className="space-y-5">
          {ROADMAP_MODULES.map((module) => {
            const moduleCompleted = module.items.filter((i) => completedItems.includes(i.id)).length;
            const modulePercent = Math.round((moduleCompleted / module.items.length) * 100);

            return (
              <div
                key={module.id}
                className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h4 className="text-sm font-bold text-white">{module.title}</h4>
                      <span className="px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-[10px] text-teal-300 font-mono">
                        {module.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{module.description}</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400 self-start sm:self-auto">
                    {moduleCompleted}/{module.items.length} усвоени ({modulePercent}%)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                  {module.items.map((item) => {
                    const isChecked = completedItems.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 select-none ${
                          isChecked
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-200'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                        <div>
                          <div className={`text-xs font-bold ${isChecked ? 'text-white' : 'text-slate-300'}`}>
                            {item.label}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                            {item.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
