'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { panelControlHeight } from '@/lib/panel-ui';

type ThemeToggleProps = {
  className?: string;
  size?: 'sm' | 'md';
};

export function ThemeToggle({ className, size = 'md' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const iconSize = size === 'sm' ? 15 : 17;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded border transition-colors',
        'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900',
        'dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-transparent dark:hover:text-red-400',
        size === 'sm' ? `${panelControlHeight} w-[38px]` : 'h-9 w-9',
        className,
      )}
      title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
      aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo escuro'}
    >
      {theme === 'dark' ? <Sun size={iconSize} /> : <Moon size={iconSize} />}
    </button>
  );
}
