'use client';

import {
  FEATURE_SET_OPTIONS,
  RESELLER_LIMIT_LABELS,
  RESELLER_RESOURCE_LABELS,
  type ResellerLimitField,
  type ResellerPackageFormState,
  type ResellerResourceField,
} from '@/lib/reseller-package-form';
import {
  DaFormRow,
  DaLimitRow,
  DaSectionTitle,
} from '@/lib/panel-da-form-rows';
import { panelField } from '@/lib/panel-ui';

/** Mesmo arredondamento da lista de contas (`rounded`, não `rounded-xl`). */
const formCardCls =
  'rounded border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900';

const sectionRule = 'border-gray-200 dark:border-zinc-700';

type Props = {
  form: ResellerPackageFormState;
  onChange: (next: ResellerPackageFormState) => void;
  showPackageName?: boolean;
  packageNameReadonly?: boolean;
};

const FEATURE_ROWS = [
  ['aftp', 'Contas FTP anónimas'],
  ['cgi', 'Acesso CGI'],
  ['git', 'Git (versionamento)'],
  ['wordpress', 'WordPress'],
  ['clamav', 'Antivírus (ClamAV)'],
  ['php', 'Acesso PHP'],
  ['spam', 'Anti-spam (SpamAssassin)'],
  ['catchall', 'Capturar e-mails incorrectos'],
  ['ssl', 'Gerir SSL'],
  ['ssh', 'Acesso SSH'],
  ['cron', 'Tarefas Cron'],
  ['redis', 'Cache Redis'],
  ['sysinfo', 'Informações do sistema'],
  ['login_keys', 'Chaves de acesso'],
  ['dnscontrol', 'Controlo de DNS'],
  ['suspend_at_limit', 'Suspender ao atingir algum limite'],
  ['auto_security_txt', 'security.txt automático (RFC9116)'],
  ['jail', 'Protegido em sistema de jaula (jailshell)'],
] as const;

