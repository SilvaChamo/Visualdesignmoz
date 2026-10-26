'use client';

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  theme: ThemeMode;
  /** true quando a pessoa não escolheu (segue o tema do aparelho) */
  system: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  /** esquece a escolha e passa a seguir o tema do aparelho */
  followSystem: () => void;
};

const STORAGE_KEY = 'vd-theme';
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readCookieTheme(): ThemeMode | null {
  try {
    const match = document.cookie.match(/(?:^|; )vd-theme=(light|dark)(?:;|$)/);
    return match ? (match[1] as ThemeMode) : null;
  } catch {
    return null;
  }
}

function readStoredTheme(): ThemeMode | null {
  // O cookie é a fonte de verdade partilhada entre site e painel — só cai
  // para localStorage se ainda não houver cookie (ex: antes desta correcção).
  const fromCookie = readCookieTheme();
  if (fromCookie) return fromCookie;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  return null;
}

/** Única função que aplica o tema em todo o documento */
export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

function resolveTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = readStoredTheme();
  if (stored) return stored;
  if (document.documentElement.classList.contains('dark')) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function systemTheme(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function clearStoredTheme() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax${secure}`;
  } catch {
    /* ignore */
  }
}

function persistTheme(theme: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${STORAGE_KEY}=${theme}; path=/; max-age=31536000; SameSite=Lax${secure}`;
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [system, setSystem] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const initial = resolveTheme();
    setThemeState(initial);
    setSystem(!readStoredTheme());
    applyTheme(initial);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue === 'light' || event.newValue === 'dark') {
        setSystem(false);
        setThemeState(event.newValue);
        applyTheme(event.newValue);
      } else if (!event.newValue) {
        // Se a storage for limpa, volta ao tema do sistema
        const sysTheme = systemTheme();
        setSystem(true);
        setThemeState(sysTheme);
        applyTheme(sysTheme);
      }
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemThemeChange = (e: MediaQueryListEvent) => {
      if (!readStoredTheme()) {
        const sysTheme = e.matches ? 'dark' : 'light';
        setThemeState(sysTheme);
        applyTheme(sysTheme);
      }
    };

    window.addEventListener('storage', onStorage);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', onSystemThemeChange);
    } else {
      mediaQuery.addListener(onSystemThemeChange); // Fallback para browsers antigos
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', onSystemThemeChange);
      } else {
        mediaQuery.removeListener(onSystemThemeChange);
      }
    };
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setSystem(false);
    setThemeState(next);
    persistTheme(next);
    applyTheme(next);
  }, []);

  const followSystem = useCallback(() => {
    clearStoredTheme();
    const sys = systemTheme();
    setSystem(true);
    setThemeState(sys);
    applyTheme(sys);
  }, []);

  const toggleTheme = useCallback(() => {
    setSystem(false);
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      persistTheme(next);
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, system, setTheme, toggleTheme, followSystem }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
