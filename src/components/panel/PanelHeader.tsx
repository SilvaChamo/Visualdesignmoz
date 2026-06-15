'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';
import { panelBtnSecondary, panelField } from '@/lib/panel-ui';
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
    <div className="flex items-center gap-2">
      <div className="relative w-full min-w-[12rem] max-w-[20rem] sm:min-w-[18rem] sm:w-[20rem]">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder={search.placeholder ?? 'Pesquisar…'}
          className={`${panelField} w-full pl-8 pr-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100`}
        />
      </div>
      {search.countLabel ? (
        <span className="hidden whitespace-nowrap text-sm text-zinc-500 sm:inline dark:text-zinc-400">
          {search.countLabel}
        </span>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <header
        className={cn(
          /* 76px = altura da div do logo na sidebar (pt-4 + pb-4 + conteúdo) */
          'box-border flex h-[76px] shrink-0 items-center border-b px-5 lg:px-6',
          'border-zinc-200/80 bg-white/80 backdrop-blur-md',
          'dark:border-zinc-800 dark:bg-zinc-950/80',
        )}
      >
        <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex flex-col justify-center">
            {back ? (
              <button
                type="button"
                onClick={back.onClick}
                className="mb-0.5 inline-flex items-center text-xs font-medium text-zinc-500 transition-colors hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
              >
                ← {back.label}
              </button>
            ) : null}
            <h1 className="truncate text-2xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
              {title}
            </h1>
            {description ? (
              <p className="truncate text-sm leading-tight text-zinc-500 dark:text-zinc-400">{description}</p>
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
