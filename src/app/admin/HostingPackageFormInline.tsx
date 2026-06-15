'use client';

import type { ReactNode } from 'react';
import { Loader2, Package } from 'lucide-react';
import {
  RESELLER_RESOURCE_LABELS,
  type ResellerLimitField,
  type ResellerPackageFormState,
  type ResellerResourceField,
} from '@/lib/reseller-package-form';
import { panelBtnPrimary, panelBtnSecondary, panelField } from '@/lib/panel-ui';

const LIMIT_LABELS_DA: Record<ResellerLimitField, string> = {
  bandwidth: 'Tráfego',
  quota: 'Espaço em disco',
  inode: 'N.º de ficheiros (inodes)',
  vdomains: 'Domínios',
  nsubdomains: 'Subdomínios',
  nemails: 'Contas de e-mail',
  nemailf: 'Encaminhamentos de e-mail',
  nemailml: 'Listas de discussão',
  nemailr: 'Respostas automáticas',
  mysql: 'Bases de dados MySQL',
  domainptr: 'Domínios alternativos',
  ftp: 'Contas FTP',
  nusers: 'Contas de utilizadores',
};

type Props = {
  form: ResellerPackageFormState;
  onChange: (next: ResellerPackageFormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
  busy?: boolean;
};

function DaRow({
  label,
  children,
  unlimited,
  onUnlimitedChange,
  showUnlimited = true,
}: {
  label: string;
  children: ReactNode;
  unlimited?: boolean;
  onUnlimitedChange?: (v: boolean) => void;
  showUnlimited?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0 dark:border-zinc-800">
      <span className="w-56 shrink-0 whitespace-nowrap text-sm text-gray-800 dark:text-zinc-200">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {showUnlimited ? (
        <label className="flex w-28 shrink-0 items-center justify-end gap-2 whitespace-nowrap text-xs text-gray-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => onUnlimitedChange?.(e.target.checked)}
          />
          Ilimitado
        </label>
      ) : (
        <span className="w-28 shrink-0" />
      )}
    </div>
  );
}

function LimitValueInput({
  row,
  onChange,
  withUnit,
}: {
  row: { value: string; unlimited: boolean };
  onChange: (next: { value: string; unlimited: boolean }) => void;
  withUnit?: boolean;
}) {
  return (
    <>
      {withUnit && (
        <select className={`${panelField} w-20 shrink-0`} defaultValue="MB" aria-label="Unidade">
          <option value="MB">MB</option>
        </select>
      )}
      <input
        type="text"
        value={row.value}
        disabled={row.unlimited}
        onChange={(e) => onChange({ ...row, value: e.target.value })}
        className={`${panelField} min-w-0 flex-1 disabled:opacity-50`}
      />
    </>
  );
}

export function HostingPackageFormInline({ form, onChange, onCancel, onSubmit, busy }: Props) {
  const setLimit = (key: ResellerLimitField, row: { value: string; unlimited: boolean }) => {
    onChange({ ...form, limits: { ...form.limits, [key]: row } });
  };

  const setResource = (key: ResellerResourceField, row: { value: string; unlimited: boolean }) => {
    onChange({ ...form, resources: { ...form.resources, [key]: row } });
  };

  return (
    <div className="rounded border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-bold text-gray-900 dark:text-zinc-100">Criar pacote de hospedagem</h2>

      <section>
        {(Object.keys(LIMIT_LABELS_DA) as ResellerLimitField[]).map((key) => (
          <DaRow
            key={key}
            label={LIMIT_LABELS_DA[key]}
            unlimited={form.limits[key].unlimited}
            onUnlimitedChange={(v) => setLimit(key, { ...form.limits[key], unlimited: v })}
          >
            <LimitValueInput
              row={form.limits[key]}
              onChange={(row) => setLimit(key, row)}
              withUnit={key === 'bandwidth' || key === 'quota'}
            />
          </DaRow>
        ))}
      </section>

      <section className="mt-6 border-t border-gray-100 pt-2 dark:border-zinc-800">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Funcionalidades</h3>
        {(
          [
            ['cgi', 'Acesso CGI'],
            ['git', 'Git (versionamento)'],
            ['wordpress', 'WordPress'],
            ['php', 'Acesso PHP'],
            ['spam', 'Anti-spam'],
            ['catchall', 'Capturar e-mails incorrectos'],
            ['ssl', 'Gerir SSL'],
            ['ssh', 'Acesso SSH'],
            ['userssh', 'Acesso SSH para utilizadores'],
            ['oversell', 'Permitir overselling'],
            ['cron', 'Tarefas Cron'],
            ['sysinfo', 'Informações do sistema'],
            ['login_keys', 'Chaves de acesso'],
            ['dnscontrol', 'Controlo de DNS'],
            ['serverip', 'Partilhar IP do servidor'],
            ['aftp', 'Contas FTP anónimas'],
          ] as const
        ).map(([key, label]) => (
          <div
            key={key}
            className="flex items-center gap-3 border-b border-gray-100 py-3 dark:border-zinc-800"
          >
            <span className="w-56 shrink-0 whitespace-nowrap text-sm text-gray-800 dark:text-zinc-200">{label}</span>
            <span className="flex-1" />
            <div className="flex w-28 shrink-0 justify-end">
              <input
                type="checkbox"
                checked={form.features[key]}
                onChange={(e) =>
                  onChange({ ...form, features: { ...form.features, [key]: e.target.checked } })
                }
              />
            </div>
          </div>
        ))}

        <div className="border-b border-gray-100 py-3 dark:border-zinc-800">
          <p className="mb-2 text-sm text-gray-800 dark:text-zinc-200">DNS personalizado</p>
          {(
            [
              ['OFF', 'Nenhum'],
              ['TWO', "Usa 2 IP's, o domínio usa um deles"],
              ['THREE', "Usa 3 IP's, o domínio recebe o próprio IP"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="mb-1 flex items-center gap-2 pl-52 text-sm">
              <input
                type="radio"
                name="pkg-dns-inline"
                checked={form.features.dns === value}
                onChange={() => onChange({ ...form, features: { ...form.features, dns: value } })}
              />
              {label}
            </label>
          ))}
        </div>

        <DaRow label="IPs" showUnlimited={false}>
          <input
            value={form.features.ips}
            onChange={(e) => onChange({ ...form, features: { ...form.features, ips: e.target.value } })}
            className={`${panelField} min-w-0 flex-1`}
          />
        </DaRow>
      </section>

      <section className="mt-6 border-t border-gray-100 pt-2 dark:border-zinc-800">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Limites avançados</h3>
        {(Object.keys(RESELLER_RESOURCE_LABELS) as ResellerResourceField[]).map((key) => (
          <DaRow
            key={key}
            label={RESELLER_RESOURCE_LABELS[key]}
            unlimited={form.resources[key].unlimited}
            onUnlimitedChange={(v) => setResource(key, { ...form.resources[key], unlimited: v })}
          >
            <input
              type="text"
              value={form.resources[key].value}
              disabled={form.resources[key].unlimited}
              onChange={(e) => setResource(key, { ...form.resources[key], value: e.target.value })}
              className={`${panelField} min-w-0 flex-1 disabled:opacity-50`}
            />
          </DaRow>
        ))}
      </section>

      <DaRow label="Nome do pacote" showUnlimited={false}>
        <input
          value={form.packageName}
          onChange={(e) => onChange({ ...form, packageName: e.target.value })}
          placeholder="VisualDESIGN"
          className={`${panelField} min-w-0 flex-1`}
        />
      </DaRow>

      <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-zinc-800">
        <button type="button" onClick={onCancel} className={panelBtnSecondary}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !form.packageName.trim()}
          className={panelBtnPrimary}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          Criar pacote
        </button>
      </div>
    </div>
  );
}
