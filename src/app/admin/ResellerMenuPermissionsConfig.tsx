'use client';

import React, { useEffect, useState } from 'react';
import { Shield, Save, CheckCircle2, ChevronDown } from 'lucide-react';
import { panelBtnPrimary, panelCard } from '@/lib/panel-ui';
import { RESELLER_MENU_PRIVILEGES_EVENT } from '@/hooks/useResellerMenuPrivileges';
import {
  RESELLER_PRIVILEGE_MENU_DEFS,
  RESELLER_PRIVILEGE_MENU_LABELS,
  defaultResellerMenuPrivileges,
  menuSubPrivilegeKey,
  patchResellerMenuToggle,
  patchResellerSubToggle,
  resolveResellerMenuPrivileges,
  type ResellerMenuPrivilegesConfig,
} from '@/lib/panel-menu-privileges';
import { isMenuHeaderSubItem as isHeader } from '@/lib/panel-admin-menu';

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
}: {
  title: string;
  checked: boolean;
  onToggle: (enabled: boolean) => void;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  const hasChildren = React.Children.count(children) > 0;
  const [open, setOpen] = useState(false);

  return (
    <div className={`${panelCard} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-zinc-800">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              className="rounded p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              aria-expanded={open}
              onClick={() => setOpen((prev) => !prev)}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <span className="w-6" />
          )}
          <p className="truncate text-sm font-bold text-gray-900 dark:text-zinc-100">{title}</p>
        </div>
        <PanelToggle checked={checked} disabled={disabled} onChange={onToggle} />
      </div>
      {hasChildren && open && (
        <div className="space-y-0.5 px-2 py-2">
          {children}
        </div>
      )}
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
    <div className="flex items-center justify-between gap-3 rounded px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
      <p className="pl-6 text-sm text-gray-700 dark:text-zinc-300">{title}</p>
      <PanelToggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

export function ResellerMenuPermissionsConfig() {
  const [privileges, setPrivileges] = useState<ResellerMenuPrivilegesConfig>(
    defaultResellerMenuPrivileges(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState(false);

  useEffect(() => {
    fetch('/api/admin/permissions?role=reseller')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const raw = data?.permissions?.menuPrivileges as ResellerMenuPrivilegesConfig | undefined;
        setPrivileges(resolveResellerMenuPrivileges(raw));
      })
      .finally(() => setLoading(false));
  }, []);

  const markDirty = () => setSavedStatus(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const merged = resolveResellerMenuPrivileges(privileges);
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'reseller',
          permissions: { menuPrivileges: merged },
        }),
      });
      if (!res.ok) throw new Error('save failed');
      setPrivileges(merged);
      setSavedStatus(true);
      window.dispatchEvent(new Event(RESELLER_MENU_PRIVILEGES_EVENT));
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-10 text-sm text-gray-500 dark:text-zinc-400">A carregar configurações…</div>;
  }

  return (
    <div className="space-y-4">
      <div className={`${panelCard} p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/30">
                <Shield className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Painel do Revendedor</h2>
            </div>
            <p className="max-w-2xl text-sm text-gray-600 dark:text-zinc-400">
              Active ou desactive itens do menu lateral do revendedor. Ao desactivar, o item desaparece do painel (excepto o Dashboard, que fica sempre visível).
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
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {RESELLER_PRIVILEGE_MENU_DEFS.map((item) => {
          const children = item.subItems?.filter((sub) => !isHeader(sub.id));
          const parentEnabled = privileges.reseller?.[item.id] !== false;

          return (
            <MenuPrivilegeGroup
              key={item.id}
              title={RESELLER_PRIVILEGE_MENU_LABELS[item.id] || item.label}
              checked={parentEnabled}
              onToggle={(enabled) => {
                markDirty();
                setPrivileges((prev) => patchResellerMenuToggle(prev, item.id, enabled));
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
                    setPrivileges((prev) =>
                      patchResellerSubToggle(prev, item.id, child.id, enabled),
                    );
                  }}
                />
              ))}
            </MenuPrivilegeGroup>
          );
        })}
      </div>
    </div>
  );
}
