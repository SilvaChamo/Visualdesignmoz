'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Shield, Save, CheckCircle2, ChevronDown } from 'lucide-react';
import {
  panelBtnPrimary,
  panelMenuGroupBody,
  panelMenuGroupCard,
  panelMenuGroupHeader,
  panelMenuSubRow,
  panelSectionCard,
  panelSectionIconBadge,
  panelSectionPadding,
  panelTabBar,
  panelTabBtn,
  panelTabBtnActive,
  panelTabBtnInactive,
  panelTabList,
} from '@/lib/panel-ui';
import { dispatchPanelMenuPrivilegesUpdated } from '@/hooks/usePanelMenuPrivileges';
import {
  RESELLER_PRIVILEGE_MENU_DEFS,
  RESELLER_PRIVILEGE_MENU_LABELS,
  defaultManagerMenuPrivileges,
  defaultResellerMenuPrivileges,
  menuSubPrivilegeKey,
  patchResellerMenuToggle,
  patchResellerSubToggle,
  resolveManagerMenuPrivileges,
  resolveResellerMenuPrivileges,
  type ResellerMenuPrivilegesConfig,
} from '@/lib/panel-menu-privileges';
import { isMenuHeaderSubItem as isHeader } from '@/lib/panel-admin-menu';
import {
  readPanelMenuPrivilegesCache,
  writePanelMenuPrivilegesCache,
  type PanelMenuPrivilegesRole,
} from '@/lib/panel-menu-privileges-cache';

type PanelTab = PanelMenuPrivilegesRole;

const PANEL_TABS: { id: PanelTab; label: string; description: string }[] = [
  {
    id: 'reseller',
    label: 'Revendedor',
    description:
      'Active ou desactive itens do menu lateral do painel. O Dashboard de cada painel fica sempre disponível por defeito.',
  },
  {
    id: 'manager',
    label: 'Profissional',
    description:
      'Active ou desactive itens do menu lateral do painel profissional. O Dashboard de cada painel fica sempre disponível por defeito.',
  },
];

function resolveForTab(tab: PanelTab, raw?: ResellerMenuPrivilegesConfig | null) {
  return tab === 'manager' ? resolveManagerMenuPrivileges(raw) : resolveResellerMenuPrivileges(raw);
}

function defaultsForTab(tab: PanelTab) {
  return tab === 'manager' ? defaultManagerMenuPrivileges() : defaultResellerMenuPrivileges();
}

function PanelToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center ${disabled ? 'opacity-40' : ''}`}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-red-600 peer-focus:outline-none dark:bg-zinc-700" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </label>
  );
}

function MenuPrivilegeGroup({
  title,
  checked,
  onToggle,
  children,
  disabled = false,
  isOpen,
  onOpenChange,
}: {
  title: string;
  checked: boolean;
  onToggle: (enabled: boolean) => void;
  children?: React.ReactNode;
  disabled?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hasChildren = React.Children.count(children) > 0;

  return (
    <div className={panelMenuGroupCard}>
      <div className={`${panelMenuGroupHeader}${!isOpen || !hasChildren ? ' border-b-0' : ''}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              className="rounded p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              aria-expanded={isOpen}
              onClick={() => onOpenChange(!isOpen)}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <span className="w-6" />
          )}
          <p className="truncate text-sm font-bold text-gray-900 dark:text-zinc-100">{title}</p>
        </div>
        <PanelToggle checked={checked} disabled={disabled} onChange={onToggle} />
      </div>
      {hasChildren && isOpen ? (
        <div className={panelMenuGroupBody}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function SubToggleRow({
  title,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className={panelMenuSubRow}>
      <p className="pl-6 text-sm text-gray-700 dark:text-zinc-300">{title}</p>
      <PanelToggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

export function ResellerMenuPermissionsConfig() {
  const [activeTab, setActiveTab] = useState<PanelTab>('reseller');
  const [privilegesByTab, setPrivilegesByTab] = useState<Record<PanelTab, ResellerMenuPrivilegesConfig>>(() => ({
    reseller:
      readPanelMenuPrivilegesCache('reseller') ?? defaultResellerMenuPrivileges(),
    manager:
      readPanelMenuPrivilegesCache('manager') ?? defaultManagerMenuPrivileges(),
  }));
  const [loading, setLoading] = useState<Record<PanelTab, boolean>>({
    reseller: readPanelMenuPrivilegesCache('reseller') === null,
    manager: readPanelMenuPrivilegesCache('manager') === null,
  });
  const [saving, setSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState(false);
  const [expandedMenuId, setExpandedMenuId] = useState<string | null>(null);

  const privileges = privilegesByTab[activeTab];
  const activeTabMeta = PANEL_TABS.find((tab) => tab.id === activeTab)!;

  const refreshPrivileges = useCallback(async (tab: PanelTab) => {
    setLoading((prev) => ({ ...prev, [tab]: true }));
    try {
      const res = await fetch(`/api/admin/permissions?role=${tab}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const raw = data?.permissions?.menuPrivileges as ResellerMenuPrivilegesConfig | undefined;
      const merged = resolveForTab(tab, raw);
      setPrivilegesByTab((prev) => ({ ...prev, [tab]: merged }));
      writePanelMenuPrivilegesCache(tab, merged);
    } catch {
      /* manter cache / estado actual */
    } finally {
      setLoading((prev) => ({ ...prev, [tab]: false }));
    }
  }, []);

  useEffect(() => {
    void refreshPrivileges('reseller');
    void refreshPrivileges('manager');
  }, [refreshPrivileges]);

  const markDirty = () => setSavedStatus(false);

  const renderPrivilegeGroup = (item: (typeof RESELLER_PRIVILEGE_MENU_DEFS)[number]) => {
    const children = item.subItems?.filter((sub) => !isHeader(sub.id));
    const parentEnabled = privileges.reseller?.[item.id] !== false;
    const isOpen = expandedMenuId === item.id;

    return (
      <MenuPrivilegeGroup
        key={item.id}
        title={RESELLER_PRIVILEGE_MENU_LABELS[item.id] || item.label}
        checked={parentEnabled}
        isOpen={isOpen}
        onOpenChange={(open) => {
          setExpandedMenuId(open ? item.id : null);
        }}
        onToggle={(enabled) => {
          markDirty();
          setPrivilegesByTab((prev) => ({
            ...prev,
            [activeTab]: patchResellerMenuToggle(prev[activeTab], item.id, enabled),
          }));
        }}
      >
        {children?.map((child) => (
          <SubToggleRow
            key={child.id}
            title={child.label}
            checked={
              parentEnabled &&
              privileges.resellerSub?.[menuSubPrivilegeKey(item.id, child.id)] !== false
            }
            disabled={!parentEnabled}
            onChange={(enabled) => {
              markDirty();
              setPrivilegesByTab((prev) => ({
                ...prev,
                [activeTab]: patchResellerSubToggle(prev[activeTab], item.id, child.id, enabled),
              }));
            }}
          />
        ))}
      </MenuPrivilegeGroup>
    );
  };

  const leftColumnItems = RESELLER_PRIVILEGE_MENU_DEFS.filter((_, index) => index % 2 === 0);
  const rightColumnItems = RESELLER_PRIVILEGE_MENU_DEFS.filter((_, index) => index % 2 === 1);

  const handleSave = async () => {
    setSaving(true);
    try {
      const merged = resolveForTab(activeTab, privileges);
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: activeTab,
          permissions: { menuPrivileges: merged },
        }),
      });
      if (!res.ok) throw new Error('save failed');
      setPrivilegesByTab((prev) => ({ ...prev, [activeTab]: merged }));
      writePanelMenuPrivilegesCache(activeTab, merged);
      setSavedStatus(true);
      dispatchPanelMenuPrivilegesUpdated(activeTab);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading.reseller && loading.manager) {
    return (
      <div className="font-panel flex justify-center p-10 text-sm text-gray-500 dark:text-zinc-400">
        A carregar configurações…
      </div>
    );
  }

  return (
    <div className="space-y-6 font-panel">
      <div className={panelSectionCard}>
        <div
          className={`${panelSectionPadding} flex flex-col gap-4 border-b border-gray-100 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between`}
        >
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className={panelSectionIconBadge}>
                <Shield className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
                Painéis Revendedor e Profissional
              </h2>
            </div>
            <p className="max-w-2xl text-sm text-gray-600 dark:text-zinc-400">
              {activeTabMeta.description}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`${panelBtnPrimary} shrink-0`}
          >
            {saving ? (
              'A guardar…'
            ) : savedStatus ? (
              <><CheckCircle2 className="h-4 w-4" /> Guardado</>
            ) : (
              <><Save className="h-4 w-4" /> Guardar alterações</>
            )}
          </button>
        </div>

        <div className={panelTabBar}>
          <nav className={`${panelTabList} ${panelSectionPadding} pb-0`} aria-label="Tipo de painel">
            {PANEL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setExpandedMenuId(null);
                  setSavedStatus(false);
                }}
                className={`${panelTabBtn} relative font-bold ${
                  activeTab === tab.id ? panelTabBtnActive : panelTabBtnInactive
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className={panelSectionPadding}>
          {loading[activeTab] ? (
            <div className="flex justify-center py-10 text-sm text-gray-500 dark:text-zinc-400">
              A carregar…
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 lg:hidden">
                {RESELLER_PRIVILEGE_MENU_DEFS.map(renderPrivilegeGroup)}
              </div>
              <div className="hidden items-start gap-4 lg:flex">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  {leftColumnItems.map(renderPrivilegeGroup)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  {rightColumnItems.map(renderPrivilegeGroup)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
