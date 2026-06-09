'use client';

import React from 'react';
import {
  Home, Globe, Mail, Database, Settings, Package, LogOut, ChevronRight,
  Archive, Server, Bell, Link2, FolderOpen, Shield, Code, Users, BarChart3,
} from 'lucide-react';
import {
  RESELLER_DA_MENU,
  resellerMenuParentForSection,
  type ResellerMenuIcon,
} from '@/lib/directadmin-panel-menu';

interface ResellerSidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  sessionUser: string | null;
  customLogo?: string;
}

const ICON_MAP: Record<ResellerMenuIcon, React.ElementType> = {
  home: Home,
  link: Link2,
  mail: Mail,
  folder: FolderOpen,
  globe: Globe,
  wordpress: Globe,
  archive: Archive,
  database: Database,
  server: Server,
  shield: Shield,
  code: Code,
  users: Users,
  package: Package,
  chart: BarChart3,
  bell: Bell,
  settings: Settings,
};

export function ResellerSidebar({
  activeSection,
  onNavigate,
  isCollapsed,
  setIsCollapsed,
  sessionUser,
  customLogo,
}: ResellerSidebarProps) {
  const currentSidebarWidth = isCollapsed ? 72 : 248;
  const logoUrl = customLogo || '/assets/simbolo.png';
  const [expandedMenu, setExpandedMenu] = React.useState<string | null>(() =>
    resellerMenuParentForSection(activeSection),
  );

  React.useEffect(() => {
    const parent = resellerMenuParentForSection(activeSection);
    if (parent) setExpandedMenu(parent);
  }, [activeSection]);

  const handleParentClick = (item: (typeof RESELLER_DA_MENU)[number]) => {
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
    onNavigate(item.subItems[0].id);
  };

  const isItemActive = (itemId: string, subIds: string[] = []) => {
    if (activeSection === itemId) return true;
    if (subIds.includes(activeSection)) return true;
    return resellerMenuParentForSection(activeSection) === itemId;
  };

  return (
    <div
      className="font-panel relative flex h-screen shrink-0 flex-col border-r border-zinc-200 bg-white transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-950"
      style={{ width: `${currentSidebarWidth}px` }}
    >
      <div className="border-b border-zinc-200 px-3 py-4 dark:border-zinc-800">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={logoUrl}
              alt="Logo"
              className="h-9 w-9 cursor-pointer rounded-md object-contain"
              onClick={() => { window.location.href = '/revendedor'; }}
            />
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              title="Expandir"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <img
              src={logoUrl}
              alt="Logo"
              className="h-9 max-w-[132px] cursor-pointer rounded-md object-contain"
              onClick={() => { window.location.href = '/revendedor'; }}
            />
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              title="Recolher"
            >
              <LogOut size={18} className="-scale-x-100" />
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          {RESELLER_DA_MENU.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const subIds = item.subItems?.map((s) => s.id) || [];
            const isActive = isItemActive(item.id, subIds);
            const isOpen = expandedMenu === item.id && !!item.subItems?.length;

            return (
              <div key={item.id}>
                <button
                  onClick={() => handleParentClick(item)}
                  className={`group flex w-full items-center rounded-md px-2.5 py-2 text-sm transition-colors ${
                    isCollapsed ? 'justify-center' : ''
                  } ${
                    isActive || isOpen
                      ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-50'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
                  }`}
                  title={isCollapsed ? item.label : item.description || item.label}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 ${isActive || isOpen ? 'text-red-600 dark:text-red-400' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`}
                  />
                  {!isCollapsed && <span className="ml-2.5 truncate">{item.label}</span>}
                  {!isCollapsed && item.subItems?.length ? (
                    <ChevronRight
                      size={14}
                      className={`ml-auto text-zinc-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    />
                  ) : null}
                </button>

                {!isCollapsed && item.subItems && isOpen && (
                  <div className="mb-1 ml-5 mt-0.5 space-y-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
                    {item.subItems.map((sub) => {
                      const isSubActive = activeSection === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => onNavigate(sub.id)}
                          className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                            isSubActive
                              ? 'bg-red-50 font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300'
                              : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
                          }`}
                        >
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white">
            {sessionUser?.charAt(0).toUpperCase() || 'R'}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                {sessionUser ? sessionUser.split('@')[0] : 'Revendedor'}
              </p>
              <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                {sessionUser || 'Conta revenda'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
