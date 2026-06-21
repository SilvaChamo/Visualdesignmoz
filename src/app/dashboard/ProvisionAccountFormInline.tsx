'use client';

import type { ReactNode } from 'react';
import { Eye, EyeOff, Globe, Loader2, RefreshCw, Shield, UserPlus, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DirectAdminPackage } from '@/lib/directadmin-api';
import { readPackagesCache, writePackagesCache } from '@/lib/panel-packages-cache';
import {
  createDefaultResellerPackageForm,
  type ResellerPackageFormState,
} from '@/lib/reseller-package-form';
import { ResellerProvisionForm } from '@/app/dashboard/ResellerProvisionForm';
import { DaFormRow } from '@/lib/panel-da-form-rows';
import { panelBtnPrimary, panelBtnSecondary, panelField } from '@/lib/panel-ui';

type AccountType = 'client' | 'reseller' | 'admin';

type Props = {
  packages: DirectAdminPackage[];
  initialAccountType?: AccountType;
  onCancel: () => void;
  onComplete?: () => void;
};

function IdentityRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DaFormRow label={label} showUnlimited={false}>
      {children}
    </DaFormRow>
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
  const [resellerForm, setResellerForm] = useState<ResellerPackageFormState>(() =>
    createDefaultResellerPackageForm(),
  );
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
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [initialAccountType]);

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

  const activeClientPackageName = packageName || packages[0]?.packageName || '';

  const activeResellerPackageName = useMemo(() => {
    if (resellerForm.packageMode === 'existing' && resellerPackages.length) {
      return resellerForm.packageName || resellerPackages[0] || '';
    }
    return resellerForm.packageName.trim();
  }, [resellerForm, resellerPackages]);

  const canSubmit =
    identity.email.includes('@') &&
    identity.password.length >= 8 &&
    identity.password === identity.confirmPassword &&
    (accountType === 'admin' ||
      (accountType === 'reseller' && Boolean(activeResellerPackageName)) ||
      (accountType === 'client' && hosting.domain.includes('.') && Boolean(activeClientPackageName)));

  const createResellerPackageIfNeeded = async (): Promise<string> => {
    if (
      resellerForm.packageMode === 'existing' &&
      resellerForm.packageName &&
      resellerPackages.includes(resellerForm.packageName)
    ) {
      return resellerForm.packageName;
    }
    const name = resellerForm.packageName.trim();
    if (!name) throw new Error('Nome do pacote de revenda obrigatório.');

    const res = await fetch('/api/server-exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createPackage',
        params: {
          packageName: name,
          packageScope: 'reseller',
          hostingPackageForm: { ...resellerForm, packageName: name },
        },
      }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(String(data.error || data.data?.error || 'Falha ao criar pacote de revenda'));
    }
    return name;
  };

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

      let effectivePackageName = activeClientPackageName;
      if (accountType === 'reseller') {
        effectivePackageName = await createResellerPackageIfNeeded();
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
          packageName: effectivePackageName,
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

      <section className="mb-6 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-zinc-100">Tipo de conta</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {([
            { id: 'client' as const, title: 'Cliente', desc: 'Hospedagem para um cliente final', icon: Users },
            { id: 'reseller' as const, title: 'Revendedor', desc: 'Conta de revenda no servidor', icon: Globe },
            { id: 'admin' as const, title: 'Administrador', desc: 'Acesso ao painel admin', icon: Shield },
          ]).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setAccountType(opt.id);
                if (opt.id === 'client') setPackageName(packages[0]?.packageName || '');
              }}
              className={`rounded-lg border-2 p-4 text-left transition-all ${
                accountType === opt.id ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <opt.icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-600" />
                <div className="min-w-0 font-bold text-gray-900 dark:text-zinc-100">{opt.title}</div>
              </div>
              <p className="mt-2 pl-8 text-sm text-gray-500">{opt.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <IdentityRow label="Nome">
          <input
            value={identity.firstName}
            onChange={(e) => setIdentity({ ...identity, firstName: e.target.value })}
            className={`${panelField} min-w-0 flex-1`}
          />
        </IdentityRow>

        <IdentityRow label="Apelido">
          <input
            value={identity.lastName}
            onChange={(e) => setIdentity({ ...identity, lastName: e.target.value })}
            className={`${panelField} min-w-0 flex-1`}
          />
        </IdentityRow>

        <IdentityRow label="E-mail">
          <input
            type="email"
            value={identity.email}
            onChange={(e) => setIdentity({ ...identity, email: e.target.value })}
            className={`${panelField} min-w-0 flex-1`}
          />
        </IdentityRow>

        <IdentityRow label="Palavra-passe">
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
        </IdentityRow>

        <IdentityRow label="Confirmar palavra-passe">
          <input
            type={showPassword ? 'text' : 'password'}
            value={identity.confirmPassword}
            onChange={(e) => setIdentity({ ...identity, confirmPassword: e.target.value })}
            className={`${panelField} min-w-0 flex-1`}
          />
        </IdentityRow>

        {accountType === 'client' && (
          <>
            <IdentityRow label="Pacote">
              <select
                value={activeClientPackageName}
                onChange={(e) => setPackageName(e.target.value)}
                className={`${panelField} min-w-0 flex-1`}
              >
                {packages.length === 0 ? (
                  <option value="">Sem pacotes disponíveis</option>
                ) : (
                  packages.map((p) => (
                    <option key={p.packageName} value={p.packageName}>
                      {p.packageName}
                    </option>
                  ))
                )}
              </select>
            </IdentityRow>

            <IdentityRow label="Domínio">
              <input
                placeholder="exemplo.com"
                value={hosting.domain}
                onChange={(e) => setHosting({ ...hosting, domain: e.target.value })}
                className={`${panelField} min-w-0 flex-1`}
              />
            </IdentityRow>

            <IdentityRow label="E-mail admin">
              <input
                type="email"
                value={hosting.adminEmail}
                onChange={(e) => setHosting({ ...hosting, adminEmail: e.target.value })}
                placeholder={identity.email || 'opcional'}
                className={`${panelField} min-w-0 flex-1`}
              />
            </IdentityRow>

            <IdentityRow label="PHP">
              <select
                value={hosting.php}
                onChange={(e) => setHosting({ ...hosting, php: e.target.value })}
                className={`${panelField} w-32 shrink-0`}
              >
                <option value="8.2">PHP 8.2</option>
                <option value="8.3">PHP 8.3</option>
                <option value="8.1">PHP 8.1</option>
              </select>
            </IdentityRow>

            <DaFormRow label="Opções" showUnlimited={false}>
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
            </DaFormRow>
          </>
        )}

        {accountType === 'reseller' && (
          <ResellerProvisionForm
            form={resellerForm}
            onChange={setResellerForm}
            existingPackages={resellerPackages}
            domain={hosting.domain}
            onDomainChange={(value) => setHosting({ ...hosting, domain: value })}
          />
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
