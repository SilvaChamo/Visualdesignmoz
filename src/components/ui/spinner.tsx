import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Ícone de "a processar" padrão do site — anel vermelho com arco cinza claro a rodar.
 * Tamanho fixo (w-7 h-7, anel de 3px) em todo o site — uniforme por omissão, não
 * configurável por tamanho/espessura via `className` (só cores/espaçamento passam).
 * Excepção: dentro de um <button>, uma regra em globals.css (`.panel-spinner`) reduz
 * automaticamente o tamanho — não precisa de ser passado aqui.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'panel-spinner inline-block shrink-0 animate-spin rounded-full border-red-600 border-t-gray-200 dark:border-red-500 dark:border-t-gray-600',
        className,
        'w-6 h-6 border-2',
      )}
      role="status"
      aria-label="A processar"
    />
  );
}

/** Spinner pequeno para a barra lateral — cabe ao lado do rótulo do menu. */
export function MenuSpinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'panel-spinner inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-red-600 border-t-gray-200 dark:border-red-500 dark:border-t-gray-600',
        className,
      )}
      role="status"
      aria-label="A processar"
    />
  );
}

export function LoadingHint({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 py-8 text-sm text-gray-400 dark:text-zinc-500',
        className,
      )}
    >
      <Spinner />
      {children ? <span>{children}</span> : null}
    </div>
  );
}
