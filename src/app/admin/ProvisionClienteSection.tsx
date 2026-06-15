'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Eye, EyeOff, Globe, Loader2, Package, RefreshCw, Shield, UserPlus, Users } from 'lucide-react';
import type { DirectAdminPackage } from '@/lib/directadmin-api';
import { readPackagesCache, writePackagesCache } from '@/lib/panel-packages-cache';

type AccountType = 'client' | 'reseller' | 'admin';

interface Props {
  packages: DirectAdminPackage[];
  onComplete?: () => void;
  initialAccountType?: AccountType;
}

const inputCls =
  'w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/30';

function generatePassword(length = 16): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function ProvisionClienteSection({ packages: packagesProp, onComplete, initialAccountType = 'client' }: Props) {
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
  const [hosting, setHosting] = useState({
    domain: '',
    adminEmail: '',
    php: '8.2',
  });
  const [options, setOptions] = useState({ createEmail: false, emailUser: 'info', issueSsl: false });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);

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

  const displayName = useMemo(() => {
    const n = `${identity.firstName} ${identity.lastName}`.trim();
    return n || '—';
  }, [identity.firstName, identity.lastName]);

  const activePackageName = packageName || (accountType === 'reseller' ? resellerPackages[0] || '' : packages[0]?.packageName || '');

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
    const fullName = displayName !== '—' ? displayName : identity.email.split('@')[0];

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
        setDone(true);
        setMsg(`Administrador ${identity.email} criado.`);
        onComplete?.();
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

      setDone(true);
      setMsg(`Conta ${accountType === 'reseller' ? username : domain} criada.`);
      onComplete?.();
    } catch (e: unknown) {
      setMsg(`Erro: ${e instanceof Error ? e.message : 'Erro ao provisionar'}`);
    }
    setBusy(false);
  };

  const summarySidebar = (
    <aside className="sticky top-0 h-fit w-full shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:w-72">
      <div className="border-b border-gray-200 px-5 py-4">
        <h3 className="text-sm font-bold text-gray-900">Resumo da conta</h3>
      </div>
      <dl className="space-y-3 px-5 py-4 text-sm">
        <div>
          <dt className="text-xs text-zinc-400">Tipo</dt>
          <dd className="font-medium text-zinc-900">
            {accountType === 'client' ? 'Cliente' : accountType === 'reseller' ? 'Revendedor' : 'Administrador'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">Nome</dt>
          <dd className="text-zinc-800">{displayName}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">E-mail</dt>
          <dd className="break-all text-zinc-800">{identity.email || '—'}</dd>
        </div>
        {accountType !== 'admin' && (
          <div>
            <dt className="text-xs text-zinc-400">Utilizador</dt>
            <dd className="font-mono text-zinc-900">{deriveUsername()}</dd>
          </div>
        )}
        {accountType !== 'admin' && (
          <div>
            <dt className="text-xs text-zinc-400">{accountType === 'reseller' ? 'Pacote de revenda' : 'Pacote'}</dt>
            <dd className="text-zinc-900">{activePackageName || '—'}</dd>
          </div>
        )}
        {(accountType === 'client' || accountType === 'reseller') && (
          <div>
            <dt className="text-xs text-zinc-400">Domínio</dt>
            <dd className="break-all text-zinc-900">{hosting.domain || (accountType === 'reseller' ? `${deriveUsername()}.com` : '—')}</dd>
          </div>
        )}
        {accountType === 'admin' && (
          <div>
            <dt className="text-xs text-zinc-400">Acesso</dt>
            <dd className="text-zinc-800">Painel admin (sem DirectAdmin)</dd>
          </div>
        )}
      </dl>
    </aside>
  );

  if (done) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Conta criada</h2>
        <p className="text-gray-600 mb-6">{msg}</p>
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
            setHosting({ domain: '', adminEmail: '', php: '8.2' });
          }}
          className="px-5 py-2.5 bg-black text-white rounded-lg font-bold hover:bg-red-600"
        >
          Criar outra conta
        </button>
      </div>
    );
  }

  const packageOptions =
    accountType === 'reseller'
      ? resellerPackages.map((name) => ({ packageName: name, diskSpace: undefined, bandwidth: undefined, emailAccounts: undefined }))
      : packages;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-gray-900">Tipo de conta</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    if (opt.id === 'reseller') setPackageName(resellerPackages[0] || '');
                    else if (opt.id === 'client') setPackageName(packages[0]?.packageName || '');
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

          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Identidade
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input placeholder="Nome" value={identity.firstName} onChange={(e) => setIdentity({ ...identity, firstName: e.target.value })} className={inputCls} />
              <input placeholder="Apelido" value={identity.lastName} onChange={(e) => setIdentity({ ...identity, lastName: e.target.value })} className={inputCls} />
              <input placeholder="E-mail" type="email" value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })} className={`${inputCls} sm:col-span-2`} />
              <div className="relative sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    placeholder="Password (mín. 8)"
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
                  placeholder="Confirmar password"
                  type={showPassword ? 'text' : 'password'}
                  value={identity.confirmPassword}
                  onChange={(e) => setIdentity({ ...identity, confirmPassword: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          {accountType !== 'admin' && (
            <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5" /> {accountType === 'reseller' ? 'Pacote de revenda' : 'Pacote'}
              </h2>
              {packageOptions.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                  {accountType === 'reseller'
                    ? 'Nenhum pacote de revenda no servidor. Crie um pacote em Hospedagem → Pacotes.'
                    : 'A carregar pacotes do servidor…'}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {packageOptions.map((p) => (
                    <label
                      key={p.packageName}
                      className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-3 ${
                        activePackageName === p.packageName ? 'border-zinc-400 bg-zinc-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="pkg"
                          checked={activePackageName === p.packageName}
                          onChange={() => setPackageName(p.packageName)}
                        />
                        <span className="text-sm font-bold text-gray-900">{p.packageName}</span>
                      </div>
                      {accountType === 'client' && (
                        <div className="pl-6 text-xs text-gray-500">
                          Disco {p.diskSpace ?? '—'} MB · BW {p.bandwidth ?? '—'} · Emails {p.emailAccounts ?? '—'}
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </section>
          )}

          {accountType === 'client' && (
            <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Globe className="w-5 h-5" /> Hospedagem
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Domínio (exemplo.com)" value={hosting.domain} onChange={(e) => setHosting({ ...hosting, domain: e.target.value })} className={`${inputCls} sm:col-span-2`} />
                <input placeholder="E-mail admin do domínio" type="email" value={hosting.adminEmail} onChange={(e) => setHosting({ ...hosting, adminEmail: e.target.value })} className={`${inputCls} sm:col-span-2`} />
                <select value={hosting.php} onChange={(e) => setHosting({ ...hosting, php: e.target.value })} className={inputCls}>
                  <option value="8.2">PHP 8.2</option>
                  <option value="8.3">PHP 8.3</option>
                  <option value="8.1">PHP 8.1</option>
                </select>
              </div>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
                <input type="checkbox" checked={options.createEmail} onChange={(e) => setOptions({ ...options, createEmail: e.target.checked })} />
                <span className="text-sm">
                  Criar email{' '}
                  <input className="mx-1 px-2 py-0.5 border rounded w-24" value={options.emailUser} onChange={(e) => setOptions({ ...options, emailUser: e.target.value })} />
                  @{hosting.domain || 'domínio'}
                </span>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
                <input type="checkbox" checked={options.issueSsl} onChange={(e) => setOptions({ ...options, issueSsl: e.target.checked })} />
                <span className="text-sm">Emitir SSL Let&apos;s Encrypt para {hosting.domain || 'domínio'}</span>
              </label>
            </section>
          )}

          {accountType === 'reseller' && (
            <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-3">
              <h2 className="font-bold text-gray-900">Revenda</h2>
              <input
                placeholder="Domínio principal (opcional)"
                value={hosting.domain}
                onChange={(e) => setHosting({ ...hosting, domain: e.target.value })}
                className={inputCls}
              />
              <p className="text-sm text-gray-600">
                Utilizador: <strong>{deriveUsername()}</strong>
              </p>
            </section>
          )}

          {msg && !done && (
            <p className={`text-sm p-3 rounded-lg ${msg.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</p>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleProvision}
              disabled={busy || !canSubmit}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Criar conta
            </button>
          </div>
        </div>

        {summarySidebar}
      </div>
    </div>
  );
}
