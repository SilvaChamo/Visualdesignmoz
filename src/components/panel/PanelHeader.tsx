'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';
import type { SectionChromeBack, SectionChromeSearch } from '@/components/admin/AdminSectionChrome';

type PanelHeaderProps = {
  title: string;
  description?: string;
  back?: SectionChromeBack;
  search?: SectionChromeSearch;
  hidden?: boolean;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  alerts?: React.ReactNode;
};

export function PanelHeader({
  title,
  description,
  back,
  search,
  hidden,
  children,
  actions,
  toolbar,
  alerts,
}: PanelHeaderProps) {
  if (hidden) return null;

  const searchSlot = search ? (
    <div className="relative w-full max-w-xs sm:w-56">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
      <input
        value={search.value}
        onChange={(e) => search.onChange(e.target.value)}
        placeholder={search.placeholder ?? 'Pesquisar…'}
        className="h-[30px] w-full rounded-md border border-zinc-200 bg-white py-0 pl-8 pr-3 text-xs text-zinc-900 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
    </div>
  ) : null;

  return (
    <>
      <header
        className={cn(
          'shrink-0 border-b px-5 py-3.5 lg:px-6',
          'border-zinc-200/80 bg-white/80 backdrop-blur-md',
          'dark:border-zinc-800 dark:bg-zinc-950/80',
        )}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            {back ? (
              <button
                type="button"
                onClick={back.onClick}
                className="mb-1 inline-flex items-center text-xs font-medium text-zinc-500 transition-colors hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
              >
                ← {back.label}
              </button>
            ) : null}
            <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {title}
            </h1>
            {description ? (
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {searchSlot}
            {toolbar}
            {children}
            {actions}
            <ThemeToggle size="sm" />
          </div>
        </div>
      </header>

      {alerts ? (
        <div className="shrink-0 space-y-2 border-b border-zinc-200/80 bg-zinc-50/90 px-5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50 lg:px-6">
          {alerts}
        </div>
      ) : null}
    </>
  );
}
