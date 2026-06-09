'use client';

import React from 'react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';

type PanelHeaderProps = {
  title: string;
  description?: string;
  hidden?: boolean;
  children?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PanelHeader({ title, description, hidden, children, actions }: PanelHeaderProps) {
  if (hidden) return null;

  return (
    <header
      className={cn(
        'shrink-0 border-b px-5 py-3.5 lg:px-6',
        'border-zinc-200/80 bg-white/80 backdrop-blur-md',
        'dark:border-zinc-800 dark:bg-zinc-950/80',
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {children}
          {actions}
          <ThemeToggle size="sm" />
        </div>
      </div>
    </header>
  );
}
