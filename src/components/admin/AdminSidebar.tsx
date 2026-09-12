'use client';

import React from 'react';
import {
  Home, LogOut, ChevronRight, Archive, Users, Server, Mail, Globe, Bell, Layout, Settings, FileText, AppWindow, Calculator, FolderOpen, HardDrive,
} from 'lucide-react';
import { SidebarAccount } from '@/components/panel/SidebarAccount';
import { SidebarMenuFlyout } from '@/components/panel/SidebarMenuFlyout';

function WordPressMenuIcon({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className || ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Globe size={size} strokeWidth={1.75} className="absolute inset-0" />
      <span
        className="relative font-black leading-none text-current"
        style={{ fontSize: Math.max(8, Math.round(size * 0.42)) }}
      >
        W
      </span>
    </span>
  );
}
import {
  ADMIN_MENU_ITEM_DEFS,
  adminMenuParentForSection,
  activeSubGroupForSection,
  findFirstNavigableSubItem,
  isMenuHeaderSubItem,
  isPanelMenuItemActive,
  resolveSectionId,
  type PanelMenuItemDef,
  type PanelMenuSubItem,
} from '@/lib/panel-admin-menu';
import { panelShellHeaderHeight } from '@/lib/panel-ui';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  sessionUser: string | null;
  isMobile?: boolean;
  menuDefs?: PanelMenuItemDef[];
}

interface MenuItem extends PanelMenuItemDef {
  icon: React.ElementType;
}

const MENU_ICONS: Record<string, React.ElementType> = {
  dashboard: Home,
  utilizadores: Users,
  'nov-hospedagem': Server,
  'nov-email': Mail,
  'nov-dominios': Globe,
  'nov-notificacoes': Bell,
  cotacoes: FileText,
  contabilidade: Calculator,
  newsletter: Layout,
  'nov-wordpress': AppWindow,
  'file-manager': FolderOpen,
  'backup-manager': HardDrive,
  'nov-sistema': Settings,
};

const menuItems: MenuItem[] = ADMIN_MENU_ITEM_DEFS.map((item) => ({
  ...item,
  icon: MENU_ICONS[item.id] || Archive,
}));

function buildMenuItems(defs: PanelMenuItemDef[]): MenuItem[] {
  return defs.map((item) => ({
    ...item,
    icon: MENU_ICONS[item.id] || Archive,
  }));
}

function subItemsContainActiveSection(subItems: PanelMenuSubItem[], activeSection: string): boolean {
  const resolved = resolveSectionId(activeSection);
  return subItems.some((s) => {
    if (resolveSectionId(s.id) === resolved || s.id === activeSection) return true;
    if (s.subItems?.length) return subItemsContainActiveSection(s.subItems, activeSection);
    return false;
  });
}

/** O flyout (mobile + colapsado) não suporta grupos aninhados — achata um nível de subItems. */
function flattenSubItemsForFlyout(
  subItems: PanelMenuSubItem[],
): { id: string; label: string; isHeader: boolean }[] {
  const out: { id: string; label: string; isHeader: boolean }[] = [];
  for (const sub of subItems) {
    if (sub.subItems?.length) {
      out.push({ id: `${sub.id}-header`, label: `— ${sub.label} —`, isHeader: true });
      out.push(...flattenSubItemsForFlyout(sub.subItems));
      continue;
    }
    out.push({ id: sub.id, label: sub.label, isHeader: isMenuHeaderSubItem(sub.id) });
  }
  return out;
}

/**
 * Se um admin entrar em "impersonar revendedor" e sair da página sem clicar em
 * "Voltar ao painel" (ex.: navegou directamente para /dashboard), o cookie
 * vd_impersonate_reseller fica preso — e passa a filtrar silenciosamente TODOS
 * os pedidos do admin (emails, sites, etc.) para os do revendedor impersonado.
 * Este aviso aparece em qualquer página do admin enquanto isso acontecer.
 */
