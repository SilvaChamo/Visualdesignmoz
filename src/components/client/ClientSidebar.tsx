'use client';

import React from 'react';
import {
  Home,
  Globe,
  Mail,
  Target,
  Users,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import {
  CLIENT_MENU_DEFS,
  clientMenuParentForSection,
  isClientMenuItemActive,
} from '@/lib/panel-client-menu';
import { CLIENT_READONLY_MENU_DEFS } from '@/lib/panel-role-capabilities';
import { resolveSectionId } from '@/lib/panel-admin-menu';
import { SidebarMenuFlyout } from '@/components/panel/SidebarMenuFlyout';
import { panelShellHeaderHeight } from '@/lib/panel-ui';
import { cn } from '@/lib/utils';

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

type FlatItem = {
  id: string;
  label: string;
  icon: React.ElementType;
};

const FLAT_ITEMS: FlatItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'domains', label: 'O Meu Site', icon: Globe },
  { id: 'webmail', label: 'Webmail', icon: Mail },
  { id: 'mailmarketing', label: 'Mailmarketing', icon: Target },
  { id: 'tickets', label: 'Suporte', icon: Users },
  { id: 'faturas', label: 'Faturas', icon: FileText },
  { id: 'conta', label: 'Conta', icon: Settings },
];

const EXPANDABLE_ICONS: Record<string, React.ElementType> = {
  'nov-dominios': Globe,
  'nov-wordpress': WordPressMenuIcon,
};

interface ClientSidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  cliente?: { nome?: string; email?: string } | null;
  isMobile?: boolean;
  readOnly?: boolean;
}

