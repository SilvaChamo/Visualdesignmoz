'use client';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { authShellClass } from '@/components/auth/auth-styles';

type AuthPageShellProps = {
  children: React.ReactNode;
  /** Largura do cartão — por defeito 420px */
  wide?: boolean;
};

export function AuthPageShell({ children, wide }: AuthPageShellProps) {
  return (
    <div className={authShellClass}>
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-red-500/10 blur-3xl dark:bg-red-500/20" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-zinc-300/30 blur-3xl dark:bg-zinc-700/20" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">
        <a href="/" className="mb-3 block">
          <img
            src="/assets/logotype.png"
            alt="VisualDesign"
            className="h-[100px] w-auto object-contain dark:hidden"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <img
            src="/assets/logotipoII.png"
            alt="VisualDesign"
            className="hidden h-[100px] w-auto object-contain dark:block dark:brightness-110"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </a>

        <div className={wide ? 'w-full max-w-md' : 'w-full max-w-[420px]'}>
          {children}
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{ height: '3px', background: 'linear-gradient(90deg, #7f0000, #cc0000, #7f0000)' }}
      />
    </div>
  );
}

export function AuthLoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
    </div>
  );
}
