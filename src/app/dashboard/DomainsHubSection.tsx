'use client';

import React, { useEffect, useState } from 'react';
import { Globe, List, Plus, Search as SearchIcon, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { panelField, panelBtnSecondary, panelTabList, panelTabBtn } from '@/lib/panel-ui';
import { DomainManagerSection } from '@/app/dashboard/HostingSections';
import { RegistrarDomainsSection } from '@/app/dashboard/RegistrarDomainsSection';
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome';
import type { DirectAdminPackage, DirectAdminWebsite } from '@/lib/directadmin-api';

import type { DomainHubTab } from '@/lib/panel-admin-menu';
export type { DomainHubTab } from '@/lib/panel-admin-menu';
export {
  isDomainHubRoute as isDomainHubSection,
  domainHubTabForSection as sectionToDomainTab,
} from '@/lib/panel-admin-menu';

type TabDef = {
  id: DomainHubTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ADMIN_TABS: TabDef[] = [
  { id: 'meus', label: 'Meus domínios', icon: Globe },
  { id: 'registados', label: 'Domínios registados', icon: List },
  { id: 'registar', label: 'Registar domínio', icon: ShoppingCart },
];

type DomainsHubSectionProps = {
  variant: 'admin' | 'reseller';
  isActive: boolean;
  initialTab: DomainHubTab;
  sites: DirectAdminWebsite[];
  packages?: DirectAdminPackage[];
  onRefresh?: () => void | Promise<void>;
  onCreateEmail?: (domain: string) => void;
  onNavigate?: (section: string, opts?: { domain?: string }) => void;
  onHubPanelClose?: () => void;
};

export function DomainsHubSection({
  variant,
  isActive,
  initialTab,
  sites,
  packages = [],
  onRefresh,
  onCreateEmail,
  onNavigate,
  onHubPanelClose,
}: DomainsHubSectionProps) {
  const [activeTab, setActiveTab] = useState<DomainHubTab>(initialTab);
  const [listSearch, setListSearch] = useState('');
  const [filteredCount, setFilteredCount] = useState(0);
  const { setChrome } = useAdminSectionChrome();
  const tabs = ADMIN_TABS;
  const hideTabs = variant === 'reseller';

  const closeHubPanel = () => {
    setActiveTab('meus');
    onHubPanelClose?.();
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (variant === 'admin' && isActive) setChrome(null);
    return () => {
      if (variant === 'admin') setChrome(null);
    };
  }, [variant, isActive, setChrome]);

  const showListToolbar = activeTab === 'meus' || activeTab === 'registados';

  return (
    <div className="w-full space-y-5">
      {!hideTabs && activeTab !== 'adicionar' ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <nav className={cn(panelTabList, 'shrink-0')} aria-label="Secções de domínios">
            {tabs.map(({ id, label, icon: Icon }) => {
              const isTabActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    panelTabBtn,
                    'inline-flex items-center justify-center gap-1.5',
                    isTabActive
                      ? 'border-b-red-600 text-zinc-900 dark:border-b-red-500 dark:text-zinc-100'
                      : 'border-transparent text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      isTabActive ? 'text-red-600 dark:text-red-500' : 'text-zinc-400',
                    )}
                  />
                  {label}
                </button>
              );
            })}
          </nav>

          <div
            className={cn(
              'flex w-full min-w-0 flex-col gap-2 lg:ml-auto lg:w-auto lg:flex-row lg:items-center lg:justify-end lg:gap-3 lg:pl-4',
              !showListToolbar && 'hidden',
            )}
          >
            <span className="flex h-[38px] shrink-0 items-center whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
              {filteredCount} domínio(s)
            </span>

            <div className="relative w-full min-w-0 lg:min-w-[10rem] lg:max-w-xl lg:flex-1">
              <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Pesquisar domínios..."
                className={cn(
                  panelField,
                  'rounded',
                  'w-full pl-8 pr-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
                )}
              />
            </div>

            {activeTab === 'meus' ? (
              <button
                type="button"
                onClick={() => setActiveTab('adicionar')}
                className={cn(panelBtnSecondary, 'shrink-0')}
              >
                <Plus className="h-4 w-4" />
                Adicionar domínio
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {hideTabs && showListToolbar ? (
        <div className="flex items-center justify-end gap-3">
          <span className="flex h-[38px] shrink-0 items-center whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
            {filteredCount} domínio(s)
          </span>

          <div className="relative min-w-[10rem] flex-1 max-w-xl">
            <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Pesquisar domínios..."
              className={cn(
                panelField,
                'rounded',
                'w-full pl-8 pr-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
              )}
            />
          </div>

          {activeTab === 'meus' ? (
            <button
              type="button"
              onClick={() => setActiveTab('adicionar')}
              className={cn(panelBtnSecondary, 'shrink-0')}
            >
              <Plus className="h-4 w-4" />
              Adicionar domínio
            </button>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'meus' ? (
        <DomainManagerSection
          sites={sites}
          packages={packages}
          onRefresh={onRefresh}
          onCreateEmail={onCreateEmail}
          onNavigate={onNavigate}
          hubMode
          hubPanel="list"
          domainListMode="hosting"
          isActive={isActive}
          listSearch={listSearch}
          onListSearchChange={setListSearch}
          onFilteredCountChange={setFilteredCount}
        />
      ) : null}

      {activeTab === 'adicionar' ? (
        <DomainManagerSection
          sites={sites}
          packages={packages}
          onRefresh={onRefresh}
          onCreateEmail={onCreateEmail}
          onNavigate={onNavigate}
          hubMode
          hubPanel="add"
          isActive={isActive}
          onHubAddClose={closeHubPanel}
        />
      ) : null}

      {activeTab === 'registados' ? (
        <DomainManagerSection
          sites={sites}
          packages={packages}
          onRefresh={onRefresh}
          onCreateEmail={onCreateEmail}
          onNavigate={onNavigate}
          hubMode
          hubPanel="list"
          domainListMode="registrar"
          isActive={isActive}
          listSearch={listSearch}
          onListSearchChange={setListSearch}
          onFilteredCountChange={setFilteredCount}
        />
      ) : null}

      {activeTab === 'registar' ? <RegistrarDomainsSection /> : null}
    </div>
  );
}
