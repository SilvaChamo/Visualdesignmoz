'use client';

import { FileText, MessageSquare, Wallet, User, ChevronRight, LogOut, Globe } from 'lucide-react';
import { SidebarAccount } from '@/components/panel/SidebarAccount';
import { panelShellHeaderHeight } from '@/lib/panel-ui';
import { cn } from '@/lib/utils';

// Layouts deixou de ser secção própria — layouts e anexos vivem dentro da
// conversa em "Mensagens" (QuotationMessagesThread mostra tudo inline).
export type EncomendasSection = 'encomendas' | 'mensagens' | 'pagamentos' | 'perfil';

const ITEMS: { id: EncomendasSection; label: string; icon: React.ElementType }[] = [
  { id: 'encomendas', label: 'Encomendas', icon: FileText },
  { id: 'mensagens', label: 'Mensagens', icon: MessageSquare },
  { id: 'pagamentos', label: 'Pagamentos', icon: Wallet },
  { id: 'perfil', label: 'O Meu Perfil', icon: User },
];

interface EncomendasSidebarProps {
  activeSection: EncomendasSection;
  onNavigate: (section: EncomendasSection) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  sessionUser: string | null;
  unreadCounts?: Partial<Record<EncomendasSection, number>>;
}

export function EncomendasSidebar({
  activeSection,
  onNavigate,
  isCollapsed,
  setIsCollapsed,
  sessionUser,
  unreadCounts,
}: EncomendasSidebarProps) {
  const currentSidebarWidth = isCollapsed ? 64 : 242;

  return (
    <div
      className="font-panel relative z-50 flex h-screen shrink-0 flex-col overflow-visible border-r border-zinc-200 bg-white transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-950"
      style={{ width: `${currentSidebarWidth}px` }}
    >
      <div
        className={cn(
          'shrink-0 border-b border-zinc-200 px-2 dark:border-zinc-800',
          isCollapsed ? 'py-4' : cn(panelShellHeaderHeight, 'flex items-center'),
        )}
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src="/assets/simbolo.png"
              alt="VisualDesign"
              className="h-11 w-11 cursor-pointer object-contain"
              onClick={() => { window.location.href = '/'; }}
            />
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-transparent dark:hover:text-red-400"
              title="Expandir"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <img
              src="/assets/simbolo.png"
              alt="VisualDesign"
              className="h-11 w-11 object-contain cursor-pointer"
              onClick={() => { window.location.href = '/'; }}
            />
            <div className="flex-1 min-w-0">
              <h1 className="truncate text-lg font-bold text-gray-900 dark:text-zinc-100">VisualDesign</h1>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Encomendas</p>
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-transparent dark:hover:text-red-400"
              title="Recolher"
            >
              <LogOut size={18} className="-scale-x-100" />
            </button>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-2">
        <div className="flex flex-col space-y-0">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const unread = unreadCounts?.[item.id] || 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`group flex w-full items-center overflow-hidden box-border h-11 min-h-11 max-h-11 shrink-0 transition-all duration-200 ease-out hover:translate-x-1 ${
                  isCollapsed ? 'justify-center px-2' : 'px-2.5'
                } rounded-lg ${
                  isActive
                    ? 'text-red-600 font-bold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-red-400'
                }`}
                title={isCollapsed ? item.label : ''}
              >
                <span className="relative shrink-0">
                  <Icon size={20} className={isActive ? 'text-red-600' : 'text-gray-500 group-hover:text-red-600'} />
                  {unread > 0 && isCollapsed && (
                    <span className="absolute -top-1.5 -right-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                {!isCollapsed && <span className="ml-3 truncate text-base leading-none">{item.label}</span>}
                {!isCollapsed && unread > 0 && (
                  <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quem só tem encomendas e quer domínio ou hospedagem compra no site: ao pagar, a conta passa a cliente e o
            login leva ao painel de hospedagem (Silva, 21/10/2026) */}
        <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
          <a
            href="/precos"
            className={`group flex w-full items-center overflow-hidden box-border h-11 min-h-11 max-h-11 shrink-0 transition-all duration-200 ease-out hover:translate-x-1 ${
              isCollapsed ? 'justify-center px-2' : 'px-2.5'
            } rounded-lg text-gray-600 hover:bg-gray-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-red-400`}
            title={isCollapsed ? 'Domínios e hospedagem' : ''}
          >
            <Globe size={20} className="shrink-0 text-gray-500 group-hover:text-red-600" />
            {!isCollapsed && <span className="ml-3 truncate text-base leading-none">Domínios e hospedagem</span>}
          </a>
        </div>
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <SidebarAccount email={sessionUser} isCollapsed={isCollapsed} />
      </div>
    </div>
  );
}
