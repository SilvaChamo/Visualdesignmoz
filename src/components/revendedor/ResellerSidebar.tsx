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
  const currentSidebarWidth = isCollapsed ? 80 : 250;
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
      className="relative bg-white border-r border-gray-200 text-gray-800 flex flex-col shadow-sm h-screen transition-all duration-300"
      style={{ width: `${currentSidebarWidth}px` }}
    >
      <div className="px-2 pb-4 border-b border-gray-100 pt-4">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={logoUrl}
              alt="Logo"
              className="h-12 w-full object-contain cursor-pointer"
              onClick={() => window.location.href = '/revendedor'}
            />
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded hover:bg-gray-100 transition-colors p-1"
              title="Expandir"
            >
              <LogOut size={22} className="text-gray-500" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <img
              src={logoUrl}
              alt="Logo"
              className="w-auto h-12 max-w-[140px] object-contain cursor-pointer"
              onClick={() => window.location.href = '/revendedor'}
            />
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded hover:bg-gray-100 transition-colors p-1"
              title="Recolher"
            >
              <LogOut size={22} className="text-gray-500 -scale-x-100" />
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

            return (
              <div key={item.id} className="mb-1">
                <button
                  onClick={() => handleParentClick(item)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} ${isCollapsed ? 'px-2 py-2' : 'px-2.5 py-2'} rounded-lg transition-all duration-200 ease-out hover:translate-x-1 group ${
                    isActive || (expandedMenu === item.id && item.subItems?.length)
                      ? item.id === 'dashboard'
                        ? 'text-red-600 font-bold bg-red-50 border-l-[3px] border-red-600 ml-[5px] pl-1.5 rounded-none'
                        : 'text-black font-bold'
                      : 'hover:text-red-600 text-gray-600'
                  }`}
                  title={isCollapsed ? item.label : item.description || item.label}
                >
                  <Icon
                    size={22}
                    className={`${isActive || expandedMenu === item.id ? (item.id === 'dashboard' ? 'text-red-600' : 'text-gray-900') : 'text-gray-500 group-hover:text-red-600'}`}
                  />
                  {!isCollapsed && <span className="ml-3 text-[15px]">{item.label}</span>}
                  {!isCollapsed && item.subItems?.length ? (
                    <ChevronRight
                      size={14}
                      className={`ml-auto text-gray-400 transition-transform ${expandedMenu === item.id ? 'rotate-90' : ''}`}
                    />
                  ) : null}
                  {!isCollapsed && !item.subItems?.length && isActive ? (
                    <ChevronRight
                      size={14}
                      className={`ml-auto ${item.id === 'dashboard' ? 'text-red-600' : 'text-gray-900'}`}
                    />
                  ) : null}
                </button>

                {!isCollapsed && item.subItems && expandedMenu === item.id && (
                  <div className="mt-1 ml-9 border-l border-gray-200 flex flex-col gap-1">
                    {item.subItems.map((sub) => {
                      const isSubActive = activeSection === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => onNavigate(sub.id)}
                          className={`flex items-center text-left px-3 py-[5px] text-sm transition-colors relative ${
                            isSubActive
                              ? 'text-red-600 font-bold before:absolute before:-left-[1px] before:top-1/2 before:-translate-y-1/2 before:w-[2px] before:h-3 before:bg-red-600 before:rounded-full before:z-10'
                              : 'text-gray-600 hover:text-red-600'
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

      <div className="p-3 border-t border-gray-100">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">
              {sessionUser?.charAt(0).toUpperCase() || 'OC'}
            </span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate">
                {sessionUser ? sessionUser.split('@')[0] : 'Revendedor'}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{sessionUser || 'Osher Collective'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
