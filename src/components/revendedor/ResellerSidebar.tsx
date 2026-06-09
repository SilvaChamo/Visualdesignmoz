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
import { SidebarAccount } from '@/components/panel/SidebarAccount';

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
      <div className="border-b border-zinc-200 px-2 pb-4 pt-4 dark:border-zinc-800">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={logoUrl}
              alt="Logo"
              className="h-10 w-full cursor-pointer object-contain"
              onClick={() => { window.location.href = '/revendedor'; }}
            />
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
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
              className="h-10 max-w-[140px] cursor-pointer object-contain"
              onClick={() => { window.location.href = '/revendedor'; }}
            />
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
          {RESELLER_DA_MENU.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const subIds = item.subItems?.map((s) => s.id) || [];
            const isActive = isItemActive(item.id, subIds);
            const isOpen = expandedMenu === item.id && !!item.subItems?.length;

            return (
              <div key={item.id} className="mb-1">
                <button
                  onClick={() => handleParentClick(item)}
                  className={`group flex w-full items-center transition-all duration-200 ease-out hover:translate-x-1 ${
                    isCollapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-2'
                  } rounded-lg ${
                    isActive
                      ? 'text-red-600 font-bold border-l-[3px] border-red-600 ml-[5px] pl-1.5 rounded-none'
                      : 'text-gray-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400'
                  }`}
                  title={isCollapsed ? item.label : item.description || item.label}
                >
                  <Icon
                    size={22}
                    className={isActive ? 'text-red-600' : 'text-gray-500 group-hover:text-red-600 dark:text-zinc-500'}
                  />
                  {!isCollapsed && <span className="ml-3 text-[15px]">{item.label}</span>}
                  {!isCollapsed && item.subItems?.length ? (
                    <ChevronRight
                      size={14}
                      className={`ml-auto text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    />
                  ) : null}
                </button>

                {!isCollapsed && item.subItems && isOpen && (
                  <div className="mt-1 ml-9 flex flex-col gap-1 border-l border-gray-200 dark:border-zinc-800">
                    {item.subItems.map((sub) => {
                      const isSubActive = activeSection === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => onNavigate(sub.id)}
                          className={`relative flex items-center px-3 py-[5px] text-left text-sm transition-colors ${
                            isSubActive
                              ? 'font-bold text-red-600 before:absolute before:-left-[1px] before:top-1/2 before:h-3 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-red-600'
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
            );
          })}
        </div>
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <SidebarAccount email={sessionUser} isCollapsed={isCollapsed} fallbackEmail="revendedor@visualdesignmoz.com" />
      </div>
    </div>
  );
}
