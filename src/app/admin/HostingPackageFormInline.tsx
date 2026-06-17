'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Package } from 'lucide-react';
import {
  applyHostingPlanPreset,
  createEmptyResellerPackageForm,
  HOSTING_PLAN_PRESETS,
  inferHostingPlanPresetId,
  RESELLER_LIMIT_LABELS,
  type HostingPlanPresetId,
  type HostingPlanPreset,
  type ResellerLimitField,
  type ResellerPackageFormState,
} from '@/lib/reseller-package-form';
import { panelBtnPrimary, panelBtnSecondary, panelField } from '@/lib/panel-ui';
import { HostingDaPackageFields } from '@/app/admin/HostingDaPackageFields';

/** Mesmo arredondamento da lista de contas (`rounded`, não `rounded-xl`). */
const formCardCls =
  'rounded border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900';

type Props = {
  form: ResellerPackageFormState;
  onChange: (next: ResellerPackageFormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
  busy?: boolean;
  mode?: 'create' | 'edit';
};

const STAT_LIMIT_KEYS: ResellerLimitField[] = [
  'nemails',
  'mysql',
  'domainptr',
  'vdomains',
  'quota',
  'bandwidth',
  'ftp',
  'nsubdomains',
  'nemailml',
];

function formatStatValue(row: { value: string; unlimited: boolean }, unit?: string): string {
  if (row.unlimited) return 'Ilimitado';
  const raw = row.value.trim() || '0';
  if (!unit) return raw;
  if (unit !== 'MB') return `${raw} ${unit}`;
  if (/[a-z]/i.test(raw)) return raw;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 1024) return `${raw} MB`;
  const gb = amount / 1024;
  const display = Number.isInteger(gb) ? String(gb) : gb.toFixed(1).replace(/\.0$/, '');
  return `${display} GB`;
}

function dnsLabel(dns: ResellerPackageFormState['features']['dns']): string {
  if (dns === 'TWO') return '2 servidores';
  if (dns === 'THREE') return '3 servidores';
  return 'Desactivado';
}

function pluginPolicyLabel(form: ResellerPackageFormState): string {
  if (form.pluginPolicy.mode === 'allow_all') return 'Permitir todos';
  if (form.pluginPolicy.mode === 'deny_selected') return 'Bloquear seleccionados';
  return 'Permitir seleccionados';
}

function CpanelInfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 px-4 py-3 last:border-b-0 dark:border-zinc-800">
      <dt className="text-xs text-gray-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}

function CpanelSidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={`${formCardCls} overflow-hidden`}>
      <div className="border-b border-gray-200 px-4 py-3 dark:border-zinc-700">
        <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">{title}</h3>
      </div>
      <dl>{children}</dl>
    </div>
  );
}

function PackageSidebar({ form, selectedPreset }: { form: ResellerPackageFormState; selectedPreset: HostingPlanPreset | null }) {
  const enabledFeatures = useMemo(
    () =>
      [
        form.features.php && 'PHP',
        form.features.ssl && 'SSL',
        form.features.spam && 'Anti-spam',
        form.features.cron && 'Cron',
        form.features.wordpress && 'WordPress',
        form.features.git && 'Git',
        form.features.ssh && 'SSH',
        form.features.redis && 'Redis',
      ].filter(Boolean),
    [form.features],
  );

  return (
    <aside className="sticky top-0 flex w-full shrink-0 flex-col gap-4 lg:w-72">
      <CpanelSidebarCard title="Informação geral">
        <CpanelInfoRow label="Nome do pacote" value={form.packageName.trim() || '—'} />
        <CpanelInfoRow label="Domínio associado" value={form.ownerDomain.trim() || '—'} />
        <CpanelInfoRow label="Plano base" value={selectedPreset?.label || 'Não seleccionado'} />
        <CpanelInfoRow
          label="Custo mensal"
          value={selectedPreset?.monthlyPriceMzn ? `${selectedPreset.monthlyPriceMzn} MT` : '—'}
        />
        <CpanelInfoRow label="Skin" value={form.appearanceMode === 'dark' ? 'Escuro' : 'Claro'} />
        <CpanelInfoRow label="DNS" value={dnsLabel(form.features.dns)} />
        <CpanelInfoRow label="IPs dedicados" value={form.features.ips || '0'} />
        <CpanelInfoRow
          label="Conjunto de recursos"
          value={
            form.featureSets.policy === 'all'
              ? 'Todos os comandos'
              : `${form.featureSets.selected.length} seleccionado(s)`
          }
        />
        <CpanelInfoRow label="Plugins" value={pluginPolicyLabel(form)} />
        <CpanelInfoRow
          label="Funcionalidades activas"
          value={
            enabledFeatures.length ? (
              <span className="text-xs leading-relaxed">{enabledFeatures.join(' · ')}</span>
            ) : (
              'Nenhuma'
            )
          }
        />
      </CpanelSidebarCard>

      <CpanelSidebarCard title="Limites do pacote">
        {STAT_LIMIT_KEYS.map((key) => (
          <CpanelInfoRow
            key={key}
            label={RESELLER_LIMIT_LABELS[key]}
            value={formatStatValue(
              form.limits[key],
              key === 'quota' || key === 'bandwidth' ? 'MB' : undefined,
            )}
          />
        ))}
      </CpanelSidebarCard>
    </aside>
  );
}