function ImpersonationExitBanner({ isCollapsed }: { isCollapsed: boolean }) {
  const [daUsername, setDaUsername] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/impersonate')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.active) setDaUsername(data.daUsername || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!daUsername) return null;

  const handleExit = async () => {
    const { clearAllPanelClientCaches } = await import('@/lib/panel-session-cache-clear');
    clearAllPanelClientCaches();
    await fetch('/api/admin/impersonate', { method: 'DELETE' }).catch(() => {});
    window.location.reload();
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={handleExit}
        title={`A impersonar ${daUsername} — clique para sair`}
        className="mx-auto mb-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
      >
        <LogOut size={14} className="-scale-x-100" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleExit}
      title="Sair da impersonação"
      className="mb-2 flex w-full shrink-0 flex-col gap-0.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-left transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:hover:bg-red-950/50"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-red-500">A impersonar</span>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-red-700 dark:text-red-300">{daUsername}</span>
        <span className="shrink-0 text-xs font-bold text-red-600 underline">Sair</span>
      </span>
    </button>
  );
}

/** Altura fixa — cada linha do menu principal (não cresce nem encolhe com o conteúdo). */
const MENU_ROW_CLASS = 'box-border h-11 min-h-11 max-h-11 shrink-0';
/** Submenu: texto maior, mas linhas mais apertadas entre si. */
const SUB_ROW_CLASS = 'box-border h-8 min-h-8 max-h-8 shrink-0 leading-none';
const SUB_MENU_TRACK_CLASS = 'relative w-[3px] shrink-0 self-stretch';
const SUB_MENU_TRACK_LINE =
  'pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-200 dark:bg-zinc-800';
const SUB_MENU_ACTIVE_MARK =
  'pointer-events-none absolute left-1/2 top-1/2 z-10 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600';

