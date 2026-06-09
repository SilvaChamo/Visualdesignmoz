'use client';

interface SidebarAccountProps {
  email: string | null;
  isCollapsed: boolean;
  fallbackEmail?: string;
}

export function SidebarAccount({ email, isCollapsed, fallbackEmail = 'conta@visualdesignmoz.com' }: SidebarAccountProps) {
  const accountEmail = (email || '').trim() || fallbackEmail;
  const initial = accountEmail.includes('@')
    ? accountEmail.charAt(0).toUpperCase()
    : accountEmail.charAt(0).toUpperCase() || 'U';

  return (
    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white">
        {initial}
      </div>
      {!isCollapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-zinc-900 dark:text-zinc-100" title={accountEmail}>
            {accountEmail}
          </p>
        </div>
      )}
    </div>
  );
}