export function HostingPackageFormInline({ form, onChange, onCancel, onSubmit, busy, mode = 'create' }: Props) {
  const isEdit = mode === 'edit';
  const [selectedPreset, setSelectedPreset] = useState<HostingPlanPresetId | ''>('');
  const hasInitializedCreateMode = useRef(false);
  const selectedPresetMeta = useMemo(
    () => HOSTING_PLAN_PRESETS.find((preset) => preset.id === selectedPreset) || null,
    [selectedPreset],
  );

  useEffect(() => {
    if (isEdit) return;
    if (selectedPreset) return;
    if (hasInitializedCreateMode.current) return;
    hasInitializedCreateMode.current = true;
    onChange(createEmptyResellerPackageForm(form.packageName || ''));
  }, [form.packageName, isEdit, onChange, selectedPreset]);

  useEffect(() => {
    if (selectedPreset) return;
    const inferred = inferHostingPlanPresetId(form);
    if (inferred) setSelectedPreset(inferred);
  }, [form, selectedPreset]);

  const canSubmit = isEdit
    ? Boolean(form.packageName.trim())
    : Boolean(form.packageName.trim() && form.ownerDomain.trim() && selectedPreset);

  const applyPreset = (presetId: HostingPlanPresetId | '') => {
    if (!presetId) {
      if (!isEdit) onChange(createEmptyResellerPackageForm(form.packageName || ''));
      return;
    }
    const preset = HOSTING_PLAN_PRESETS.find((row) => row.id === presetId);
    const next = applyHostingPlanPreset(presetId, {
      current: form,
      keepCurrentPackageName: isEdit,
    });
    if (!next) return;
    onChange({
      ...next,
      packageName: isEdit ? form.packageName : preset?.defaultPackageName || next.packageName,
      ownerDomain: form.ownerDomain,
      packageMode: isEdit ? form.packageMode : next.packageMode,
    });
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className={`min-w-0 flex-1 p-6 ${formCardCls}`}>
        <h2 className="mb-4 text-sm font-bold text-gray-900 dark:text-zinc-100">
          {isEdit ? 'Editar pacote de hospedagem' : 'Criar pacote de hospedagem'}
        </h2>

        <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-300">
            Modelo de plano
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={selectedPreset}
              onChange={(e) => {
                const presetId = e.target.value as HostingPlanPresetId | '';
                setSelectedPreset(presetId);
                applyPreset(presetId);
              }}
              className={`${panelField} w-full sm:flex-1`}
            >
              <option value="">Seleccionar plano base...</option>
              {HOSTING_PLAN_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <HostingDaPackageFields form={form} onChange={onChange} showPackageName packageNameReadonly={isEdit} />

        <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-zinc-800">
          <button type="button" onClick={onCancel} disabled={busy} className={panelBtnSecondary}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !canSubmit}
            className={panelBtnPrimary}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            {busy ? 'A guardar…' : isEdit ? 'Guardar alterações' : 'Criar pacote'}
          </button>
        </div>
      </div>

      <PackageSidebar form={form} selectedPreset={selectedPresetMeta} />
    </div>
  );
}
