'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight, Eye, EyeOff, Loader2, MoreVertical,
  Plus, RefreshCw, User, X,
} from 'lucide-react';
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome';

const CLIENTES_CACHE_KEY = 'vd-admin-clientes-v1';

type AccountType = 'client' | 'reseller';
type Step = 1 | 2 | 3 | 4;

interface DaUserRow {
  userName: string;
  email?: string;
  type?: string;
  suspended?: boolean;
  domainCount?: number;
  registeredAt?: string | null;
  firstName?: string;
  lastName?: string;
  websitesLimit?: number;
  emailsLimit?: number;
}

function readClientesCache(): { users: DaUserRow[]; meta: { lastSyncedAt: string | null; stale: boolean } | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CLIENTES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { users?: DaUserRow[]; meta?: { lastSyncedAt: string | null; stale: boolean } };
    if (!Array.isArray(parsed.users)) return null;
    return { users: parsed.users, meta: parsed.meta ?? null };
  } catch {
    return null;
  }
}

function formatRegisteredAt(raw?: string | null): string {
  if (!raw) return '—';
  const trimmed = String(raw).trim();
  if (/^\d{10,13}$/.test(trimmed)) {
    const ms = trimmed.length > 10 ? Number(trimmed) : Number(trimmed) * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-PT');
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString('pt-PT');
  return trimmed;
}

interface PanelPackageOption {
  packageName: string;
  diskSpace?: number;
  bandwidth?: number;
  emailAccounts?: number;
  dataBases?: number;
}

const WIZARD_STEPS = [
  { n: 1, label: 'Tipo' },
  { n: 2, label: 'Identidade' },
  { n: 3, label: 'Pacote' },
  { n: 4, label: 'Hospedagem' },
] as const;

const headerBtnCls =
  'inline-flex h-[30px] items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';

const actionBtnCls =
  'inline-flex h-[30px] items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';

function generatePassword(length = 16): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/30';

function PasswordFields({
  password,
  confirmPassword,
  onChange,
}: {
  password: string;
  confirmPassword: string;
  onChange: (p: { password: string; confirmPassword: string }) => void;
}) {
  const [show, setShow] = useState(false);

  const handleGenerate = () => {
    const p = generatePassword();
    onChange({ password: p, confirmPassword: p });
  };

  return (
    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          placeholder="Password (mín. 8)"
          value={password}
          onChange={(e) => onChange({ password: e.target.value, confirmPassword })}
          className={`${inputCls} pr-20`}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <button type="button" onClick={() => setShow(!show)} className="p-1.5 text-gray-400 hover:text-gray-700" title={show ? 'Ocultar' : 'Mostrar'}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button type="button" onClick={handleGenerate} className="p-1.5 text-gray-400 hover:text-zinc-700" title="Gerar password">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          placeholder="Confirmar password"
          value={confirmPassword}
          onChange={(e) => onChange({ password, confirmPassword: e.target.value })}
          className={inputCls}
        />
      </div>
    </div>
  );
}

function isDaReseller(user: DaUserRow): boolean {
  return String(user.type || '').toLowerCase() === 'reseller';
}

function RowActionsMenu({
  anchorRect,
  user,
  onAction,
  onClose,
}: {
  anchorRect: DOMRect;
  user: DaUserRow;
  onAction: (action: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const items = [
    ...(isDaReseller(user)
      ? [{ id: 'loginAs', label: 'Entrar como revendedor' }]
      : []),
    { id: 'editAccount', label: 'Editar conta' },
    { id: 'sendMessage', label: 'Enviar mensagem' },
    { id: 'changePassword', label: 'Alterar senha' },
    { id: user.suspended ? 'unsuspend' : 'suspend', label: user.suspended ? 'Reactivar' : 'Suspender' },
    { id: 'delete', label: 'Remover', danger: true },
  ];

  const menuW = 168;
  const estimatedH = items.length * 30 + 4;
  let top = anchorRect.bottom + 4;
  let left = Math.max(8, anchorRect.right - menuW);
  if (typeof window !== 'undefined' && top + estimatedH > window.innerHeight - 8) {
    top = anchorRect.top - estimatedH - 4;
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top, left, zIndex: 9999 }}
      className="font-panel w-max rounded border border-zinc-200 bg-white py-0.5 text-xs shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => { onAction(item.id); onClose(); }}
          className={`block w-full whitespace-nowrap text-left px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${item.danger ? 'text-red-600' : 'text-zinc-700 dark:text-zinc-200'}`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

export function ClientesDaSection({
  onRefresh,
  listFilter = 'all',
}: {
  onRefresh?: () => void;
  listFilter?: 'all' | 'client' | 'reseller';
}) {
  const { setChrome } = useAdminSectionChrome();
  const initialCache = useMemo(() => readClientesCache(), []);
  const [users, setUsers] = useState<DaUserRow[]>(initialCache?.users ?? []);
  const [packages, setPackages] = useState<PanelPackageOption[]>([]);
  const [license, setLicense] = useState<{ used: number; max: number; canCreateReseller: boolean; message?: string | null } | null>(null);
  const [loading, setLoading] = useState(!initialCache);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'create'>('list');
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [openMenu, setOpenMenu] = useState<{ userName: string; rect: DOMRect } | null>(null);
  const [passwordModal, setPasswordModal] = useState<{ userName: string; password: string } | null>(null);
  const [editModal, setEditModal] = useState<{
    userName: string;
    firstName: string;
    lastName: string;
    email: string;
    websitesLimit: number;
    emailsLimit: number;
  } | null>(null);
  const [messageModal, setMessageModal] = useState<{ userName: string; email: string; subject: string; body: string } | null>(null);
  const [syncMeta, setSyncMeta] = useState<{ lastSyncedAt: string | null; stale: boolean; source?: string } | null>(
    initialCache?.meta ?? null,
  );
  const [syncing, setSyncing] = useState(false);

  const [accountType, setAccountType] = useState<AccountType>('client');
  const [identity, setIdentity] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [packageName, setPackageName] = useState('');
  const [hosting, setHosting] = useState({ domain: '', adminEmail: '', php: '8.2' });
  const [options, setOptions] = useState({ createEmail: false, emailUser: 'info', issueSsl: false });

  const load = useCallback(async (options?: { sync?: boolean }) => {
    const withSync = options?.sync === true;
    if (withSync) setSyncing(true);
    else setLoading(true);
    try {
      const url = withSync ? '/api/admin/clientes?sync=1' : '/api/admin/clientes';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao carregar');
      setUsers(data.users || []);
      setPackages(data.packages || data.osherPackages || []);
      setLicense(data.license);
      setSyncMeta(data.meta || null);
      try {
        sessionStorage.setItem(
          CLIENTES_CACHE_KEY,
          JSON.stringify({ users: data.users || [], meta: data.meta || null, ts: Date.now() }),
        );
      } catch { /* quota */ }
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Erro ao carregar'}`);
    }
    setLoading(false);
    setSyncing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const goToList = useCallback(() => {
    setView('list');
    setMsg('');
  }, []);

  useEffect(() => {
    if (view === 'create') {
      setAccountType(listFilter === 'reseller' ? 'reseller' : 'client');
    }
  }, [view, listFilter]);

  useEffect(() => () => setChrome(null), [setChrome]);

  useEffect(() => {
    if (view === 'list') {
      setChrome({
        title: listFilter === 'reseller' ? 'Revendedores' : 'Clientes',
        search: {
          value: search,
          onChange: setSearch,
          placeholder: 'Pesquisar utilizador ou email…',
        },
      });
      return;
    }

    const stepLabel = WIZARD_STEPS.find((s) => s.n === step)?.label ?? '';
    setChrome({
      title: 'Criar nova conta',
      description: `Passo ${step} de 4 — ${stepLabel}`,
      back: { label: 'Voltar à lista', onClick: goToList },
    });
  }, [view, search, step, syncing, loading, setChrome, load, goToList, listFilter]);

  const filtered = users.filter((u) => {
    if (listFilter === 'client' && isDaReseller(u)) return false;
    if (listFilter === 'reseller' && !isDaReseller(u)) return false;
    const q = search.toLowerCase();
    return !q || u.userName.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  const derivedUser = () => {
    const d = hosting.domain.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
    if (d) return d;
    return identity.email.split('@')[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase() || 'cliente';
  };

  const handleCreate = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType,
          email: identity.email,
          password: identity.password,
          userName: derivedUser(),
          domain: hosting.domain,
          adminEmail: hosting.adminEmail || identity.email,
          packageName,
          createEmail: options.createEmail,
          emailUser: options.emailUser,
          issueSsl: options.issueSsl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao criar conta');
      }
      setMsg(`Conta criada: ${data.userName}${data.domain ? ` (${data.domain})` : ''}.`);
      setView('list');
      setStep(1);
      await load();
      onRefresh?.();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    }
    setBusy(false);
  };

  const handleRowAction = async (user: DaUserRow, action: string) => {
    const { userName } = user;
    if (action === 'sendMessage') {
      setMessageModal({
        userName,
        email: user.email || '',
        subject: `Mensagem — ${userName}`,
        body: '',
      });
      return;
    }
    if (action === 'editAccount') {
      setEditModal({
        userName: user.userName,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        websitesLimit: user.websitesLimit ?? 0,
        emailsLimit: user.emailsLimit ?? 0,
      });
      return;
    }
    if (action === 'loginAs') {
      setBusy(true);
      try {
        const res = await fetch('/api/admin/impersonate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userName }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível entrar como revendedor');
        window.location.href = data.redirect || '/revendedor';
      } catch (e: unknown) {
        setMsg(`❌ ${e instanceof Error ? e.message : 'Erro'}`);
        setBusy(false);
      }
      return;
    }
    if (action === 'changePassword') {
      setPasswordModal({ userName, password: generatePassword() });
      return;
    }
    if (action === 'delete' && !confirm(`Remover conta "${userName}"? Irreversível.`)) return;
    if (action === 'suspend' && !confirm(`Suspender "${userName}"?`)) return;

    setBusy(true);
    try {
      const res = await fetch('/api/admin/clientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action === 'delete' ? 'delete' : action,
          userName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha');
      setMsg(`✅ Acção concluída para ${userName}.`);
      await load();
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Erro'}`);
    }
    setBusy(false);
  };

  const sendMessage = async () => {
    if (!messageModal) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/clientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendMessage',
          userName: messageModal.userName,
          toEmail: messageModal.email,
          subject: messageModal.subject,
          message: messageModal.body,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao enviar');
      setMessageModal(null);
      setMsg(`✅ Mensagem enviada para ${data.data?.sentTo || messageModal.email}.`);
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Erro'}`);
    }
    setBusy(false);
  };

  const saveEditAccount = async () => {
    if (!editModal) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/clientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'editAccount',
          userName: editModal.userName,
          firstName: editModal.firstName,
          lastName: editModal.lastName,
          email: editModal.email,
          websitesLimit: editModal.websitesLimit,
          emailsLimit: editModal.emailsLimit,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao guardar');
      setEditModal(null);
      setMsg(`✅ Conta ${editModal.userName} actualizada.`);
      await load();
    } catch (e: unknown) {
      setMsg(`❌ ${e instanceof Error ? e.message : 'Erro'}`);
    }
    setBusy(false);
  };

  const savePassword = async () => {
    if (!passwordModal) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/clientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'changePassword',
          userName: passwordModal.userName,
          password: passwordModal.password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha');
      setPasswordModal(null);
      alert(`Password de ${passwordModal.userName} actualizada.`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    }
    setBusy(false);
  };

  const summarySidebar = (
    <aside className="sticky top-4 h-fit w-full shrink-0 rounded border border-gray-200 bg-gray-50 p-4 lg:w-72">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Resumo da conta</h3>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs text-zinc-400">Tipo</dt>
          <dd className="font-medium text-zinc-900">{accountType === 'client' ? 'Cliente' : 'Revendedor'}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">Nome</dt>
          <dd className="text-zinc-800">
            {identity.firstName || identity.lastName
              ? `${identity.firstName} ${identity.lastName}`.trim()
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">Email</dt>
          <dd className="break-all text-zinc-800">{identity.email || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">Utilizador</dt>
          <dd className="font-mono text-zinc-900">{derivedUser()}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-400">Pacote</dt>
          <dd className="text-zinc-900">{packageName || '—'}</dd>
        </div>
        {accountType === 'client' && (
          <div>
            <dt className="text-xs text-zinc-400">Domínio</dt>
            <dd className="break-all text-zinc-900">{hosting.domain || '—'}</dd>
          </div>
        )}
      </dl>
    </aside>
  );

  if (view === 'create') {
    return (
      <div className="font-panel space-y-4">
        <div className="flex gap-1 overflow-x-auto">
          {WIZARD_STEPS.map((s) => (
            <button
              key={s.n}
              onClick={() => setStep(s.n as Step)}
              className={`shrink-0 rounded border px-3 py-1 text-xs font-medium ${
                step === s.n
                  ? 'border-zinc-300 bg-white text-zinc-900 shadow-sm'
                  : 'border-transparent bg-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 bg-white border border-gray-200 rounded p-5">
            {step === 1 && (
              <div className="grid sm:grid-cols-2 gap-3">
                {([
                  { id: 'client' as const, title: 'Cliente', desc: 'Hospedagem para um cliente final' },
                  { id: 'reseller' as const, title: 'Revendedor', desc: 'Conta de revenda no servidor' },
                ]).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setAccountType(opt.id)}
                    disabled={opt.id === 'reseller' && Boolean(license && !license.canCreateReseller)}
                    className={`rounded border p-4 text-left disabled:opacity-40 ${
                      accountType === opt.id ? 'border-zinc-400 bg-zinc-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="font-bold">{opt.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Nome" value={identity.firstName} onChange={(e) => setIdentity({ ...identity, firstName: e.target.value })} className={inputCls} />
                <input placeholder="Apelido" value={identity.lastName} onChange={(e) => setIdentity({ ...identity, lastName: e.target.value })} className={inputCls} />
                <input placeholder="Email" type="email" value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })} className={`${inputCls} sm:col-span-2`} />
                <PasswordFields
                  password={identity.password}
                  confirmPassword={identity.confirmPassword}
                  onChange={({ password, confirmPassword }) => setIdentity({ ...identity, password, confirmPassword })}
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-600">Seleccione um pacote:</p>
                {packages.length === 0 ? (
                  <p className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">A carregar pacotes…</p>
                ) : (
                  <div className="space-y-2">
                    {packages.map((pkg) => (
                      <label
                        key={pkg.packageName}
                        className={`flex cursor-pointer items-center gap-3 rounded border p-3 ${
                          packageName === pkg.packageName ? 'border-zinc-400 bg-zinc-50' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="pkg"
                          checked={packageName === pkg.packageName}
                          onChange={() => setPackageName(pkg.packageName)}
                        />
                        <div className="flex-1 text-sm">
                          <div className="font-bold">{pkg.packageName}</div>
                          <div className="text-gray-500 text-xs">
                            Disco {pkg.diskSpace ?? '—'} MB · BW {pkg.bandwidth ?? '—'} · Emails {pkg.emailAccounts ?? '—'} · BD {pkg.dataBases ?? '—'}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 4 && accountType === 'client' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Domínio (exemplo.com)" value={hosting.domain} onChange={(e) => setHosting({ ...hosting, domain: e.target.value })} className={`${inputCls} sm:col-span-2`} />
                <input placeholder="Email admin" type="email" value={hosting.adminEmail} onChange={(e) => setHosting({ ...hosting, adminEmail: e.target.value })} className={`${inputCls} sm:col-span-2`} />
                <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={options.createEmail} onChange={(e) => setOptions({ ...options, createEmail: e.target.checked })} />
                  Criar email {options.emailUser}@domínio
                  <input value={options.emailUser} onChange={(e) => setOptions({ ...options, emailUser: e.target.value })} className="w-20 border rounded px-2 py-0.5 text-xs" />
                </label>
                <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={options.issueSsl} onChange={(e) => setOptions({ ...options, issueSsl: e.target.checked })} />
                  Emitir SSL Let&apos;s Encrypt
                </label>
              </div>
            )}

            {step === 4 && accountType === 'reseller' && (
              <div className="space-y-3 text-sm text-gray-600">
                <input placeholder="Domínio principal (opcional)" value={hosting.domain} onChange={(e) => setHosting({ ...hosting, domain: e.target.value })} className={inputCls} />
                <p>Utilizador: <strong>{derivedUser()}</strong></p>
              </div>
            )}

            {msg ? (
              <p className={`mt-4 text-sm p-2 rounded ${msg.includes('criada') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg}</p>
            ) : null}

            <div className="flex justify-between mt-6 pt-4 border-t">
              <button onClick={() => setStep((s) => Math.max(1, s - 1) as Step)} disabled={step === 1} className="text-sm text-gray-500 disabled:opacity-40">Anterior</button>
              {step < 4 ? (
                <button
                  onClick={() => setStep((s) => Math.min(4, s + 1) as Step)}
                  disabled={
                    (step === 2 && (identity.password.length < 8 || identity.password !== identity.confirmPassword || !identity.email.includes('@')))
                    || (step === 3 && !packageName)
                  }
                  className={actionBtnCls}
                >
                  Seguinte <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={busy || !packageName || (accountType === 'client' && !hosting.domain.includes('.')) || (accountType === 'reseller' && Boolean(license && !license.canCreateReseller))}
                  className={actionBtnCls}
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Criar conta
                </button>
              )}
            </div>
          </div>
          {summarySidebar}
        </div>
      </div>
    );
  }

  return (
    <div className="font-panel space-y-4">
      {msg ? (
        <p className={`text-sm p-2 rounded ${msg.includes('✅') || msg.includes('criada') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => { setView('create'); setMsg(''); setStep(1); setPackageName(''); }}
          className={headerBtnCls}
        >
          <Plus size={14} /> Criar conta
        </button>
        <button
          type="button"
          onClick={() => load({ sync: true })}
          disabled={loading || syncing}
          className={headerBtnCls}
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'A actualizar…' : 'Actualizar'}
        </button>
      </div>

      <div className="overflow-x-auto overflow-y-visible rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-sm text-zinc-900 dark:text-zinc-100">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3 hidden md:table-cell">Tipo</th>
              <th className="px-4 py-3 text-center">Domínios</th>
              <th className="px-4 py-3 hidden sm:table-cell">Data de registo</th>
              <th className="px-4 py-3 hidden lg:table-cell">Email</th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhum utilizador</td></tr>
            ) : filtered.map((u) => (
              <tr key={u.userName} className="border-t hover:bg-gray-50/80">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center"><User size={16} className="text-gray-500" /></div>
                    <div>
                      <div className="font-bold text-gray-900">{u.userName}</div>
                      {u.suspended && <span className="text-xs text-red-600">Suspenso</span>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                  {isDaReseller(u) ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-blue-100 text-blue-700">Revendedor</span>
                  ) : (
                    <span className="capitalize">{u.type || 'user'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center font-medium text-gray-900 tabular-nums">
                  {u.domainCount ?? 0}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-gray-600 whitespace-nowrap">
                  {formatRegisteredAt(u.registeredAt)}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-gray-600 truncate max-w-[180px]">{u.email || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isDaReseller(u) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRowAction(u, 'loginAs')}
                        className="hidden sm:inline-flex h-8 items-center rounded border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                      >
                        Entrar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (openMenu?.userName === u.userName) setOpenMenu(null);
                        else setOpenMenu({ userName: u.userName, rect });
                      }}
                      className="p-2 rounded hover:bg-gray-100 inline-flex"
                      aria-label="Mais opções"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openMenu && (() => {
        const u = filtered.find((x) => x.userName === openMenu.userName);
        if (!u) return null;
        return (
          <RowActionsMenu
            anchorRect={openMenu.rect}
            user={u}
            onAction={(a) => handleRowAction(u, a)}
            onClose={() => setOpenMenu(null)}
          />
        );
      })()}

      {messageModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMessageModal(null)} />
          <div className="relative bg-white border border-gray-200 rounded-lg w-full max-w-lg shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">Enviar mensagem — {messageModal.userName}</h3>
              <button type="button" onClick={() => setMessageModal(null)}><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <input
                value={messageModal.email}
                onChange={(e) => setMessageModal({ ...messageModal, email: e.target.value })}
                placeholder="Para (email)"
                className={inputCls}
              />
              <input
                value={messageModal.subject}
                onChange={(e) => setMessageModal({ ...messageModal, subject: e.target.value })}
                placeholder="Assunto"
                className={inputCls}
              />
              <textarea
                value={messageModal.body}
                onChange={(e) => setMessageModal({ ...messageModal, body: e.target.value })}
                placeholder="Mensagem..."
                rows={5}
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={sendMessage}
              disabled={busy || !messageModal.body.trim()}
              className={`mt-4 w-full justify-center ${actionBtnCls}`}
            >
              {busy ? 'A enviar...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditModal(null)} />
          <div className="font-panel relative w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Editar conta — {editModal.userName}</h3>
              <button type="button" onClick={() => setEditModal(null)}><X size={20} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                placeholder="Nome"
                value={editModal.firstName}
                onChange={(e) => setEditModal({ ...editModal, firstName: e.target.value })}
                className={inputCls}
              />
              <input
                placeholder="Apelido"
                value={editModal.lastName}
                onChange={(e) => setEditModal({ ...editModal, lastName: e.target.value })}
                className={inputCls}
              />
              <input
                type="email"
                placeholder="Email"
                value={editModal.email}
                onChange={(e) => setEditModal({ ...editModal, email: e.target.value })}
                className={`${inputCls} sm:col-span-2`}
              />
              <input
                type="number"
                min={0}
                placeholder="Limite de sites"
                value={editModal.websitesLimit}
                onChange={(e) => setEditModal({ ...editModal, websitesLimit: Number(e.target.value) || 0 })}
                className={inputCls}
              />
              <input
                type="number"
                min={0}
                placeholder="Limite de emails"
                value={editModal.emailsLimit}
                onChange={(e) => setEditModal({ ...editModal, emailsLimit: Number(e.target.value) || 0 })}
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={saveEditAccount}
              disabled={busy || !editModal.email.includes('@')}
              className={`mt-4 w-full justify-center ${actionBtnCls}`}
            >
              {busy ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {passwordModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded p-5 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Alterar senha — {passwordModal.userName}</h3>
              <button onClick={() => setPasswordModal(null)}><X size={20} /></button>
            </div>
            <div className="flex gap-2">
              <input value={passwordModal.password} onChange={(e) => setPasswordModal({ ...passwordModal, password: e.target.value })} className={inputCls} />
              <button onClick={() => setPasswordModal({ ...passwordModal, password: generatePassword() })} className="p-2 border rounded shrink-0" title="Gerar"><RefreshCw size={18} /></button>
            </div>
            <button onClick={savePassword} disabled={busy} className={`mt-4 w-full justify-center ${actionBtnCls}`}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}
