import React from 'react';
import { ExternalLink, BookOpen, Shield, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-slate-950/70 backdrop-blur-md py-8 px-6 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left Column: Brand & Tagline */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <a
              href="https://www.archevyn.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-bold tracking-tight text-slate-200 hover:text-emerald-400 transition-colors"
            >
              Archevyn.
            </a>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs font-mono text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Job-Finder v2
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
            Autonomous market intelligence & career analytics engine designed to extract real-world tech requirements, analyze skill gaps, and filter job postings with LLMs.
          </p>
        </div>

        {/* Right Column: Links from archevyn.dev/projects/job-finder */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <a
            href="https://www.archevyn.dev/projects/job-finder"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span>Case Study & Overview</span>
          </a>

          <a
            href="https://www.archevyn.dev/blog/autonomous-market-intelligence-engine-ai-agents-job-search"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-teal-400" />
            <span>Deep Dive Article</span>
          </a>

          <a
            href="https://github.com/peturganchev/Job-Finder"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
          >
            <svg className="w-3.5 h-3.5 fill-current text-slate-400" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>Source Code</span>
          </a>

          <a
            href="https://www.archevyn.dev/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy</span>
          </a>
        </div>
      </div>

      {/* Bottom Sub-footer */}
      <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-slate-900/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
        <span>© 2026 Archevyn • Order. Stability. Execution.</span>
        <span>Closed-loop Agentic AI Framework & Execution Engine</span>
      </div>
    </footer>
  );
};
