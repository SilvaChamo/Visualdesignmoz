'use client';

import React from 'react';
import {
  Home, LogOut, ChevronRight, Archive, Users, Server, Mail, Globe, Bell, Layout, Settings,
} from 'lucide-react';

import { useResellerMenuPrivileges } from '@/hooks/useResellerMenuPrivileges';

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
  RESELLER_ADMIN_MENU_DEFS,
  adminMenuParentForSection,
  isPanelMenuItemActive,
  resolveSectionId,
  type PanelMenuItemDef,
} from '@/lib/panel-admin-menu';
import { filterMenuByPrivileges } from '@/lib/panel-menu-privileges';

interface ResellerSidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  sessionUser: string | null;
  customLogo?: string;
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
  'menu-anterior': Archive,
};

const DASHBOARD_ITEM: MenuItem = {
  id: 'dashboard',
  label: 'Dashboard',
  icon: Home,
};

export function ResellerSidebar({
  activeSection,
  onNavigate,
  isCollapsed,
  setIsCollapsed,
  sessionUser,
  customLogo,
}: ResellerSidebarProps) {
  const { privileges } = useResellerMenuPrivileges();
  const currentSidebarWidth = isCollapsed ? 72 : 228;
  const logoUrl = customLogo || '/assets/simbolo.png';

  const adminMenuItems: MenuItem[] = filterMenuByPrivileges(RESELLER_ADMIN_MENU_DEFS, privileges).map(
    (item) => ({
      ...item,
      icon: MENU_ICONS[item.id] || Archive,
    }),
  );

  const menuItems: MenuItem[] = [DASHBOARD_ITEM, ...adminMenuItems];

  const [expandedMenu, setExpandedMenu] = React.useState<string | null>(() =>
    activeSection === 'dashboard' ? null : adminMenuParentForSection(activeSection),
  );

  React.useEffect(() => {
    if (activeSection === 'dashboard') {
      setExpandedMenu(null);
      return;
    }
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
              onClick={() => { window.location.href = '/revendedor'; }}
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
              onClick={() => { window.location.href = '/revendedor'; }}
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
          {menuItems.map((item) => {
            if (item.isNewMenu && !shownNewHeader && !isCollapsed) {
              shownNewHeader = true;
            }
            const showNewLabel = item.id === 'utilizadores' && !isCollapsed;
            const Icon = item.icon;
            const isActive = item.id === 'dashboard'
              ? activeSection === 'dashboard'
              : isPanelMenuItemActive(item, activeSection);
            const isOpen = expandedMenu === item.id && !!item.subItems?.length;
            const isLegacy = item.id === 'menu-anterior';
            const isDashboard = item.id === 'dashboard';

            return (
              <React.Fragment key={item.id}>
                {showNewLabel && (
                  <div className="px-2.5 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Menu admin
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
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} ${isCollapsed ? 'px-2 py-2' : 'px-2.5 py-2'} rounded-lg transition-all duration-200 ease-out hover:translate-x-1 group ${
                      isActive || (expandedMenu === item.id && item.subItems)
                        ? isDashboard
                          ? 'text-red-600 font-bold bg-red-50 border-l-[3px] border-red-600 ml-[5px] pl-1.5 rounded-none'
                          : 'text-black font-bold'
                        : 'hover:text-red-600 text-gray-600'
                    }`}
                    title={isCollapsed ? item.label : ''}
                  >
                    {item.id === 'nov-wordpress' ? (
                      <WordPressMenuIcon
                        size={22}
                        className={
                          isActive || expandedMenu === item.id
                            ? (isDashboard ? 'text-red-600' : 'text-gray-900')
                            : 'text-gray-500 group-hover:text-red-600'
                        }
                      />
                    ) : (
                      <Icon
                        size={22}
                        className={`${isActive || expandedMenu === item.id ? (isDashboard ? 'text-red-600' : 'text-gray-900') : 'text-gray-500 group-hover:text-red-600'}`}
                      />
                    )}
                    {!isCollapsed && <span className="ml-3 text-[15px]">{item.label}</span>}
                    {!isCollapsed && item.subItems && (
                      <ChevronRight size={14} className={`ml-auto text-gray-400 transition-transform group-hover:text-red-600 ${isOpen ? 'rotate-90' : ''}`} />
                    )}
                    {!isCollapsed && !item.subItems && isActive && (
                      <ChevronRight size={14} className={`ml-auto ${isDashboard ? 'text-red-600' : 'text-gray-900'}`} />
                    )}
                  </button>

                  {!isCollapsed && item.subItems && isOpen && (
                    <div className="mt-1 ml-9 border-l border-gray-200 flex flex-col gap-0.5 max-h-[55vh] overflow-y-auto">
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
              </React.Fragment>
            );
          })}
        </div>
      </nav>

      <div className="p-3 border-t border-gray-100">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">
              {sessionUser?.charAt(0).toUpperCase() || 'SC'}
            </span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate">
                {sessionUser ? sessionUser.split('@')[0] : 'Silva Chamo'}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{sessionUser || 'admin@your-domain.com'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