export function ClientSidebar({
  activeSection,
  onNavigate,
  isCollapsed,
  setIsCollapsed,
  cliente,
  isMobile = false,
  readOnly = false,
}: ClientSidebarProps) {
  const currentSidebarWidth = isCollapsed ? 64 : 250;
  const [expandedMenu, setExpandedMenu] = React.useState<string | null>(null);
  const flatItems = readOnly
    ? [
        { id: 'meus-produtos', label: 'Os meus produtos', icon: Home },
        { id: 'domains', label: 'Os meus sites', icon: Globe },
      ]
    : FLAT_ITEMS;
  const expandableMenus = readOnly ? [] : CLIENT_MENU_DEFS;

  React.useEffect(() => {
    const parent = clientMenuParentForSection(activeSection);
    if (parent) setExpandedMenu(parent);
  }, [activeSection]);

  const handleParentClick = (menuId: string, hasSubItems: boolean) => {
    if (!hasSubItems) {
      setExpandedMenu(null);
      onNavigate(menuId);
      return;
    }
    setExpandedMenu((prev) => (prev === menuId ? null : menuId));
  };

  const handleSubClick = (subId: string) => {
    onNavigate(resolveSectionId(subId));
  };

  const isFlatActive = (item: FlatItem) => {
    if (item.id === 'domains') {
      return ['domains', 'domains-new', 'domains-list', 'file-manager', 'cp-file-manager'].includes(
        activeSection,
      );
    }
    if (item.id === 'emails-new') {
      return activeSection.startsWith('cp-email') || activeSection === 'emails-new';
    }
    return activeSection === item.id;
  };

  return (
    <div
      className="relative z-50 flex shrink-0 flex-col overflow-visible border-r border-gray-200 bg-white text-gray-800 shadow-sm transition-all duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      style={{ width: `${currentSidebarWidth}px` }}
    >
      <div
        className={cn(
          'shrink-0 border-b border-gray-100 px-2 dark:border-zinc-800',
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
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-900"
            >
              <ChevronRight size={22} className="text-gray-500 dark:text-zinc-400" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <img
              src="/assets/simbolo.png"
              alt="Logo"
              className="h-11 w-11 cursor-pointer object-contain"
              onClick={() => { window.location.href = '/'; }}
            />
            <div className="flex-1">
              <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-zinc-100">
                VisualDESIGN
              </h1>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Gestão de Serviços</p>
            </div>
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-900"
              title={isCollapsed ? 'Expandir' : 'Recolher'}
            >
              <ChevronLeft size={22} className="text-gray-500 dark:text-zinc-400" />
            </button>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-2.5">
        <div className="flex flex-col space-y-0.5">
          {flatItems.slice(0, readOnly ? flatItems.length : 2).map((item) => {
            const Icon = item.icon;
            const isActive = isFlatActive(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex w-full items-center rounded-lg transition-all duration-200 ease-out hover:translate-x-1 ${
                  isCollapsed ? 'justify-center px-2 py-2' : 'p-2.5 px-4'
                } ${
                  isActive
                    ? 'bg-red-50 font-bold text-red-600 dark:bg-red-950/30 dark:text-red-400'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-red-400'
                }`}
              >
                <Icon size={22} className={isActive ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-zinc-500'} />
                {!isCollapsed && <span className="ml-3 text-[15px]">{item.label}</span>}
              </button>
            );
          })}

          {expandableMenus.map((menu) => {
            const Icon = EXPANDABLE_ICONS[menu.id] || Globe;
            const isActive = isClientMenuItemActive(menu, activeSection);
            const isOpen = expandedMenu === menu.id;
            const hasSubItems = !!menu.subItems?.length;

            return (
              <div key={menu.id} className="mb-0.5">
                {(() => {
                  const parentButton = (
                    <button
                      type="button"
                      onClick={() => {
                        if (isCollapsed && isMobile && hasSubItems) return;
                        handleParentClick(menu.id, hasSubItems);
                      }}
                      className={`group flex w-full items-center rounded-lg transition-all duration-200 ease-out hover:translate-x-1 ${
                        isCollapsed ? 'justify-center px-2 py-2' : 'p-2.5 px-4'
                      } ${
                        isActive || isOpen
                          ? 'font-bold text-gray-900 dark:text-zinc-100'
                          : 'text-gray-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400'
                      }`}
                      title={isCollapsed ? menu.label : ''}
                    >
                      {menu.id === 'nov-wordpress' ? (
                        <WordPressMenuIcon
                          size={22}
                          className={
                            isActive
                              ? 'text-gray-900 dark:text-zinc-100'
                              : 'text-gray-500 group-hover:text-red-600 dark:text-zinc-500 dark:group-hover:text-red-400'
                          }
                        />
                      ) : (
                        <Icon
                          size={22}
                          className={
                            isActive
                              ? 'text-gray-900 dark:text-zinc-100'
                              : 'text-gray-500 group-hover:text-red-600 dark:text-zinc-500 dark:group-hover:text-red-400'
                          }
                        />
                      )}
                      {!isCollapsed && (
                        <>
                          <span className="ml-3 flex-1 text-left text-[15px]">{menu.label}</span>
                          {hasSubItems && (
                            <ChevronRight
                              size={14}
                              className={`text-gray-400 transition-transform group-hover:text-red-600 dark:group-hover:text-red-400 ${isOpen ? 'rotate-90' : ''}`}
                            />
                          )}
                        </>
                      )}
                    </button>
                  );

                  if (isCollapsed && isMobile && hasSubItems) {
                    return (
                      <SidebarMenuFlyout
                        label={menu.label}
                        subItems={menu.subItems!.map((sub) => ({
                          id: sub.id,
                          label: sub.label,
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

                {!isCollapsed && hasSubItems && isOpen && (
                  <div className="ml-9 mt-1 flex flex-col gap-0.5 border-l border-gray-200 dark:border-zinc-800">
                    {menu.subItems!.map((sub) => {
                      const resolved = resolveSectionId(sub.id);
                      const isSubActive =
                        resolveSectionId(activeSection) === resolved || activeSection === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSubClick(sub.id)}
                          className={`relative px-3 py-[5px] text-left text-sm transition-colors ${
                            isSubActive
                              ? 'font-bold text-red-600 before:absolute before:-left-[1px] before:top-1/2 before:z-10 before:h-3 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-red-600 dark:text-red-400'
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

          {!readOnly && FLAT_ITEMS.slice(2).map((item) => {
            const Icon = item.icon;
            const isActive = isFlatActive(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex w-full items-center rounded-lg transition-all duration-200 ease-out hover:translate-x-1 ${
                  isCollapsed ? 'justify-center px-2 py-2' : 'p-2.5 px-4'
                } ${
                  isActive
                    ? 'bg-red-50 font-bold text-red-600 dark:bg-red-950/30 dark:text-red-400'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-red-400'
                }`}
              >
                <Icon size={22} className={isActive ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-zinc-500'} />
                {!isCollapsed && <span className="ml-3 text-[15px]">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-gray-100 p-3 dark:border-zinc-800">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-2'}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600">
            <span className="text-xs font-bold text-white">
              {cliente?.nome?.substring(0, 2).toUpperCase() || '??'}
            </span>
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-gray-900 dark:text-zinc-100">
                {cliente?.nome || 'A carregar…'}
              </p>
              <p className="truncate text-[10px] text-gray-400 dark:text-zinc-500">
                {cliente?.email || '…'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { FLAT_ITEMS };
