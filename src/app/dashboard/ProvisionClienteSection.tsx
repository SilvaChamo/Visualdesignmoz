'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Eye, EyeOff, Globe, Loader2, Package, RefreshCw, Shield, UserPlus, Users } from 'lucide-react';
import type { DirectAdminPackage } from '@/lib/directadmin-api';
import { readPackagesCache, writePackagesCache } from '@/lib/panel-packages-cache';
import { panelBtnPrimary, panelBtnSecondary } from '@/lib/panel-ui';

type AccountType = 'client' | 'reseller' | 'professional';

export type ProvisionEditUser = {
  userName: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  primaryDomain?: string;
  packageName?: string;
  type?: string;
  websitesLimit?: number;
  emailsLimit?: number;
};

export type ProvisionCreatedUser = ProvisionEditUser & {
  quotaLabel?: string;
  diskUsedLabel?: string;
  resellerOwner?: string;
  domainCount?: number;
  registeredAt?: string | null;
  suspended?: boolean;
  ownedDomains?: Array<{
    domain: string;
    package: string;
    diskUsage: string;
    status: string;
  }>;
};

interface Props {
  packages: DirectAdminPackage[];
  onComplete?: (result?: { user?: ProvisionCreatedUser }) => void;
  onCancel?: () => void;
  initialAccountType?: AccountType;
  mode?: 'create' | 'edit';
  editUser?: ProvisionEditUser;
  accountsApiBase?: string;
  allowResellerAccountType?: boolean;
  panelScope?: 'admin' | 'reseller';
}

const inputCls =
  'w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/30';

const formCardCls =
  'rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900';

function generatePassword(length = 16): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function normalizeErrorMessage(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function panelRoleForAccountTypeUi(accountType: AccountType): string {
  if (accountType === 'reseller') return 'reseller';
  if (accountType === 'professional') return 'manager';
  return 'client';
}

function panelRoleLabel(accountType: AccountType): string {
  if (accountType === 'reseller') return 'Revendedor';
  if (accountType === 'professional') return 'Profissional';
  return 'Cliente';
}

function formatPackageLimit(value: unknown, defaultUnit?: string): string {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '—' || raw.toLowerCase() === 'unlimited') return raw || '—';
  if (/[a-z]/i.test(raw)) return raw;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && defaultUnit === 'MB' && asNumber >= 1024 && asNumber % 1024 === 0) {
    return `${asNumber / 1024}G`;
  }
  return defaultUnit ? `${raw} ${defaultUnit}` : raw;
}

