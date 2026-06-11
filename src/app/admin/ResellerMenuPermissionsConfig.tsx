'use client';

import React, { useEffect, useState } from 'react';
import { Shield, Save, CheckCircle2, ChevronDown } from 'lucide-react';
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

function IosToggle({
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
      <span className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-indigo-600 peer-focus:outline-none" />
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
    <div className="border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-expanded={open}
              onClick={() => setOpen((prev) => !prev)}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <span className="w-6" />
          )}
          <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
        </div>
        <IosToggle checked={checked} disabled={disabled} onChange={onToggle} />
      </div>
      {hasChildren && open && (
        <div className="space-y-1 border-t border-gray-50 bg-gray-50/60 px-4 py-2">
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
    <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2">
      <p className="pl-6 text-sm text-gray-700">{title}</p>
      <IosToggle checked={checked} disabled={disabled} onChange={onChange} />
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const merged = resolveResellerMenuPrivileges(privileges);
      await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'reseller',
          permissions: { menuPrivileges: merged },
        }),
      });
      setSavedStatus(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-10 flex justify-center text-gray-500">A carregar configurações...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Painel do Revendedor</h2>
            </div>
            <p className="text-sm text-gray-600 max-w-2xl">
              Active ou desactive itens do menu lateral do revendedor (excepto o Dashboard, que fica sempre visível).
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold transition-all disabled:opacity-70 shrink-0"
          >
            {saving ? (
              'A Guardar...'
            ) : savedStatus ? (
              <><CheckCircle2 className="w-4 h-4" /> Guardado!</>
            ) : (
              <><Save className="w-4 h-4" /> Guardar Alterações</>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Menu do revendedor</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Mesma estrutura do painel admin. Desactivar um grupo desliga todos os submenus.
          </p>
        </div>
        <div>
          {RESELLER_PRIVILEGE_MENU_DEFS.map((item) => {
            const children = item.subItems?.filter((sub) => !isHeader(sub.id));
            const parentEnabled = privileges.reseller?.[item.id] !== false;

            return (
              <MenuPrivilegeGroup
                key={item.id}
                title={RESELLER_PRIVILEGE_MENU_LABELS[item.id] || item.label}
                checked={parentEnabled}
                onToggle={(enabled) =>
                  setPrivileges((prev) => patchResellerMenuToggle(prev, item.id, enabled))
                }
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
                    onChange={(enabled) =>
                      setPrivileges((prev) =>
                        patchResellerSubToggle(prev, item.id, child.id, enabled),
                      )
                    }
                  />
                ))}
              </MenuPrivilegeGroup>
            );
          })}
        </div>
      </div>
    </div>
  );
}
