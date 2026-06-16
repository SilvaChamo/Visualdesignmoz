'use client';

import React from 'react';
import {
  Home, LogOut, ChevronRight, Server, Mail, Globe, Bell, Settings, Palette, Layers, Wrench,
} from 'lucide-react';

import { useResellerMenuPrivileges } from '@/hooks/useResellerMenuPrivileges';
import { useResellerNotificationBadge } from '@/components/revendedor/ResellerNotificationsInbox';
import { SidebarAccount } from '@/components/panel/SidebarAccount';

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
  RESELLER_MAIN_MENU_DEFS,
  RESELLER_LEGACY_MENU_DEFS,
  isPanelMenuItemActive,
  resolveSectionId,
  resellerMenuParentForSection,
  type PanelMenuItemDef,
} from '@/lib/panel-admin-menu';
import { filterMenuByPrivileges } from '@/lib/panel-menu-privileges';

interface ResellerSidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  sessionUser: string | null;
  displayName?: string | null;
  customLogo?: string;
}

interface MenuItem extends PanelMenuItemDef {
  icon: React.ElementType;
}

const MAIN_MENU_ICONS: Record<string, React.ElementType> = {
  dashboard: Home,
  'nov-hospedagem': Server,
  'nov-email': Mail,
  'nov-dominios': Globe,
  'nov-notificacoes': Bell,
  'nov-wordpress': WordPressMenuIcon,
  'nov-definicoes': Settings,
};

const LEGACY_MENU_ICONS: Record<string, React.ElementType> = {
  'leg-gestao-sites': Globe,
  'leg-gestao-dominios': Server,
  'leg-wordpress': WordPressMenuIcon,
  'leg-construtores': Palette,
  'leg-gestao-emails': Mail,
  'leg-outros': Wrench,
};

const DASHBOARD_ITEM: MenuItem = {
  id: 'dashboard',
  label: 'Dashboard',
  icon: Home,
};

/** Altura fixa — igual ao painel admin. */
const MENU_ROW_CLASS = 'box-border h-11 min-h-11 max-h-11 shrink-0';
const SUB_ROW_CLASS = 'box-border h-8 min-h-8 max-h-8 shrink-0 leading-none';

