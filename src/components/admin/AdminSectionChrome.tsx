'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type SectionChromeSearch = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  countLabel?: string;
};

export type SectionChromeBack = {
  label: string;
  onClick: () => void;
};

export type SectionChromeState = {
  title?: string;
  description?: string;
  back?: SectionChromeBack;
  search?: SectionChromeSearch;
  toolbar?: ReactNode;
  alerts?: ReactNode;
} | null;

type ChromeContextValue = {
  chrome: SectionChromeState;
  setChrome: (chrome: SectionChromeState) => void;
};

const AdminSectionChromeContext = createContext<ChromeContextValue>({
  chrome: null,
  setChrome: () => {},
});

export function AdminSectionChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<SectionChromeState>(null);
  const setChrome = useCallback((next: SectionChromeState) => {
    setChromeState((prev) => {
      if (prev === next) return prev;
      if (prev === null && next === null) return prev;
      return next;
    });
  }, []);
  const value = useMemo(() => ({ chrome, setChrome }), [chrome, setChrome]);
  return (
    <AdminSectionChromeContext.Provider value={value}>
      {children}
    </AdminSectionChromeContext.Provider>
  );
}

export function useAdminSectionChrome() {
  return useContext(AdminSectionChromeContext);
}
