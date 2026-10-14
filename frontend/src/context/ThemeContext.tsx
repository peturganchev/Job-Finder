import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiUpdateSettings } from '../lib/api';
import type { UITheme } from '../types';

const STORAGE_KEY = 'jf_theme';

interface ThemeContextType {
  theme: UITheme;
  /** Switches theme, persists locally and (when signed in) to the user's account */
  toggleTheme: () => void;
  /** Sets theme and persists it locally + to the account when signed in */
  setTheme: (theme: UITheme) => void;
  /** Applies the theme loaded from the account without writing it back */
  applyServerTheme: (theme: UITheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const readStoredTheme = (): UITheme => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [theme, setThemeState] = useState<UITheme>(readStoredTheme);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Reflect theme on <html> and in localStorage (survives refresh, also for guests)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add(`theme-${theme}`);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage errors (private mode etc.)
    }
  }, [theme]);

  const crossfade = () => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => root.classList.remove('theme-transition'), 300);
  };

  const persistToAccount = useCallback(
    (next: UITheme) => {
      if (!session?.access_token) return;
      apiUpdateSettings({ theme: next }, session.access_token).catch((err) =>
        console.warn('Неуспешен запис на темата в акаунта:', err)
      );
    },
    [session?.access_token]
  );

  const setTheme = useCallback(
    (next: UITheme) => {
      crossfade();
      setThemeState(next);
      persistToAccount(next);
    },
    [persistToAccount]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const applyServerTheme = useCallback((next: UITheme) => {
    if (next !== 'dark' && next !== 'light') return;
    setThemeState((prev) => {
      if (prev !== next) crossfade();
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, applyServerTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};
