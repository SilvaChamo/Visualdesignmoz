'use client';

import type { ReactNode } from 'react';

type PanelIconTipProps = {
  label: string;
  children: ReactNode;
  /** Por baixo do botão (padrão painel) ou ao lado (acções em linha). */
  placement?: 'bottom' | 'top' | 'left' | 'right';
};

/** Tooltip instantâneo — fundo escuro, sem delay do atributo title nativo. */
export function PanelIconTip({ label, children, placement = 'bottom' }: PanelIconTipProps) {
  const positionClass =
    placement === 'bottom'
      ? 'top-[calc(100%+4px)] left-1/2 -translate-x-1/2'
      : placement === 'top'
        ? 'bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2'
        : placement === 'left'
          ? 'right-[calc(100%+6px)] top-1/2 -translate-y-1/2'
          : 'left-[calc(100%+6px)] top-1/2 -translate-y-1/2';

  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium text-white opacity-0 group-hover/tip:opacity-100 ${positionClass} bg-zinc-900 dark:bg-zinc-950`}
        style={{ transition: 'none' }}
      >
        {label}
      </span>
    </span>
  );
}
