import { useState, useEffect } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'gomoku_theme_mode';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  const isDark =
    mode === 'dark' || (mode === 'system' && getSystemTheme() === 'dark');
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof localStorage === 'undefined') return 'system';
    return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'system';
  });

  // 应用主题 + 持久化
  useEffect(() => {
    applyTheme(mode);
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  // 监听系统主题变化
  useEffect(() => {
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mode]);

  const resolvedTheme = mode === 'system' ? getSystemTheme() : mode;

  return { mode, setMode, resolvedTheme };
}
