'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';
import { panelField, panelShellHeaderHeightLg } from '@/lib/panel-ui';
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

  const hasToolbarRow = Boolean(search || toolbar || children || actions);

  const searchInput = search ? (
    <div className="relative w-full min-w-0">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
      <input
        value={search.value}
        onChange={(e) => search.onChange(e.target.value)}
        placeholder={search.placeholder ?? 'Pesquisar…'}
        className={`${panelField} w-full pl-8 pr-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100`}
      />
    </div>
  ) : null;

  const actionButtons = (
    <>
      {toolbar}
      {children}
      {actions}
      <ThemeToggle size="sm" />
    </>
  );

  return (
    <>
      <header
        className={cn(
          'box-border shrink-0 border-b px-4 py-3 lg:px-6',
          panelShellHeaderHeightLg,
          'lg:flex lg:items-center lg:py-0',
          'border-zinc-200/80 bg-white/80 backdrop-blur-md',
          'dark:border-zinc-800 dark:bg-zinc-950/80',
        )}
      >
        <div className="flex w-full flex-col gap-3 lg:h-full lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="min-w-0 lg:shrink-0">
            {back ? (
              <button
                type="button"
                onClick={back.onClick}
                className="mb-0.5 inline-flex items-center text-xs font-medium text-zinc-500 transition-colors hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
              >
                ← {back.label}
              </button>
            ) : null}
            <h1 className="truncate text-xl font-bold leading-tight tracking-tight text-zinc-900 md:text-2xl dark:text-zinc-50">
              {title}
            </h1>
            {description ? (
              <p className="truncate text-sm leading-tight text-zinc-500 dark:text-zinc-400">{description}</p>
            ) : null}
          </div>

          {hasToolbarRow ? (
            <div className="flex w-full min-w-0 flex-col gap-2 lg:flex-row lg:flex-1 lg:items-center lg:justify-end lg:gap-3">
              {search ? (
                <div className="flex w-full min-w-0 items-center gap-2 lg:max-w-md lg:flex-1">
                  {searchInput}
                  {search.countLabel ? (
                    <span className="hidden shrink-0 whitespace-nowrap text-sm text-zinc-500 sm:inline dark:text-zinc-400">
                      {search.countLabel}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0 lg:justify-end">
                {actionButtons}
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {alerts ? (
        <div className="shrink-0 space-y-2 border-b border-zinc-200/80 bg-zinc-50/90 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50 lg:px-6">
          {alerts}
        </div>
      ) : null}
    </>
  );
}
