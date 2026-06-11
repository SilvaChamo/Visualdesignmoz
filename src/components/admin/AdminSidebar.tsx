'use client';

import React from 'react';
import {
  Home, LogOut, ChevronRight, Archive, Users, Server, Mail, Globe, Bell, Layout, Settings,
} from 'lucide-react';
import { SidebarAccount } from '@/components/panel/SidebarAccount';
import {
  ADMIN_MENU_ITEM_DEFS,
  LEGACY_ALIAS,
  adminMenuParentForSection,
  isPanelMenuItemActive,
  resolveSectionId,
  type PanelMenuItemDef,
} from '@/lib/panel-admin-menu';

interface AdminSidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  sessionUser: string | null;
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
  'nov-sistema': Settings,
  'menu-anterior': Archive,
};

const menuItems: MenuItem[] = ADMIN_MENU_ITEM_DEFS.map((item) => ({
  ...item,
  icon: MENU_ICONS[item.id] || Archive,
}));

export function AdminSidebar({
  activeSection,
  onNavigate,
  isCollapsed,
  setIsCollapsed,
  sessionUser
}: AdminSidebarProps) {
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
    const firstNavigable = item.subItems.find((s) => !s.id.endsWith('-header'));
    if (firstNavigable) onNavigate(resolveSectionId(firstNavigable.id));
  };

  const handleSubClick = (subId: string) => {
    onNavigate(resolveSectionId(subId));
  };

  let shownNewHeader = false;

  return (
    <div
      className="font-panel relative flex h-screen shrink-0 flex-col border-r border-zinc-200 bg-white transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-950"
      style={{ width: `${currentSidebarWidth}px` }}
    >
      <div className="border-b border-zinc-200 px-2 pb-4 pt-4 dark:border-zinc-800">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src="/assets/simbolo.png"
              alt="Logo"
              className="h-10 cursor-pointer object-contain"
              onClick={() => { window.location.href = '/'; }}
            />
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-zinc-800"
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
              className="h-10 w-10 object-contain cursor-pointer"
              onClick={() => { window.location.href = '/'; }}
            />
            <div className="flex-1 min-w-0">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-zinc-100">Painel Admin</h1>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400">Portal Digital</p>
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
              title="Recolher"
            >
              <LogOut size={18} className="-scale-x-100" />
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2.5">
        <div className="space-y-0">
          {menuItems.map((item) => {
            if (item.isNewMenu && !shownNewHeader && !isCollapsed) {
              shownNewHeader = true;
            }
            const showNewLabel = item.id === 'dashboard' && !isCollapsed;
            const Icon = item.icon;
            const isActive = isPanelMenuItemActive(item, activeSection);
            const isOpen = expandedMenu === item.id && !!item.subItems?.length;
            const isLegacy = item.id === 'menu-anterior';

            return (
              <React.Fragment key={item.id}>
                {showNewLabel && (
                  <div className="px-2.5 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Menu novo (proposta)
                  </div>
                )}
                {isLegacy && !isCollapsed && (
                  <div className="px-2.5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Menu anterior
                  </div>
                )}
                <div className="mb-1">
                  <button
                    onClick={() => handleParentClick(item)}
                    className={`group flex w-full items-center transition-all duration-200 ease-out hover:translate-x-1 ${
                      isCollapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-2'
                    } rounded-lg ${
                      isActive
                        ? 'text-red-600 font-bold'
                        : 'text-gray-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400'
                    }`}
                    title={isCollapsed ? item.label : ''}
                  >
                    <Icon
                      size={22}
                      className={
                        isActive
                          ? 'text-red-600'
                          : 'text-gray-500 group-hover:text-red-600'
                      }
                    />
                    {!isCollapsed && <span className="ml-3 text-[14px]">{item.label}</span>}
                    {!isCollapsed && item.subItems && (
                      <ChevronRight size={14} className={`ml-auto text-gray-400 transition-transform group-hover:text-red-600 ${isOpen ? 'rotate-90' : ''}`} />
                    )}
                  </button>

                  {!isCollapsed && item.subItems && isOpen && (
                    <div className="mt-1 ml-9 flex max-h-[55vh] flex-col gap-0.5 overflow-y-auto border-l border-gray-200 dark:border-zinc-800">
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
                            className={`relative flex items-center px-3 py-[5px] text-left text-sm transition-colors ${
                              isSubActive
                                ? 'font-bold text-red-600 before:absolute before:left-0 before:top-1/2 before:z-10 before:h-3 before:w-[4px] before:-translate-x-[2.5px] before:-translate-y-1/2 before:rounded-sm before:bg-red-600'
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
