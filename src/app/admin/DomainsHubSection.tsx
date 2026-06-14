'use client';

import React, { useEffect, useState } from 'react';
import { Globe, List, Plus, Search as SearchIcon, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { panelField, panelBtnSecondary } from '@/lib/panel-ui';
import { DomainManagerSection } from '@/app/admin/HostingSections';
import { RegistrarDomainsSection } from '@/app/admin/RegistrarDomainsSection';
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome';
import type { DirectAdminPackage, DirectAdminWebsite } from '@/lib/directadmin-api';

export type DomainHubTab = 'meus' | 'adicionar' | 'registados' | 'registar';

const DOMAIN_HUB_SECTION_IDS = new Set([
  'domain-manager',
  'porkbun-domains',
  'porkbun-my-domains',
  'domains-new',
]);

export function isDomainHubSection(sectionId: string): boolean {
  return DOMAIN_HUB_SECTION_IDS.has(sectionId);
}

export function sectionToDomainTab(sectionId: string): DomainHubTab {
  if (sectionId === 'domains-new') return 'adicionar';
  if (sectionId === 'porkbun-domains') return 'registar';
  if (sectionId === 'porkbun-my-domains') return 'registados';
  return 'meus';
}

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

const RESELLER_TABS: TabDef[] = [
  { id: 'meus', label: 'Meus domínios', icon: Globe },
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
}: DomainsHubSectionProps) {
  const [activeTab, setActiveTab] = useState<DomainHubTab>(initialTab);
  const [listSearch, setListSearch] = useState('');
  const [filteredCount, setFilteredCount] = useState(0);
  const { setChrome } = useAdminSectionChrome();
  const tabs = variant === 'admin' ? ADMIN_TABS : RESELLER_TABS;

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
      {activeTab !== 'adicionar' ? (
        <div className="flex items-center justify-between gap-4">
          <nav className="flex shrink-0 flex-wrap gap-x-5" aria-label="Secções de domínios">
            {tabs.map(({ id, label, icon: Icon }) => {
              const isTabActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium transition-colors',
                    isTabActive
                      ? 'border-red-600 text-zinc-900 dark:border-red-500 dark:text-zinc-100'
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
              'ml-auto flex min-w-0 items-center justify-end gap-3 pl-4',
              !showListToolbar && 'hidden',
            )}
          >
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
          onHubAddClose={() => setActiveTab('meus')}
        />
      ) : null}

      {activeTab === 'registados' && variant === 'admin' ? (
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