function suggestUsername(domain: string, email: string): string {
  const fromDomain = domain.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
  if (fromDomain) return fromDomain;
  const fromEmail = email.split('@')[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
  return fromEmail || '';
}

function accountTypeFromDaType(type?: string): AccountType {
  const t = String(type || '').toLowerCase();
  if (t === 'reseller') return 'reseller';
  if (t === 'admin' || t === 'manager' || t === 'guest') return 'professional';
  return 'client';
}

export function ProvisionClienteSection({
  packages: packagesProp,
  onComplete,
  onCancel,
  initialAccountType = 'client',
  mode = 'create',
  editUser,
  accountsApiBase = '/api/admin/clientes',
  allowResellerAccountType = true,
  panelScope = 'admin',
}: Props) {
  const isEdit = mode === 'edit' && Boolean(editUser?.userName);
  const [accountType, setAccountType] = useState<AccountType>(() =>
    isEdit ? accountTypeFromDaType(editUser?.type) : initialAccountType,
  );
  const [packages, setPackages] = useState<DirectAdminPackage[]>(() => readPackagesCache(panelScope) || packagesProp);
  const [packageName, setPackageName] = useState('');
  const [username, setUsername] = useState(() => editUser?.userName || '');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [identity, setIdentity] = useState({
    firstName: editUser?.firstName || '',
    lastName: editUser?.lastName || '',
    email: editUser?.email || '',
    password: '',
    confirmPassword: '',
  });
  const [domain, setDomain] = useState(() => editUser?.primaryDomain || '');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const [userMode, setUserMode] = useState<'new' | 'existing'>('new');
  const [existingUserId, setExistingUserId] = useState('');
  const [resellerTier, setResellerTier] = useState<'essencial' | 'expandido'>('essencial');
  const [panelUsers, setPanelUsers] = useState<Array<{ id: string; email: string; userName: string; panelRole: string }>>([]);

  useEffect(() => {
    if (isEdit || panelScope !== 'admin') return;
    let cancelled = false;
    void fetch('/api/admin/panel-users', { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { success?: boolean; users?: Array<{ id: string; email: string; userName: string; panelRole: string }> }) => {
        if (cancelled || !data.success || !Array.isArray(data.users)) return;
        setPanelUsers(data.users);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [isEdit, panelScope]);

  useEffect(() => {
    if (!isEdit) setAccountType(initialAccountType);
  }, [initialAccountType, isEdit]);

  useEffect(() => {
    if (isEdit && editUser?.packageName && editUser.packageName !== '—') {
      setPackageName(editUser.packageName);
    }
  }, [isEdit, editUser?.packageName]);

  useEffect(() => {
    let cancelled = false;
    void fetch(accountsApiBase, { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { success?: boolean; packages?: DirectAdminPackage[] }) => {
        if (cancelled || !data.success) return;
        if (Array.isArray(data.packages)) {
          const rows = data.packages.filter((p) => p.packageName);
          if (rows.length) {
            setPackages(rows);
            writePackagesCache(rows, panelScope);
          }
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [accountsApiBase, panelScope]);

  useEffect(() => {
    if (packagesProp.length) {
      setPackages(packagesProp);
      writePackagesCache(packagesProp, panelScope);
    }
  }, [packagesProp, panelScope]);

  useEffect(() => {
    if (isEdit || usernameTouched) return;
    const suggested = suggestUsername(domain, identity.email);
    if (suggested) setUsername(suggested);
  }, [domain, identity.email, isEdit, usernameTouched]);

  const resolvedUsername = isEdit ? (editUser?.userName || username) : username.trim() || suggestUsername(domain, identity.email) || 'cliente';

  const passwordOk =
    isEdit
      ? !identity.password || (identity.password.length >= 8 && identity.password === identity.confirmPassword)
      : userMode === 'existing'
        ? !identity.password || (identity.password.length >= 8 && identity.password === identity.confirmPassword)
        : identity.password.length >= 8 && identity.password === identity.confirmPassword;

  const identityEmailOk =
    userMode === 'existing' ? Boolean(existingUserId) : identity.email.includes('@');

  const displayName = useMemo(() => {
    const n = `${identity.firstName} ${identity.lastName}`.trim();
    return n || '—';
  }, [identity.firstName, identity.lastName]);

  const selectedPackageName = packageName.trim();
  const hasHostingPackage = Boolean(selectedPackageName);
  const expectedPanelRole = panelRoleForAccountTypeUi(accountType);
  const matchingPanelUsers = panelUsers.filter((u) => u.panelRole === expectedPanelRole);
  const packageOptions = packages;
  const selectedPackage = packageOptions.find((p) => p.packageName === selectedPackageName);

  const canSubmit =
    identityEmailOk &&
    passwordOk &&
    Boolean(resolvedUsername) &&
    (!hasHostingPackage || accountType !== 'client' || domain.includes('.'));

  const handleProvision = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMsg('');
    const normalizedDomain = domain.trim().toLowerCase();
    const adminEmail = identity.email.trim();

    try {
      if (isEdit && editUser) {
        const res = await fetch(accountsApiBase, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'editAccount',
            userName: editUser.userName,
            accountType,
            resellerTier: accountType === 'reseller' ? resellerTier : undefined,
            firstName: identity.firstName,
            lastName: identity.lastName,
            email: identity.email,
            packageName: hasHostingPackage ? selectedPackageName : '',
            primaryDomain: normalizedDomain || undefined,
            adminEmail,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(String(json.error || 'Falha ao actualizar conta'));

        const serverNote =
          json.serverSynced === false && json.warning
            ? ` ${String(json.warning)}`
            : '';

        if (identity.password.length >= 8) {
          const passRes = await fetch(accountsApiBase, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'changePassword',
              userName: editUser.userName,
              password: identity.password,
            }),
          });
          const passJson = await passRes.json();
          if (!passRes.ok || !passJson.success) {
            throw new Error(String(passJson.error || 'Conta actualizada, mas falha ao alterar password'));
          }
        }

        setDone(true);
        setMsg(`Conta ${editUser.userName} actualizada.${serverNote}`);
        onComplete?.();
        return;
      }

      const res = await fetch(accountsApiBase, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType,
          existingUserId: userMode === 'existing' ? existingUserId : undefined,
          resellerTier: accountType === 'reseller' ? resellerTier : undefined,
          firstName: identity.firstName,
          lastName: identity.lastName,
          email: identity.email,
          password: identity.password,
          userName: resolvedUsername,
          domain:
            accountType === 'reseller' || accountType === 'professional'
              ? normalizedDomain || `${resolvedUsername}.com`
              : normalizedDomain,
          packageName: selectedPackageName || undefined,
          simpleAccount: !hasHostingPackage,
          adminEmail,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(String(json.error || 'Falha ao criar conta'));
      }

      setDone(true);
      const createdDomain =
        String(json.domain || normalizedDomain || (accountType !== 'client' ? `${resolvedUsername}.com` : '')).trim();
      const typeLabel = panelRoleLabel(accountType);
      const serverNote =
        json.serverSynced === true
          ? ''
          : hasHostingPackage
            ? ' A sincronização com o servidor de hospedagem será feita automaticamente quando estiver disponível.'
            : '';
      const simpleNote = json.provisionMode === 'simple' ? ' Conta simples (acesso ao painel).' : '';
      setMsg(
        hasHostingPackage
          ? `Conta ${typeLabel} ${resolvedUsername}${createdDomain ? ` (${createdDomain})` : ''} criada no painel.${serverNote}`
          : `Utilizador ${typeLabel} criado no painel.${simpleNote}`,
      );
      onComplete?.({ user: json.user as ProvisionCreatedUser | undefined });
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Erro ao provisionar';
      setMsg(`Erro: ${normalizeErrorMessage(raw)}`);
    }
    setBusy(false);
  };

  const accountTypeCards = (
    <section className={`${formCardCls} space-y-4`}>
      <h2 className="font-bold text-gray-900">Tipo de conta</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {([
          { id: 'client' as const, title: 'Cliente', desc: 'Hospedagem opcional — sem pacote fica conta simples', icon: Users },
          ...(allowResellerAccountType
            ? [
                { id: 'professional' as const, title: 'Profissional', desc: 'Gestão de sites e WordPress (sem criar contas)', icon: Shield },
                { id: 'reseller' as const, title: 'Revendedor', desc: 'Revenda com plano Essencial ou Expandido', icon: Globe },
              ]
            : []),
        ]).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              setAccountType(opt.id);
              if (!isEdit && userMode === 'existing' && existingUserId) {
                const row = panelUsers.find((u) => u.id === existingUserId);
                const role = panelRoleForAccountTypeUi(opt.id);
                if (row && row.panelRole !== role) setExistingUserId('');
              }
            }}
            className={`rounded-lg border-2 p-4 text-left transition-all ${
              accountType === opt.id ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <opt.icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-600" />
              <div className="min-w-0 font-bold text-gray-900">{opt.title}</div>
            </div>
            <p className="mt-2 pl-8 text-sm text-gray-500">{opt.desc}</p>
          </button>
        ))}
      </div>
    </section>
  );

  const panelUserSection = !isEdit && panelScope === 'admin' && (
    <section className={`${formCardCls} space-y-4`}>
      <h2 className="font-bold text-gray-900">Utilizador do painel</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setUserMode('new')}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${
            userMode === 'new' ? 'border-red-600 bg-red-50' : 'border-gray-200'
          }`}
        >
          Criar novo
        </button>
        <button
          type="button"
          onClick={() => setUserMode('existing')}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${
            userMode === 'existing' ? 'border-red-600 bg-red-50' : 'border-gray-200'
          }`}
        >
          Associar existente
        </button>
      </div>
      {userMode === 'existing' && (
        <select
          value={existingUserId}
          onChange={(e) => {
            const id = e.target.value;
            setExistingUserId(id);
            const row = matchingPanelUsers.find((u) => u.id === id);
            if (row) {
              setIdentity((prev) => ({
                ...prev,
                email: row.email,
                firstName: prev.firstName || row.userName.split(' ')[0] || '',
                lastName: prev.lastName || row.userName.split(' ').slice(1).join(' ') || '',
              }));
            }
          }}
          className={inputCls}
        >
          <option value="">Seleccionar utilizador…</option>
          {matchingPanelUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email} ({u.panelRole})
            </option>
          ))}
        </select>
      )}
      {userMode === 'existing' && matchingPanelUsers.length === 0 ? (
        <p className="text-xs text-amber-700">
          Nenhum utilizador com papel «{panelRoleLabel(accountType)}». Crie novo ou altere o tipo de conta.
        </p>
      ) : null}
    </section>
  );

  const resellerTierSection = accountType === 'reseller' && (
    <section className={`${formCardCls} space-y-3`}>
      <h2 className="font-bold text-gray-900">Plano de revenda</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {([
          { id: 'essencial' as const, title: 'Essencial', desc: 'Até 15 contas · 50 GB' },
          { id: 'expandido' as const, title: 'Expandido', desc: 'Até 150 contas · 500 GB' },
        ]).map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setResellerTier(plan.id)}
            className={`rounded-lg border-2 p-4 text-left ${
              resellerTier === plan.id ? 'border-red-600 bg-red-50' : 'border-gray-200'
            }`}
          >
            <div className="font-bold text-gray-900">{plan.title}</div>
            <p className="mt-1 text-sm text-gray-500">{plan.desc}</p>
          </button>
        ))}
      </div>
    </section>
  );

  const identitySection = (
    <section className={`${formCardCls} space-y-4`}>
      <h2 className="font-bold text-gray-900 flex items-center gap-2">
        <UserPlus className="w-5 h-5" /> Identidade
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input placeholder="Nome" value={identity.firstName} onChange={(e) => setIdentity({ ...identity, firstName: e.target.value })} className={inputCls} />
        <input placeholder="Apelido" value={identity.lastName} onChange={(e) => setIdentity({ ...identity, lastName: e.target.value })} className={inputCls} />
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-zinc-500">Utilizador</label>
          <input
            placeholder="ex: provisualc"
            value={resolvedUsername}
            readOnly={isEdit}
            onChange={(e) => {
              setUsernameTouched(true);
              setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
            }}
            className={`${inputCls} ${isEdit ? 'bg-gray-50 opacity-80' : ''}`}
          />
        </div>
        <input
          placeholder="E-mail"
          type="email"
          value={identity.email}
          onChange={(e) => setIdentity({ ...identity, email: e.target.value })}
          disabled={!isEdit && userMode === 'existing'}
          className={`${inputCls} sm:col-span-2 disabled:bg-gray-50`}
        />
        <div className="relative sm:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative">
            <input
              placeholder={isEdit ? 'Nova password (opcional)' : userMode === 'existing' ? 'Nova password (opcional)' : 'Password (mín. 8)'}
              type={showPassword ? 'text' : 'password'}
              value={identity.password}
              onChange={(e) => setIdentity({ ...identity, password: e.target.value })}
              className={`${inputCls} pr-20`}
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
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
                title="Gerar password"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          <input
            placeholder={isEdit ? 'Confirmar nova password' : 'Confirmar password'}
            type={showPassword ? 'text' : 'password'}
            value={identity.confirmPassword}
            onChange={(e) => setIdentity({ ...identity, confirmPassword: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>
    </section>
  );

  const hostingSection = (
    <section className={`${formCardCls} space-y-4`}>
      <h2 className="font-bold text-gray-900 flex items-center gap-2">
        <Package className="w-5 h-5 shrink-0" /> Hospedagem
      </h2>
      <p className="text-xs text-zinc-500">
        Os limites (disco, emails, domínios) vêm do pacote seleccionado. Sem pacote, a conta fica simples (só painel).
      </p>
      {packageOptions.length === 0 ? (
        <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
          Nenhum pacote disponível — conta simples.
        </p>
      ) : (
        <>
          <select
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            className={inputCls}
          >
            <option value="">Conta simples (sem pacote)</option>
            {packageOptions.map((p) => (
              <option key={p.packageName} value={p.packageName}>
                {p.packageName}
              </option>
            ))}
          </select>
          {hasHostingPackage && selectedPackage ? (
            <p className="text-xs text-gray-500">
              Disco {formatPackageLimit(selectedPackage.diskSpace, 'MB')} · BW {formatPackageLimit(selectedPackage.bandwidth, 'MB')} · Emails {formatPackageLimit(selectedPackage.emailAccounts)} · Domínios {formatPackageLimit(selectedPackage.allowedDomains)}
            </p>
          ) : null}
          {hasHostingPackage ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500">
                {accountType === 'client' ? 'Domínio' : 'Domínio principal'}
              </label>
              <input
                placeholder={accountType === 'client' ? 'exemplo.com' : 'opcional — preenche automaticamente se vazio'}
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className={inputCls}
              />
            </div>
          ) : null}
        </>
      )}
    </section>
  );

  const summarySidebar = (
    <aside className="sticky top-0 h-fit w-full shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:w-72 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="border-b border-gray-200 px-5 py-4">
        <h3 className="text-sm font-bold text-gray-900">Resumo</h3>
      </div>
      <dl className="space-y-3 px-5 py-4 text-sm">
        <div>
          <dt className="text-xs text-zinc-400">Tipo</dt>
          <dd className="font-medium text-zinc-900">{panelRoleLabel(accountType)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">Nome</dt>
          <dd className="text-zinc-800">{displayName}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">Utilizador</dt>
          <dd className="font-mono text-zinc-900">{resolvedUsername || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">E-mail</dt>
          <dd className="break-all text-zinc-800">{identity.email || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">Pacote</dt>
          <dd className="text-zinc-900">{hasHostingPackage ? selectedPackageName : 'Conta simples'}</dd>
        </div>
        {hasHostingPackage ? (
          <div>
            <dt className="text-xs text-zinc-400">Domínio</dt>
            <dd className="break-all text-zinc-900">
              {domain || (accountType !== 'client' ? `${resolvedUsername}.com` : '—')}
            </dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );

  if (done) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{isEdit ? 'Conta actualizada' : 'Conta criada'}</h2>
        <p className="text-gray-600 mb-6">{msg}</p>
        {!isEdit && (
          <button
            onClick={() => {
              setDone(false);
              setMsg('');
              setIdentity({
                firstName: '',
                lastName: '',
                email: '',
                password: '',
                confirmPassword: '',
              });
              setDomain('');
              setPackageName('');
              setUsername('');
              setUsernameTouched(false);
              setExistingUserId('');
              setUserMode('new');
            }}
            className="px-5 py-2.5 bg-black text-white rounded-lg font-bold hover:bg-red-600"
          >
            Criar outra conta
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          {accountTypeCards}
          {panelUserSection}
          {resellerTierSection}
          {identitySection}
          {hostingSection}

          {msg && !done && (
            <p className={`text-sm p-3 rounded-lg ${msg.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            {onCancel && (
              <button type="button" onClick={onCancel} className={panelBtnSecondary}>
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={handleProvision}
              disabled={busy || !canSubmit}
              className={panelBtnPrimary}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {isEdit ? 'Guardar alterações' : 'Criar conta'}
            </button>
          </div>
        </div>

        {summarySidebar}
      </div>
    </div>
  );
}