export function AdminSidebar({
  activeSection,
  onNavigate,
  isCollapsed,
  setIsCollapsed,
  sessionUser,
  isMobile = false,
  menuDefs,
}: AdminSidebarProps) {
  const items = menuDefs ? buildMenuItems(menuDefs) : menuItems;
  const currentSidebarWidth = isCollapsed ? 64 : 242;
  const [expandedMenu, setExpandedMenu] = React.useState<string | null>(() =>
    adminMenuParentForSection(activeSection),
  );
  const [expandedSubGroup, setExpandedSubGroup] = React.useState<string | null>(() => {
    const parent = adminMenuParentForSection(activeSection);
    const parentItem = items.find((i) => i.id === parent);
    return parentItem?.subItems ? activeSubGroupForSection(parentItem.subItems, activeSection) : null;
  });

  React.useEffect(() => {
    const parent = adminMenuParentForSection(activeSection);
    if (parent) setExpandedMenu(parent);
    const parentItem = items.find((i) => i.id === parent);
    const subGroup = parentItem?.subItems ? activeSubGroupForSection(parentItem.subItems, activeSection) : null;
    if (subGroup) setExpandedSubGroup(subGroup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    const fetchUnread = () => {
      fetch('/api/notifications/admin?category=system&limit=1')
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data?.success) setUnreadNotifications(data.stats?.unread || 0);
        })
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    // Actualiza logo que uma notificação é marcada como lida no painel
    // "Notificações > Servidor", em vez de esperar até 30s pelo próximo poll.
    window.addEventListener('notifications:server-updated', fetchUnread);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('notifications:server-updated', fetchUnread);
    };
  }, []);

  // Pagamentos manuais (M-Pesa/Transferência) pendentes de confirmação — evita
  // que fiquem esquecidos na Contabilidade à espera de a equipa reparar sozinha.
  // Soma créditos + renovações + itens de compras (domínio/hospedagem/e-mail).
  const [pendingPagamentos, setPendingPagamentos] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    const fetchPending = () => {
      fetch('/api/admin/contabilidade-pendentes')
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data?.success) setPendingPagamentos(data.stats?.pendentes || 0);
        })
        .catch(() => {});
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Encomendas (quotation_requests) com comprovativo/pagamento à espera de
  // confirmação — mesmo objectivo do balão da Contabilidade, para esta área.
  const [pendingEncomendas, setPendingEncomendas] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    const fetchPending = () => {
      fetch('/api/admin/cotacoes/pending-count')
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data?.success) setPendingEncomendas(data.stats?.pendentes || 0);
        })
        .catch(() => {});
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleParentClick = (item: MenuItem) => {
    if (!item.subItems?.length) {
      setExpandedMenu(null);
      onNavigate(item.id);
      return;
    }

    if (expandedMenu === item.id) {
      setExpandedMenu(null);
      return;
    }

    setExpandedMenu(item.id);
    if (item.id === 'nov-dominios') {
      onNavigate('domain-manager');
      return;
    }
    if (item.id === 'nov-hospedagem') {
      onNavigate('hospedagem-contas');
      return;
    }
    if (item.id === 'nov-wordpress') {
      onNavigate('wp-sites');
      return;
    }
    const firstNavigable = findFirstNavigableSubItem(item.subItems);
    if (firstNavigable) onNavigate(resolveSectionId(firstNavigable.id));
  };

  const handleSubGroupClick = (sub: PanelMenuSubItem) => {
    setExpandedSubGroup((prev) => (prev === sub.id ? null : sub.id));
    const firstNavigable = sub.subItems?.length ? findFirstNavigableSubItem(sub.subItems) : null;
    if (firstNavigable) onNavigate(resolveSectionId(firstNavigable.id));
  };

  const handleSubClick = (subId: string) => {
    onNavigate(resolveSectionId(subId));
  };

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
              alt="Logo"
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
              alt="Logo"
              className="h-11 w-11 object-contain cursor-pointer"
              onClick={() => { window.location.href = '/'; }}
            />
            <div className="flex-1 min-w-0">
              <h1 className="truncate text-lg font-bold text-gray-900 dark:text-zinc-100">Painel Admin</h1>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Portal Digital</p>
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
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = isPanelMenuItemActive(item, activeSection);
            const isOpen = expandedMenu === item.id && !!item.subItems?.length;

            return (
              <React.Fragment key={item.id}>
                <div>
                  {(() => {
                    const parentButton = (
                      <button
                        type="button"
                        onClick={() => {
                          if (isCollapsed && isMobile && item.subItems?.length) return;
                          handleParentClick(item);
                        }}
                        className={`group relative flex w-full items-center overflow-hidden ${MENU_ROW_CLASS} transition-all duration-200 ease-out hover:translate-x-1 ${
                          isCollapsed ? 'justify-center px-2' : 'px-2.5'
                        } rounded-lg ${
                          isActive
                            ? 'text-red-600 font-bold'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-red-400'
                        }`}
                        title={isCollapsed ? item.label : ''}
                      >
                        <Icon
                          size={20}
                          className={`shrink-0 ${
                            isActive
                              ? 'text-red-600'
                              : 'text-gray-500 group-hover:text-red-600'
                          }`}
                        />
                        {!isCollapsed && <span className="ml-3 truncate text-base leading-none">{item.label}</span>}
                        {item.id === 'nov-notificacoes' && unreadNotifications > 0 && (
                          <span
                            className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ${
                              isCollapsed ? 'absolute right-1 top-1' : 'ml-auto'
                            }`}
                          >
                            {unreadNotifications > 99 ? '99+' : unreadNotifications}
                          </span>
                        )}
                        {item.id === 'contabilidade' && pendingPagamentos > 0 && (
                          <span
                            className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ${
                              isCollapsed ? 'absolute right-1 top-1' : 'ml-auto'
                            }`}
                          >
                            {pendingPagamentos > 99 ? '99+' : pendingPagamentos}
                          </span>
                        )}
                        {item.id === 'cotacoes' && pendingEncomendas > 0 && (
                          <span
                            className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ${
                              isCollapsed ? 'absolute right-1 top-1' : 'ml-auto'
                            }`}
                          >
                            {pendingEncomendas > 99 ? '99+' : pendingEncomendas}
                          </span>
                        )}
                        {!isCollapsed && item.subItems && (
                          <ChevronRight size={14} className={`ml-auto text-gray-400 transition-transform group-hover:text-red-600 ${isOpen ? 'rotate-90' : ''}`} />
                        )}
                      </button>
                    );

                    if (isCollapsed && isMobile && item.subItems?.length) {
                      return (
                        <SidebarMenuFlyout
                          label={item.label}
                          subItems={flattenSubItemsForFlyout(item.subItems)}
                          activeSection={activeSection}
                          resolveSectionId={resolveSectionId}
                          onSubNavigate={handleSubClick}
                        >
                          {parentButton}
                        </SidebarMenuFlyout>
                      );
                    }

                    return parentButton;
                  })()}

                  {!isCollapsed && item.subItems && isOpen && (
                    <div className="ml-9 flex max-h-[55vh] flex-col overflow-y-auto">
                      {item.subItems.map((sub) => {
                        if (isMenuHeaderSubItem(sub.id)) {
                          return (
                            <div key={sub.id} className="flex items-stretch">
                              <div className={SUB_MENU_TRACK_CLASS} aria-hidden>
                                <div className={SUB_MENU_TRACK_LINE} />
                              </div>
                              <div className="px-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                {sub.label.replace(/^—\s*|\s*—$/g, '')}
                              </div>
                            </div>
                          );
                        }

                        if (sub.subItems?.length) {
                          const isGroupOpen = expandedSubGroup === sub.id;
                          const isGroupActive = subItemsContainActiveSection(sub.subItems, activeSection);
                          return (
                            <div key={sub.id}>
                              <div className={`flex items-stretch ${SUB_ROW_CLASS}`}>
                                <div className={SUB_MENU_TRACK_CLASS} aria-hidden>
                                  <div className={SUB_MENU_TRACK_LINE} />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSubGroupClick(sub)}
                                  className={`flex min-w-0 flex-1 items-center rounded px-3 text-left text-[15px] transition-colors duration-200 focus:outline-none ${
                                    isGroupActive
                                      ? 'font-bold text-red-600'
                                      : 'text-gray-600 hover:bg-gray-100 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-red-400'
                                  }`}
                                >
                                  {sub.id === 'wordpress-group' && (
                                    <WordPressMenuIcon size={16} className="mr-2 shrink-0" />
                                  )}
                                  <span className="truncate">{sub.label}</span>
                                  <ChevronRight
                                    size={13}
                                    className={`ml-auto shrink-0 transition-transform ${isGroupOpen ? 'rotate-90' : ''}`}
                                  />
                                </button>
                              </div>
                              {isGroupOpen && (
                                <div className="ml-6 flex flex-col">
                                  {sub.subItems.map((child) => {
                                    const resolved = resolveSectionId(child.id);
                                    const isChildActive = resolveSectionId(activeSection) === resolved;
                                    return (
                                      <div key={child.id} className={`flex items-stretch ${SUB_ROW_CLASS}`}>
                                        <div className={SUB_MENU_TRACK_CLASS} aria-hidden>
                                          <div className={SUB_MENU_TRACK_LINE} />
                                          {isChildActive && <span className={SUB_MENU_ACTIVE_MARK} />}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleSubClick(child.id)}
                                          className={`flex min-w-0 flex-1 items-center rounded px-3 text-left text-sm transition-colors duration-200 focus:outline-none ${
                                            isChildActive
                                              ? 'font-bold text-red-600'
                                              : 'text-gray-600 hover:bg-gray-100 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-red-400'
                                          }`}
                                        >
                                          {child.label}
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        }

                        const resolved = resolveSectionId(sub.id);
                        const isSubActive = resolveSectionId(activeSection) === resolved;
                        return (
                          <div key={sub.id} className={`flex items-stretch ${SUB_ROW_CLASS}`}>
                            <div className={SUB_MENU_TRACK_CLASS} aria-hidden>
                              <div className={SUB_MENU_TRACK_LINE} />
                              {isSubActive && <span className={SUB_MENU_ACTIVE_MARK} />}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSubClick(sub.id)}
                              className={`flex min-w-0 flex-1 items-center rounded px-3 text-left text-[15px] transition-colors duration-200 focus:outline-none ${
                                isSubActive
                                  ? 'font-bold text-red-600'
                                  : 'text-gray-600 hover:bg-gray-100 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-red-400'
                              }`}
                            >
                              {sub.label}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <ImpersonationExitBanner isCollapsed={isCollapsed} />
        <SidebarAccount email={sessionUser} isCollapsed={isCollapsed} />
      </div>
    </div>
  );
}
