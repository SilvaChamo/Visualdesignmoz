'use client';

import type { ReactNode } from 'react';
import { panelField } from '@/lib/panel-ui';

/** Largura da coluna de rótulos — utilizadores e hospedagem (DA forms). */
const DA_LABEL_COL = 'w-56';

export function DaFormRow({
  label,
  children,
  showUnlimited = true,
}: {
  label: string;
  children: ReactNode;
  showUnlimited?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0 dark:border-zinc-800">
      <span className={`${DA_LABEL_COL} shrink-0 whitespace-nowrap text-sm text-gray-800 dark:text-zinc-200`}>{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {!showUnlimited ? null : <span className="w-28 shrink-0" aria-hidden />}
    </div>
  );
}

export function DaLimitRow({
  label,
  row,
  onChange,
  withUnit,
}: {
  label: string;
  row: { value: string; unlimited: boolean };
  onChange: (next: { value: string; unlimited: boolean }) => void;
  withUnit?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0 dark:border-zinc-800">
      <span className={`${DA_LABEL_COL} shrink-0 whitespace-nowrap text-sm text-gray-800 dark:text-zinc-200`}>{label}</span>
      <div className="flex min-w-0 flex-1 items-stretch">
        {withUnit && (
          <span className="inline-flex w-14 shrink-0 items-center justify-center rounded-l border border-r-0 border-gray-300 bg-gray-50 text-xs font-medium text-gray-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            MG
          </span>
        )}
        <input
          type="text"
          value={row.value}
          disabled={row.unlimited}
          onChange={(e) => onChange({ ...row, value: e.target.value })}
          className={`${panelField} min-w-0 flex-1 disabled:opacity-50 ${withUnit ? 'rounded-none' : 'rounded-l'}`}
        />
        <label className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-r border border-gray-300 bg-white px-3 text-xs text-gray-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={row.unlimited}
            onChange={(e) => onChange({ ...row, unlimited: e.target.checked })}
          />
          Ilimitado
        </label>
      </div>
    </div>
  );
}

export function DaCheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-3 dark:border-zinc-800">
      <span className={`${DA_LABEL_COL} shrink-0 whitespace-nowrap text-sm text-gray-800 dark:text-zinc-200`}>{label}</span>
      <div className="flex min-w-0 flex-1 justify-end">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      </div>
    </div>
  );
}

export function DaPolicyRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <DaFormRow label={label} showUnlimited={false}>
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm text-gray-800 dark:text-zinc-200">{children}</div>
    </DaFormRow>
  );
}

export function DaSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-1 mt-6 border-t border-gray-100 pt-4 text-sm font-bold text-gray-900 dark:border-zinc-800 dark:text-zinc-100">
      {children}
    </h3>
  );
}
