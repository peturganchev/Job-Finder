import React from 'react';
import {
  Briefcase,
  Search,
  User,
  TrendingUp,
  Settings,
} from 'lucide-react';

interface MobileNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  jobsCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  onSelectTab,
  jobsCount,
}) => {
  const tabs = [
    { id: 'jobs', label: 'Обяви', icon: Briefcase, badge: jobsCount },
    { id: 'search', label: 'Търсене', icon: Search },
    { id: 'profile', label: 'CV Профил', icon: User },
    { id: 'insights', label: 'Анализ', icon: TrendingUp },
    { id: 'settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-slate-950/90 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 safe-area-pb">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
                isActive
                  ? 'text-emerald-400 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -top-1 -right-2 bg-emerald-500 text-slate-950 text-[9px] font-extrabold px-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight leading-none">
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-emerald-400 mt-1" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
