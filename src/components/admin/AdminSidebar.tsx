'use client';

import React from 'react';
import {
  Home, LogOut, ChevronRight, Archive, Users, Server, Mail, Globe, Bell, Layout, Settings,
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
  LEGACY_ALIAS,
  adminMenuParentForSection,
  isPanelMenuItemActive,
  resolveSectionId,
  type PanelMenuItemDef,
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
  newsletter: Layout,
  'nov-wordpress': WordPressMenuIcon,
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

/** Altura fixa — cada linha do menu principal (não cresce nem encolhe com o conteúdo). */
const MENU_ROW_CLASS = 'box-border h-11 min-h-11 max-h-11 shrink-0';
/** Submenu: texto maior, mas linhas mais apertadas entre si. */
const SUB_ROW_CLASS = 'box-border h-8 min-h-8 max-h-8 shrink-0 leading-none';

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

  React.useEffect(() => {
    const parent = adminMenuParentForSection(activeSection);
    if (parent) setExpandedMenu(parent);
  }, [activeSection]);

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
    const firstNavigable = item.subItems.find((s) => !s.id.endsWith('-header'));
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
                        className={`group flex w-full items-center overflow-hidden ${MENU_ROW_CLASS} transition-all duration-200 ease-out hover:translate-x-1 ${
                          isCollapsed ? 'justify-center px-2' : 'px-2.5'
                        } rounded-lg ${
                          isActive
                            ? 'text-red-600 font-bold'
                            : 'text-gray-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400'
                        }`}
                        title={isCollapsed ? item.label : ''}
                      >
                        {item.id === 'nov-wordpress' ? (
                          <WordPressMenuIcon
                            size={20}
                            className={
                              isActive
                                ? 'text-red-600'
                                : 'text-gray-500 group-hover:text-red-600'
                            }
                          />
                        ) : (
                          <Icon
                            size={20}
                            className={`shrink-0 ${
                              isActive
                                ? 'text-red-600'
                                : 'text-gray-500 group-hover:text-red-600'
                            }`}
                          />
                        )}
                        {!isCollapsed && <span className="ml-3 truncate text-base leading-none">{item.label}</span>}
                        {!isCollapsed && item.subItems && (
                          <ChevronRight size={14} className={`ml-auto text-gray-400 transition-transform group-hover:text-red-600 ${isOpen ? 'rotate-90' : ''}`} />
                        )}
                      </button>
                    );

                    if (isCollapsed && isMobile && item.subItems?.length) {
                      return (
                        <SidebarMenuFlyout
                          label={item.label}
                          subItems={item.subItems.map((sub) => ({
                            id: sub.id,
                            label: sub.label,
                            isHeader: sub.id.endsWith('-header'),
                          }))}
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
                    <div className="ml-9 flex max-h-[55vh] flex-col overflow-y-auto border-l border-gray-200 dark:border-zinc-800">
                      {item.subItems.map((sub) => {
                        if (sub.id.endsWith('-header')) {
                          return (
                            <div key={sub.id} className="px-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              {sub.label.replace(/^—\s*|\s*—$/g, '')}
                            </div>
                          );
                        }
                        const resolved = resolveSectionId(sub.id);
                        const isSubActive = resolveSectionId(activeSection) === resolved;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => handleSubClick(sub.id)}
                            className={`relative flex items-center overflow-visible px-3 text-left text-[15px] transition-colors duration-200 focus:outline-none ${SUB_ROW_CLASS} ${
                              isSubActive
                                ? 'font-bold text-red-600 before:absolute before:-left-px before:top-1/2 before:z-20 before:h-3 before:w-1 before:-translate-x-px before:-translate-y-1/2 before:rounded-sm before:bg-red-600'
                                : 'text-gray-600 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400'
                            }`}
                          >
                            {sub.label}
                          </button>
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
        <SidebarAccount email={sessionUser} isCollapsed={isCollapsed} />
      </div>
    </div>
  );
}
