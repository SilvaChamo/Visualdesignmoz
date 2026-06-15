'use client';

import type { ReactNode } from 'react';
import { Eye, EyeOff, Loader2, RefreshCw, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DirectAdminPackage } from '@/lib/directadmin-api';
import { readPackagesCache, writePackagesCache } from '@/lib/panel-packages-cache';
import { panelBtnPrimary, panelBtnSecondary, panelField } from '@/lib/panel-ui';

type AccountType = 'client' | 'reseller' | 'admin';

type Props = {
  packages: DirectAdminPackage[];
  initialAccountType?: AccountType;
  onCancel: () => void;
  onComplete?: () => void;
};

function DaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-0 dark:border-zinc-800">
      <span className="w-52 shrink-0 whitespace-nowrap text-sm text-gray-800 dark:text-zinc-200">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

function generatePassword(length = 16): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function ProvisionAccountFormInline({
  packages: packagesProp,
  initialAccountType = 'client',
  onCancel,
  onComplete,
}: Props) {
  const [accountType, setAccountType] = useState<AccountType>(initialAccountType);
  const [packages, setPackages] = useState<DirectAdminPackage[]>(() => readPackagesCache() || packagesProp);
  const [resellerPackages, setResellerPackages] = useState<string[]>([]);
  const [packageName, setPackageName] = useState('');
  const [identity, setIdentity] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [hosting, setHosting] = useState({ domain: '', adminEmail: '', php: '8.2' });
  const [options, setOptions] = useState({ createEmail: false, emailUser: 'info', issueSsl: false });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setAccountType(initialAccountType);
  }, [initialAccountType]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/admin/clientes', { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { success?: boolean; packages?: DirectAdminPackage[]; resellerPackages?: string[] }) => {
        if (cancelled || !data.success) return;
        if (Array.isArray(data.packages)) {
          const rows = data.packages.filter((p) => p.packageName);
          if (rows.length) {
            setPackages(rows);
            writePackagesCache(rows);
            if (initialAccountType !== 'reseller') {
              setPackageName((prev) => (prev && rows.some((p) => p.packageName === prev) ? prev : rows[0].packageName));
            }
          }
        }
        if (Array.isArray(data.resellerPackages)) {
          setResellerPackages(data.resellerPackages);
          if (initialAccountType === 'reseller' || accountType === 'reseller') {
            setPackageName((prev) => prev || data.resellerPackages![0] || '');
          }
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [initialAccountType, accountType]);

  useEffect(() => {
    if (packagesProp.length) {
      setPackages(packagesProp);
      writePackagesCache(packagesProp);
      if (accountType !== 'reseller') {
        setPackageName((prev) => prev || packagesProp[0]?.packageName || '');
      }
    }
  }, [packagesProp, accountType]);

  const deriveUsername = () => {
    const fromDomain = hosting.domain.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
    if (fromDomain) return fromDomain;
    const fromEmail = identity.email.split('@')[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 10);
    return fromEmail || 'cliente';
  };

  const activePackageName =
    packageName || (accountType === 'reseller' ? resellerPackages[0] || '' : packages[0]?.packageName || '');

  const packageOptions = useMemo(
    () =>
      accountType === 'reseller'
        ? resellerPackages.map((name) => ({ packageName: name }))
        : packages,
    [accountType, resellerPackages, packages],
  );

  const canSubmit =
    identity.email.includes('@') &&
    identity.password.length >= 8 &&
    identity.password === identity.confirmPassword &&
    (accountType === 'admin' ||
      (accountType === 'reseller' && Boolean(activePackageName)) ||
      (accountType === 'client' && hosting.domain.includes('.') && Boolean(activePackageName)));

  const handleProvision = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMsg('');
    const username = deriveUsername();
    const domain = hosting.domain.trim().toLowerCase();
    const adminEmail = hosting.adminEmail.trim() || identity.email;
    const fullName = `${identity.firstName} ${identity.lastName}`.trim() || identity.email.split('@')[0];

    try {
      if (accountType === 'admin') {
        const res = await fetch('/api/admin/panel-users', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: identity.email,
            password: identity.password,
            name: fullName,
            role: 'admin',
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(String(json.error || 'Falha ao criar administrador'));
        onComplete?.();
        onCancel();
        return;
      }

      const res = await fetch('/api/admin/clientes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType,
          email: identity.email,
          password: identity.password,
          userName: username,
          domain: accountType === 'reseller' ? domain || `${username}.com` : domain,
          packageName: activePackageName,
          adminEmail,
          createEmail: options.createEmail,
          emailUser: options.emailUser,
          issueSsl: options.issueSsl,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(String(json.error || 'Falha ao criar conta'));
      }
      onComplete?.();
      onCancel();
    } catch (e: unknown) {
      setMsg(`Erro: ${e instanceof Error ? e.message : 'Erro ao provisionar'}`);
    }
    setBusy(false);
  };

  return (
    <div className="rounded border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-bold text-gray-900 dark:text-zinc-100">Criar conta de hospedagem</h2>

      <section>
        <DaRow label="Tipo de conta">
          <div className="flex flex-wrap gap-4 text-sm">
            {(
              [
                ['client', 'Cliente'],
                ['reseller', 'Revendedor'],
                ['admin', 'Administrador'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="account-type-inline"
                  checked={accountType === value}
                  onChange={() => {
                    setAccountType(value);
                    if (value === 'reseller') setPackageName(resellerPackages[0] || '');
                    else if (value === 'client') setPackageName(packages[0]?.packageName || '');
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </DaRow>

        <DaRow label="Nome">
          <input
            value={identity.firstName}
            onChange={(e) => setIdentity({ ...identity, firstName: e.target.value })}
            className={`${panelField} min-w-0 flex-1`}
          />
        </DaRow>

        <DaRow label="Apelido">
          <input
            value={identity.lastName}
            onChange={(e) => setIdentity({ ...identity, lastName: e.target.value })}
            className={`${panelField} min-w-0 flex-1`}
          />
        </DaRow>

        <DaRow label="E-mail">
          <input
            type="email"
            value={identity.email}
            onChange={(e) => setIdentity({ ...identity, email: e.target.value })}
            className={`${panelField} min-w-0 flex-1`}
          />
        </DaRow>

        <DaRow label="Palavra-passe">
          <div className="relative min-w-0 flex-1">
            <input
              type={showPassword ? 'text' : 'password'}
              value={identity.password}
              onChange={(e) => setIdentity({ ...identity, password: e.target.value })}
              className={`${panelField} w-full pr-20`}
            />
            <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1.5 text-gray-400 hover:text-gray-700">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = generatePassword();
                  setIdentity({ ...identity, password: p, confirmPassword: p });
                }}
                className="p-1.5 text-gray-400 hover:text-zinc-700"
                title="Gerar palavra-passe"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
        </DaRow>

        <DaRow label="Confirmar palavra-passe">
          <input
            type={showPassword ? 'text' : 'password'}
            value={identity.confirmPassword}
            onChange={(e) => setIdentity({ ...identity, confirmPassword: e.target.value })}
            className={`${panelField} min-w-0 flex-1`}
          />
        </DaRow>

        {accountType !== 'admin' && (
          <DaRow label="Utilizador">
            <input value={deriveUsername()} readOnly className={`${panelField} min-w-0 flex-1 bg-gray-50 dark:bg-zinc-800`} />
          </DaRow>
        )}

        {accountType !== 'admin' && (
          <DaRow label={accountType === 'reseller' ? 'Pacote de revenda' : 'Pacote'}>
            <select
              value={activePackageName}
              onChange={(e) => setPackageName(e.target.value)}
              className={`${panelField} min-w-0 flex-1`}
            >
              {packageOptions.length === 0 ? (
                <option value="">Sem pacotes disponíveis</option>
              ) : (
                packageOptions.map((p) => (
                  <option key={p.packageName} value={p.packageName}>
                    {p.packageName}
                  </option>
                ))
              )}
            </select>
          </DaRow>
        )}

        {(accountType === 'client' || accountType === 'reseller') && (
          <DaRow label="Domínio">
            <input
              placeholder={accountType === 'client' ? 'exemplo.com' : 'opcional'}
              value={hosting.domain}
              onChange={(e) => setHosting({ ...hosting, domain: e.target.value })}
              className={`${panelField} min-w-0 flex-1`}
            />
          </DaRow>
        )}

        {accountType === 'client' && (
          <>
            <DaRow label="E-mail admin">
              <input
                type="email"
                value={hosting.adminEmail}
                onChange={(e) => setHosting({ ...hosting, adminEmail: e.target.value })}
                placeholder={identity.email || 'opcional'}
                className={`${panelField} min-w-0 flex-1`}
              />
            </DaRow>

            <DaRow label="PHP">
              <select
                value={hosting.php}
                onChange={(e) => setHosting({ ...hosting, php: e.target.value })}
                className={`${panelField} w-32 shrink-0`}
              >
                <option value="8.2">PHP 8.2</option>
                <option value="8.3">PHP 8.3</option>
                <option value="8.1">PHP 8.1</option>
              </select>
            </DaRow>

            <div className="flex items-center gap-3 border-b border-gray-100 py-3 dark:border-zinc-800">
              <span className="w-52 shrink-0 whitespace-nowrap text-sm text-gray-800 dark:text-zinc-200">Opções</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.createEmail}
                    onChange={(e) => setOptions({ ...options, createEmail: e.target.checked })}
                  />
                  Criar e-mail
                  <input
                    value={options.emailUser}
                    onChange={(e) => setOptions({ ...options, emailUser: e.target.value })}
                    className={`${panelField} w-24`}
                  />
                  @{hosting.domain || 'domínio'}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.issueSsl}
                    onChange={(e) => setOptions({ ...options, issueSsl: e.target.checked })}
                  />
                  Emitir SSL Let&apos;s Encrypt
                </label>
              </div>
            </div>
          </>
        )}
      </section>

      {msg && (
        <p className={`mt-4 rounded px-4 py-2 text-sm ${msg.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-zinc-800">
        <button type="button" onClick={onCancel} className={panelBtnSecondary}>
          Cancelar
        </button>
        <button type="button" onClick={() => void handleProvision()} disabled={busy || !canSubmit} className={panelBtnPrimary}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Criar conta
        </button>
      </div>
    </div>
  );
}
