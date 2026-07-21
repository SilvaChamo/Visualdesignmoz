'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = 'vd-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Domínio do cookie partilhado — mesmo padrão usado para a sessão de login
 *  (visualdesignmoz.com + painel.visualdesignmoz.com partilham o cookie). */
function getSharedCookieDomain(): string | undefined {
  try {
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')) {
      return undefined;
    }
    if (host.endsWith('visualdesignmoz.com')) return '.visualdesignmoz.com';
    return undefined;
  } catch {
    return undefined;
  }
}

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

function persistTheme(theme: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  try {
    const domain = getSharedCookieDomain();
    const domainPart = domain ? `; domain=${domain}` : '';
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${STORAGE_KEY}=${theme}; path=/; max-age=31536000; SameSite=Lax${domainPart}${secure}`;
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');

  useEffect(() => {
    const initial = resolveTheme();
    setThemeState(initial);
    applyTheme(initial);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue === 'light' || event.newValue === 'dark') {
        setThemeState(event.newValue);
        applyTheme(event.newValue);
      } else if (!event.newValue) {
        // Se a storage for limpa, volta ao tema do sistema
        const sysTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
    setThemeState(next);
    persistTheme(next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      persistTheme(next);
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
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
