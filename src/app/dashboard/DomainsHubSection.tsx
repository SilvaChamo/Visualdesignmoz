'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Globe, Plus, RefreshCw, Search as SearchIcon, ShoppingCart, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { panelField, panelBtnSecondary, panelTabList, panelTabBtn } from '@/lib/panel-ui';
import { DomainManagerSection } from '@/app/dashboard/HostingSections';
import { RegistrarDomainsSection } from '@/app/dashboard/RegistrarDomainsSection';
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome';
import type { DirectAdminPackage, DirectAdminWebsite } from '@/lib/directadmin-api';

import {
  PRIMARY_RESELLER_DA_USER,
  isCompanyHostingOwner,
  isVisualDesignInfrastructureDomain,
} from '@/lib/panel-contas-enrich';
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
  { id: 'clientes', label: 'Domínios de Clientes', icon: Users },
  { id: 'registar', label: 'Registar domínio', icon: ShoppingCart },
];

/** Meus = sites da VisualDesign neste servidor. Clientes = contas Hestia
 * reais de clientes. Osher fica de fora das duas. A conta API do Hestia
 * (`vdadmin`) não está em panel_users — tratar o owner da empresa ANTES
 * de qualquer lista de clientes, senão teste/files/entrecampos caem na
 * aba errada. */
function isVisualDesignOwnSite(
  site: Pick<DirectAdminWebsite, 'adminEmail' | 'owner' | 'domain'>,
  adminEmail: string,
  clientOwners: Set<string>,
  clientEmails: Set<string>,
  hostingOwner?: string | null,
): boolean {
  const owner = (site.owner || '').trim().toLowerCase();
  const siteEmail = (site.adminEmail || '').trim().toLowerCase();
  if (owner && owner === PRIMARY_RESELLER_DA_USER.toLowerCase()) return false;
  if (isVisualDesignInfrastructureDomain(site.domain)) return true;
  if (isCompanyHostingOwner(owner, hostingOwner)) return true;
  if (Boolean(adminEmail) && siteEmail === adminEmail.trim().toLowerCase()) return true;
  if (owner && clientOwners.has(owner)) return false;
  if (siteEmail && clientEmails.has(siteEmail)) return false;
  return false;
}

type DomainsHubSectionProps = {
  variant: 'admin' | 'reseller';
  isActive: boolean;
  initialTab: DomainHubTab;
  sites: DirectAdminWebsite[];
  packages?: DirectAdminPackage[];
  /** Email de quem está autenticado — usado para separar "Meus domínios" de
   * "Domínios de Clientes" (ver isVisualDesignOwnSite). */
  adminEmail?: string | null;
  /** Username da conta principal no Hestia, fonte de verdade do ownership. */
  hostingOwner?: string | null;
  /** Owners e emails associados a contas de clientes, vindos do bootstrap. */
  clientOwners?: string[];
  clientEmails?: string[];
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
  adminEmail,
  hostingOwner,
  clientOwners = [],
  clientEmails = [],
  onRefresh,
  onCreateEmail,
  onNavigate,
  onHubPanelClose,
}: DomainsHubSectionProps) {
  const [activeTab, setActiveTab] = useState<DomainHubTab>(initialTab);
  const [listSearch, setListSearch] = useState('');
  const [filteredCount, setFilteredCount] = useState(0);
  const { setChrome } = useAdminSectionChrome();
  const hideTabs = variant === 'reseller';
  // Um revendedor não tem noção de "domínios da VisualDesign vs. de clientes"
  // (para ele, os domínios geridos SÃO todos de clientes) — só o admin separa.
  const tabs = variant === 'admin' ? ADMIN_TABS : ADMIN_TABS.filter((t) => t.id !== 'clientes');
  const clientOwnerSet = useMemo(
    () => new Set(clientOwners.map((value) => value.trim().toLowerCase()).filter(Boolean)),
    [clientOwners],
  );
  const clientEmailSet = useMemo(
    () => new Set(clientEmails.map((value) => value.trim().toLowerCase()).filter(Boolean)),
    [clientEmails],
  );
  const osherOwner = PRIMARY_RESELLER_DA_USER.toLowerCase();

  const ownSites = useMemo(
    () => (variant === 'admin'
      ? sites.filter((s) => {
          const owner = (s.owner || '').trim().toLowerCase();
          if (owner && owner === osherOwner) return false;
          return isVisualDesignOwnSite(s, adminEmail || '', clientOwnerSet, clientEmailSet, hostingOwner);
        })
      : sites),
    [variant, sites, adminEmail, clientOwnerSet, clientEmailSet, osherOwner, hostingOwner],
  );
  const clientSites = useMemo(
    () => (variant === 'admin'
      ? sites.filter((s) => {
          const owner = (s.owner || '').trim().toLowerCase();
          if (owner && owner === osherOwner) return false;
          return !isVisualDesignOwnSite(s, adminEmail || '', clientOwnerSet, clientEmailSet, hostingOwner);
        })
      : []),
    [variant, sites, adminEmail, clientOwnerSet, clientEmailSet, osherOwner, hostingOwner],
  );

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

  const showListToolbar = activeTab === 'meus' || activeTab === 'clientes' || activeTab === 'registados';

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

            <button
              type="button"
              onClick={() => void onRefresh?.()}
              title="Actualizar — vai buscar os dados mais recentes ao servidor"
              className={cn(panelBtnSecondary, 'shrink-0')}
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            {activeTab === 'meus' || activeTab === 'clientes' ? (
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

          <button
            type="button"
            onClick={() => void onRefresh?.()}
            title="Actualizar — vai buscar os dados mais recentes ao servidor"
            className={cn(panelBtnSecondary, 'shrink-0')}
          >
            <RefreshCw className="h-4 w-4" />
          </button>

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
          sites={ownSites}
          packages={packages}
          onRefresh={onRefresh}
          onCreateEmail={onCreateEmail}
          onNavigate={onNavigate}
          hubMode
          hubPanel="list"
          // 'hosting' só mostrava domínios com alojamento — domínios comprados
          // sozinhos (registrar-only, ex: compra directa no carrinho sem hosting)
          // ficavam invisíveis mesmo para o admin. 'all' junta as duas listas.
          domainListMode="all"
          registrarScope="mine"
          isActive={isActive}
          listSearch={listSearch}
          onListSearchChange={setListSearch}
          onFilteredCountChange={setFilteredCount}
        />
      ) : null}

      {activeTab === 'clientes' ? (
        <DomainManagerSection
          sites={clientSites}
          packages={packages}
          onRefresh={onRefresh}
          onCreateEmail={onCreateEmail}
          onNavigate={onNavigate}
          hubMode
          hubPanel="list"
          domainListMode="all"
          registrarScope="clients"
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