export function ResellerSidebar({
  activeSection,
  onNavigate,
  isCollapsed,
  setIsCollapsed,
  sessionUser,
  displayName,
  customLogo,
}: ResellerSidebarProps) {
  const { privileges } = useResellerMenuPrivileges();
  const { unreadCount, refreshUnread } = useResellerNotificationBadge();
  const currentSidebarWidth = isCollapsed ? 64 : 242;
  const logoUrl = customLogo || '/assets/simbolo.png';

  const mainMenuItems: MenuItem[] = filterMenuByPrivileges(RESELLER_MAIN_MENU_DEFS, privileges).map(
    (item) => ({
      ...item,
      icon: MAIN_MENU_ICONS[item.id] || Server,
    }),
  );

  const legacyMenuItems: MenuItem[] = filterMenuByPrivileges(RESELLER_LEGACY_MENU_DEFS, privileges).map(
    (item) => ({
      ...item,
      icon: LEGACY_MENU_ICONS[item.id] || Layers,
    }),
  );

  const [expandedMenu, setExpandedMenu] = React.useState<string | null>(() =>
    resellerMenuParentForSection(activeSection),
  );

  React.useEffect(() => {
    const parent = resellerMenuParentForSection(activeSection);
    if (parent) setExpandedMenu(parent);
  }, [activeSection]);

  React.useEffect(() => {
    if (activeSection === 'notificacoes-recebidas') {
      void refreshUnread();
    }
  }, [activeSection, refreshUnread]);

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
      onNavigate('packages-list');
      return;
    }
    const firstNavigable = item.subItems.find((s) => !s.id.endsWith('-header'));
    if (firstNavigable) onNavigate(resolveSectionId(firstNavigable.id));
  };

  const handleSubClick = (subId: string) => {
    onNavigate(resolveSectionId(subId));
  };

  const renderMenuBlock = (items: MenuItem[], options?: { includeDashboard?: boolean; legacy?: boolean }) => {
    const blockItems = options?.includeDashboard ? [DASHBOARD_ITEM, ...items] : items;
    const isLegacyBlock = options?.legacy;

    return blockItems.map((item) => {
      const Icon = item.icon;
      const isActive = item.id === 'dashboard'
        ? activeSection === 'dashboard'
        : isPanelMenuItemActive(item, activeSection);
      const showNotifBadge = item.id === 'nov-notificacoes' && unreadCount > 0;
      const hasSubItems = !!item.subItems?.length;
      const isOpen = expandedMenu === item.id && hasSubItems;

      return (
        <div key={item.id}>
          <button
            type="button"
            onClick={() => handleParentClick(item)}
            className={`group flex w-full items-center overflow-hidden ${MENU_ROW_CLASS} transition-all duration-200 ease-out hover:translate-x-1 ${
              isCollapsed ? 'justify-center px-2' : 'px-2.5'
            } rounded-lg ${
              isActive
                ? 'text-red-600 font-bold'
                : 'text-gray-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400'
            }`}
            title={isCollapsed ? item.label : ''}
          >
            {item.id === 'nov-wordpress' || item.id === 'leg-wordpress' ? (
              <WordPressMenuIcon
                size={20}
                className={
                  isActive
                    ? 'text-red-600'
                    : 'text-gray-500 group-hover:text-red-600 dark:text-zinc-500 dark:group-hover:text-red-400'
                }
              />
            ) : (
              <Icon
                size={20}
                className={`shrink-0 ${
                  isActive
                    ? 'text-red-600'
                    : 'text-gray-500 group-hover:text-red-600 dark:text-zinc-500 dark:group-hover:text-red-400'
                }`}
              />
            )}
            {!isCollapsed && (
              <span className="ml-3 flex flex-1 items-center gap-2 truncate text-base leading-none">
                {item.label}
                {showNotifBadge && (
                  <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
            )}
            {!isCollapsed && hasSubItems && (
              <ChevronRight
                size={14}
                className={`${showNotifBadge ? '' : 'ml-auto'} text-gray-400 transition-transform group-hover:text-red-600 dark:group-hover:text-red-400 ${isOpen ? 'rotate-90' : ''}`}
              />
            )}
          </button>

          {!isCollapsed && hasSubItems && isOpen && (
            <div className="ml-9 flex max-h-[55vh] flex-col overflow-y-auto border-l border-gray-200 dark:border-zinc-800">
              {item.subItems!.map((sub) => {
                if (sub.id.endsWith('-header')) {
                  if (isLegacyBlock) return null;
                  return (
                    <div key={sub.id} className="px-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {sub.label.replace(/^—\s*|\s*—$/g, '')}
                    </div>
                  );
                }
                const resolved = resolveSectionId(sub.id);
                const isSubActive = resolveSectionId(activeSection) === resolved;
                const isRecebidas = sub.id === 'notificacoes-recebidas';
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleSubClick(sub.id)}
                    className={`relative flex items-center overflow-visible px-3 text-left text-[15px] transition-colors duration-200 focus:outline-none ${SUB_ROW_CLASS} ${
                      isSubActive
                        ? 'font-bold text-red-600 before:absolute before:-left-px before:top-1/2 before:z-20 before:h-3 before:w-1 before:-translate-x-px before:-translate-y-1/2 before:rounded-sm before:bg-red-600'
                        : 'text-gray-600 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400'
                    }`}
                  >
                    <span className="flex flex-1 items-center gap-2">
                      {sub.label}
                      {isRecebidas && unreadCount > 0 && (
                        <span className="inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    });
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
              className="h-11 w-11 cursor-pointer object-contain"
              onClick={() => { window.location.href = '/revendedor'; }}
            />
            <button
              type="button"
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
              src={logoUrl}
              alt="Logo"
              className="h-11 max-w-[140px] w-auto cursor-pointer object-contain"
              onClick={() => { window.location.href = '/revendedor'; }}
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-gray-900 dark:text-zinc-100">
                {displayName || 'Revendedor'}
              </h1>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Portal Digital</p>
            </div>
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-transparent dark:hover:text-red-400"
              title="Recolher"
            >
              <LogOut size={18} className="-scale-x-100" />
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-0">
          {renderMenuBlock(mainMenuItems, { includeDashboard: true })}
        </div>

        {!isCollapsed && legacyMenuItems.length > 0 && (
          <div className="px-2.5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Menu anterior
          </div>
        )}

        <div className="space-y-0">
          {renderMenuBlock(legacyMenuItems, { legacy: true })}
        </div>
      </nav>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <SidebarAccount email={sessionUser} isCollapsed={isCollapsed} />
      </div>
    </div>
  );
}
