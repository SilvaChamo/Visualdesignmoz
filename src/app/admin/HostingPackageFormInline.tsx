'use client';

import { useMemo } from 'react';
import { Loader2, Package } from 'lucide-react';
import {
  RESELLER_LIMIT_LABELS,
  type ResellerLimitField,
  type ResellerPackageFormState,
} from '@/lib/reseller-package-form';
import { panelBtnPrimary, panelCard } from '@/lib/panel-ui';
import { HostingDaPackageFields } from '@/app/admin/HostingDaPackageFields';

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
  const v = row.value.trim() || '0';
  return unit ? `${v} ${unit}` : v;
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
    <div className={`${panelCard} overflow-hidden`}>
      <div className="border-b border-gray-200 px-4 py-3 dark:border-zinc-700">
        <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100">{title}</h3>
      </div>
      <dl>{children}</dl>
    </div>
  );
}

function PackageSidebar({ form }: { form: ResellerPackageFormState }) {
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
        <CpanelInfoRow label="Skin" value={<span className="capitalize">{form.skin || '—'}</span>} />
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

export function HostingPackageFormInline({ form, onChange, onSubmit, busy, mode = 'create' }: Props) {
  const isEdit = mode === 'edit';
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className={`min-w-0 flex-1 p-6 ${panelCard}`}>
        <h2 className="mb-4 text-sm font-bold text-gray-900 dark:text-zinc-100">
          {isEdit ? 'Editar pacote de hospedagem' : 'Criar pacote de hospedagem'}
        </h2>

        <HostingDaPackageFields form={form} onChange={onChange} showPackageName packageNameReadonly={isEdit} />

        <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !form.packageName.trim()}
            className={panelBtnPrimary}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            {isEdit ? 'Guardar alterações' : 'Criar pacote'}
          </button>
        </div>
      </div>

      <PackageSidebar form={form} />
    </div>
  );
}
