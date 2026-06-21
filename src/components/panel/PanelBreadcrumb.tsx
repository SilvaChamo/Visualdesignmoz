'use client';

import { ChevronRight } from 'lucide-react';
import type { PanelBreadcrumbItem } from '@/lib/panel-breadcrumb';

type PanelBreadcrumbProps = {
  items: PanelBreadcrumbItem[];
  onNavigate: (sectionId: string) => void;
  className?: string;
};

export function PanelBreadcrumb({ items, onNavigate, className }: PanelBreadcrumbProps) {
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Caminho de navegação"
      className={className ?? 'mb-0.5 flex flex-wrap items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400'}
    >
      {items.map((item, index) => (
        <span key={`${item.sectionId}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? <ChevronRight size={12} className="shrink-0 opacity-60" /> : null}
          {item.isCurrent ? (
            <span className="font-medium text-zinc-700 dark:text-zinc-200">{item.label}</span>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate(item.sectionId)}
              className="font-medium transition-colors hover:text-red-600 dark:hover:text-red-400"
            >
              {item.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}
