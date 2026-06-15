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
  DaCheckboxRow,
  DaFormRow,
  DaLimitRow,
  DaPolicyRow,
  DaSectionTitle,
} from '@/lib/panel-da-form-rows';
import { panelField } from '@/lib/panel-ui';

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

      <section>
        {FEATURE_ROWS.map(([key, label]) => (
          <DaCheckboxRow
            key={key}
            label={label}
            checked={form.features[key]}
            onChange={(v) => setFeature(key, v)}
          />
        ))}

        <DaFormRow label="Skin" showUnlimited={false}>
          <select
            value={form.skin}
            onChange={(e) => onChange({ ...form, skin: e.target.value })}
            className={`${panelField} min-w-0 flex-1`}
          >
            <option value="evolution">Evolution</option>
            <option value="enhanced">Enhanced</option>
          </select>
        </DaFormRow>
      </section>

      <DaSectionTitle>Conjunto de recursos</DaSectionTitle>
      <section>
        <DaPolicyRow label="Política">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="feature-set-policy"
              checked={form.featureSets.policy === 'all'}
              onChange={() => onChange({ ...form, featureSets: { ...form.featureSets, policy: 'all' } })}
            />
            Permitir todos os comandos
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="feature-set-policy"
              checked={form.featureSets.policy === 'selected'}
              onChange={() => onChange({ ...form, featureSets: { ...form.featureSets, policy: 'selected' } })}
            />
            Permitir recursos seleccionados
          </label>
        </DaPolicyRow>

        {form.featureSets.policy === 'selected' && (
          <DaFormRow label="Conjunto" showUnlimited={false}>
            <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
              {Object.entries(FEATURE_SET_OPTIONS).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
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
                  {label}
                </label>
              ))}
            </div>
          </DaFormRow>
        )}
      </section>

      <DaSectionTitle>Permitir/bloquear Plugins</DaSectionTitle>
      <section>
        <DaPolicyRow label="Política">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="plugin-policy"
              checked={form.pluginPolicy.mode === 'allow_all'}
              onChange={() => onChange({ ...form, pluginPolicy: { ...form.pluginPolicy, mode: 'allow_all' } })}
            />
            Permitir todos
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="plugin-policy"
              checked={form.pluginPolicy.mode === 'deny_selected'}
              onChange={() => onChange({ ...form, pluginPolicy: { ...form.pluginPolicy, mode: 'deny_selected' } })}
            />
            Bloquear seleccionados
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="plugin-policy"
              checked={form.pluginPolicy.mode === 'allow_selected'}
              onChange={() => onChange({ ...form, pluginPolicy: { ...form.pluginPolicy, mode: 'allow_selected' } })}
            />
            Permitir seleccionados
          </label>
        </DaPolicyRow>
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