export function HostingDaPackageFields({ form, onChange, showPackageName = true, packageNameReadonly = false }: Props) {
  const setLimit = (key: ResellerLimitField, row: { value: string; unlimited: boolean }) => {
    onChange({ ...form, limits: { ...form.limits, [key]: row } });
  };

  const setResource = (key: ResellerResourceField, row: { value: string; unlimited: boolean }) => {
    onChange({ ...form, resources: { ...form.resources, [key]: row } });
  };

  const setFeature = (key: keyof ResellerPackageFormState['features'], value: boolean) => {
    onChange({ ...form, features: { ...form.features, [key]: value } });
  };

  return (
    <>
      <section>
        {(Object.keys(RESELLER_LIMIT_LABELS) as ResellerLimitField[]).map((key) => (
          <DaLimitRow
            key={key}
            label={RESELLER_LIMIT_LABELS[key]}
            row={form.limits[key]}
            onChange={(row) => setLimit(key, row)}
            withUnit={key === 'bandwidth' || key === 'quota'}
          />
        ))}
      </section>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-zinc-400">
            Domínio associado
          </label>
          <input
            value={form.ownerDomain}
            onChange={(e) => onChange({ ...form, ownerDomain: e.target.value })}
            placeholder="cliente.com"
            className={`${panelField} w-full`}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-zinc-400">Skin</label>
          <select
            value={form.appearanceMode}
            onChange={(e) => onChange({ ...form, appearanceMode: e.target.value as 'light' | 'dark' })}
            className={`${panelField} w-full`}
          >
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
          </select>
        </div>
      </div>

      <div className={`mb-4 p-4 ${formCardCls}`}>
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-300">
          Funcionalidades
        </p>
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_ROWS.map(([key, label]) => (
            <label
              key={key}
              className="flex min-h-[34px] items-center gap-2 text-sm text-gray-700 dark:text-zinc-200"
            >
              <input
                type="checkbox"
                className="shrink-0"
                checked={form.features[key]}
                onChange={(e) => setFeature(key, e.target.checked)}
              />
              <span className="truncate whitespace-nowrap">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <section className={`mb-4 border-t border-b ${sectionRule} py-4`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-300">
            Conjunto de recursos
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2 text-gray-700 dark:text-zinc-200">
              <input
                type="radio"
                name="feature-set-policy"
                checked={form.featureSets.policy === 'all'}
                onChange={() => onChange({ ...form, featureSets: { ...form.featureSets, policy: 'all' } })}
              />
              <span className="truncate whitespace-nowrap">Permitir todos os comandos</span>
            </label>
            <label className="flex items-center gap-2 text-gray-700 dark:text-zinc-200">
              <input
                type="radio"
                name="feature-set-policy"
                checked={form.featureSets.policy === 'selected'}
                onChange={() => onChange({ ...form, featureSets: { ...form.featureSets, policy: 'selected' } })}
              />
              <span className="truncate whitespace-nowrap">Permitir recursos seleccionados</span>
            </label>
          </div>
          {form.featureSets.policy === 'selected' && (
            <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 text-sm dark:border-zinc-800">
              {Object.entries(FEATURE_SET_OPTIONS).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-gray-700 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={form.featureSets.selected.includes(value)}
                    onChange={(e) => {
                      const selected = e.target.checked
                        ? [...form.featureSets.selected, value]
                        : form.featureSets.selected.filter((x) => x !== value);
                      onChange({ ...form, featureSets: { ...form.featureSets, selected } });
                    }}
                  />
                  <span className="truncate whitespace-nowrap">{label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-300">
            Permitir/bloquear Plugins
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2 text-gray-700 dark:text-zinc-200">
              <input
                type="radio"
                name="plugin-policy"
                checked={form.pluginPolicy.mode === 'allow_all'}
                onChange={() => onChange({ ...form, pluginPolicy: { ...form.pluginPolicy, mode: 'allow_all' } })}
              />
              <span className="truncate whitespace-nowrap">Permitir todos</span>
            </label>
            <label className="flex items-center gap-2 text-gray-700 dark:text-zinc-200">
              <input
                type="radio"
                name="plugin-policy"
                checked={form.pluginPolicy.mode === 'deny_selected'}
                onChange={() => onChange({ ...form, pluginPolicy: { ...form.pluginPolicy, mode: 'deny_selected' } })}
              />
              <span className="truncate whitespace-nowrap">Bloquear seleccionados</span>
            </label>
            <label className="flex items-center gap-2 text-gray-700 dark:text-zinc-200">
              <input
                type="radio"
                name="plugin-policy"
                checked={form.pluginPolicy.mode === 'allow_selected'}
                onChange={() => onChange({ ...form, pluginPolicy: { ...form.pluginPolicy, mode: 'allow_selected' } })}
              />
              <span className="truncate whitespace-nowrap">Permitir seleccionados</span>
            </label>
          </div>
        </div>
        </div>
      </section>

      <DaSectionTitle>Limites de recursos</DaSectionTitle>
      <section>
        {(Object.keys(RESELLER_RESOURCE_LABELS) as ResellerResourceField[]).map((key) => (
          <DaLimitRow
            key={key}
            label={RESELLER_RESOURCE_LABELS[key]}
            row={form.resources[key]}
            onChange={(row) => setResource(key, row)}
          />
        ))}
      </section>

      {showPackageName && (
        <DaFormRow label="Nome do pacote" showUnlimited={false}>
          <input
            value={form.packageName}
            onChange={(e) => onChange({ ...form, packageName: e.target.value })}
            placeholder="newpackage"
            readOnly={packageNameReadonly}
            className={`${panelField} min-w-0 flex-1${packageNameReadonly ? ' cursor-default opacity-70' : ''}`}
          />
        </DaFormRow>
      )}
    </>
  );
}
