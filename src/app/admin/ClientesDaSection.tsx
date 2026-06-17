'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, MoreVertical, PlusCircle, RefreshCw, X } from 'lucide-react';
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome';
import { ProvisionClienteSection } from '@/app/admin/ProvisionClienteSection';
import type { DirectAdminPackage } from '@/lib/directadmin-api';
import { panelBtnPrimary, panelBtnSecondary, panelField } from '@/lib/panel-ui';

const CLIENTES_CACHE_KEY = 'vd-admin-clientes-v2';

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
  primaryDomain?: string;
  packageName?: string;
  quotaLabel?: string;
  diskUsedLabel?: string;
  resellerOwner?: string;
  ownedDomains?: Array<{
    domain: string;
    package: string;
    diskUsage: string;
    status: string;
  }>;
}

type AccountsView = 'list' | 'create' | 'edit' | 'detail';

const accountsCellBorder =
  'border-r border-gray-100 px-4 py-1.5 text-left whitespace-nowrap dark:border-zinc-800 last:border-r-0';

function readClientesCache(): { users: DaUserRow[]; meta: { lastSyncedAt: string | null; stale: boolean } | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CLIENTES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { users?: DaUserRow[]; meta?: { lastSyncedAt: string | null; stale: boolean } };
    if (!Array.isArray(parsed.users)) return null;
    if (parsed.users.length === 0) return null;
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
  return trimmed.split(/[ T]/)[0] || trimmed;
}

function daLoginHref(userName: string): string {
  return `/api/directadmin-access?user=${encodeURIComponent(userName)}`;
}

const actionBtnCls =
  'inline-flex h-[30px] items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';

const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/30';

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
          className={`block w-full whitespace-nowrap text-left px-3 py-1.5 text-zinc-700 transition-colors hover:text-red-600 dark:text-zinc-200 dark:hover:bg-transparent dark:hover:text-red-400 ${item.danger ? 'text-red-600 dark:text-red-400' : ''}`}
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
  packages = [],
  initialView = 'list',
  initialAccountType = 'client',
  isActive = true,
  listResetToken = 0,
}: {
  onRefresh?: () => void;
  listFilter?: 'all' | 'client' | 'reseller';
  packages?: DirectAdminPackage[];
  initialView?: 'list' | 'create';
  initialAccountType?: 'client' | 'reseller' | 'professional' | 'admin';
  isActive?: boolean;
  /** Incrementado ao reabrir «Contas» no menu — repõe a listagem. */
  listResetToken?: number;
}) {
  const { setChrome } = useAdminSectionChrome();
  const searchParams = useSearchParams();
  const initialCache = useMemo(() => readClientesCache(), []);
  const [users, setUsers] = useState<DaUserRow[]>(initialCache?.users ?? []);
  const [loading, setLoading] = useState(!initialCache);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<AccountsView>(initialView === 'create' ? 'create' : 'list');
  const [selectedUser, setSelectedUser] = useState<DaUserRow | null>(null);
  const [editUser, setEditUser] = useState<DaUserRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [openMenu, setOpenMenu] = useState<{ userName: string; rect: DOMRect } | null>(null);
  const [passwordModal, setPasswordModal] = useState<{ userName: string; password: string; confirmPassword: string } | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [messageModal, setMessageModal] = useState<{ userName: string; email: string; subject: string; body: string } | null>(null);
  const [syncMeta, setSyncMeta] = useState<{ lastSyncedAt: string | null; stale: boolean; source?: string } | null>(
    initialCache?.meta ?? null,
  );
  const [syncing, setSyncing] = useState(false);

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

  useEffect(() => {
    const err = searchParams.get('impersonate_error');
    if (err) {
      setMsg(`❌ ${err}`);
      window.history.replaceState({}, '', '/admin');
    }
  }, [searchParams]);

  useEffect(() => { load(); }, [load]);

  const goToList = useCallback(() => {
    setView('list');
    setSelectedUser(null);
    setEditUser(null);
    setMsg('');
  }, []);

  useEffect(() => {
    if (isActive) {
      setView(initialView === 'create' ? 'create' : 'list');
      if (initialView !== 'create') {
        setSelectedUser(null);
        setEditUser(null);
      }
    }
  }, [isActive, initialView, listResetToken]);

  useEffect(() => {
    if (!isActive) return;
    setChrome(null);
    return () => setChrome(null);
  }, [isActive, setChrome]);

  const filtered = users.filter((u) => {
    if (listFilter === 'client' && isDaReseller(u)) return false;
    if (listFilter === 'reseller' && !isDaReseller(u)) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      u.userName.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.primaryDomain || '').toLowerCase().includes(q)
    );
  });

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
      setEditUser(user);
      setView('edit');
      return;
    }
    if (action === 'loginAs') {
      window.location.href = `/api/admin/impersonate?user=${encodeURIComponent(userName)}`;
      return;
    }
    if (action === 'changePassword') {
      setPasswordModal({ userName, password: '', confirmPassword: '' });
      setShowPasswordModal(false);
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

  const savePassword = async () => {
    if (!passwordModal) return;
    if (passwordModal.password.length < 8) {
      alert('A password deve ter pelo menos 8 caracteres.');
      return;
    }
    if (passwordModal.password !== passwordModal.confirmPassword) {
      alert('As passwords não coincidem.');
      return;
    }
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

  if (view === 'create' || view === 'edit') {
    return (
      <div className="font-panel space-y-6">
        <ProvisionClienteSection
          packages={packages}
          initialAccountType={initialAccountType === 'admin' ? 'professional' : initialAccountType}
          mode={view === 'edit' ? 'edit' : 'create'}
          editUser={view === 'edit' ? editUser ?? undefined : undefined}
          onCancel={goToList}
          onComplete={() => {
            void load({ sync: true });
            onRefresh?.();
            goToList();
          }}
        />
      </div>
    );
  }

  if (view === 'detail' && selectedUser) {
    const domains = selectedUser.ownedDomains || [];
    return (
      <div className="font-panel space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={goToList} className={panelBtnSecondary}>
            Voltar à lista
          </button>
          <div className="flex gap-2">
            <a
              href={daLoginHref(selectedUser.userName)}
              target="_blank"
              rel="noopener noreferrer"
              className={panelBtnSecondary}
            >
              Login
            </a>
            <button
              type="button"
              onClick={() => { setEditUser(selectedUser); setView('edit'); }}
              className={panelBtnPrimary}
            >
              Editar conta
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">{selectedUser.primaryDomain || selectedUser.userName}</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Utilizador: {selectedUser.userName}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Quota', value: selectedUser.quotaLabel || '—' },
            { label: 'Disco usado', value: selectedUser.diskUsedLabel || '0 MB' },
            { label: 'Pacote', value: selectedUser.packageName || '—' },
            { label: 'Domínios', value: String(selectedUser.domainCount ?? domains.length) },
            { label: 'E-mail', value: selectedUser.email || '—' },
            { label: 'Revendedor', value: selectedUser.resellerOwner || '—' },
            { label: 'Data', value: formatRegisteredAt(selectedUser.registeredAt) },
            { label: 'Estado', value: selectedUser.suspended ? 'Suspenso' : 'Activo' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs font-bold uppercase text-gray-400">{item.label}</p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-zinc-100">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold uppercase text-gray-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className={`${accountsCellBorder} py-3`}>Domínio</th>
                <th className={`${accountsCellBorder} py-3`}>Pacote</th>
                <th className={`${accountsCellBorder} py-3`}>Disco</th>
                <th className={`${accountsCellBorder} py-3`}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {domains.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Sem domínios registados</td></tr>
              ) : domains.map((d) => (
                <tr key={d.domain} className="border-b border-gray-100 dark:border-zinc-800">
                  <td className={accountsCellBorder}>{d.domain}</td>
                  <td className={accountsCellBorder}>{d.package}</td>
                  <td className={accountsCellBorder}>{d.diskUsage} MB</td>
                  <td className={accountsCellBorder}>{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="font-panel space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar domínio, utilizador ou email…"
          className={`${panelField} w-full sm:max-w-[20rem]`}
        />
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => { setView('create'); setMsg(''); }}
            className={`${panelBtnPrimary} whitespace-nowrap`}
          >
            <PlusCircle className="h-4 w-4" />
            Criar conta
          </button>
          <button
            type="button"
            onClick={() => void load({ sync: true })}
            disabled={loading || syncing}
            title="Actualizar"
            className={panelBtnSecondary}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {msg ? (
        <p className={`text-sm p-2 rounded ${msg.includes('✅') || msg.includes('criada') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold uppercase text-gray-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <th className={`${accountsCellBorder} py-3`}>Domínio</th>
              <th className={`${accountsCellBorder} py-3`}>Utilizador</th>
              <th className={`${accountsCellBorder} py-3`}>E-mail</th>
              <th className={`${accountsCellBorder} py-3`}>Quota</th>
              <th className={`${accountsCellBorder} py-3`}>Disco</th>
              <th className={`${accountsCellBorder} py-3`}>Pacote</th>
              <th className={`${accountsCellBorder} py-3`}>Revendedor</th>
              <th className={`${accountsCellBorder} py-3`}>Data</th>
              <th className="px-4 py-3 text-left w-12">Acções</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Nenhuma conta</td></tr>
            ) : filtered.map((u) => (
              <tr
                key={u.userName}
                className={`border-b border-gray-200 transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-transparent ${u.suspended ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`}
              >
                <td className={accountsCellBorder}>
                  <button
                    type="button"
                    onClick={() => { setSelectedUser(u); setView('detail'); }}
                    className="font-medium text-blue-700 hover:underline dark:text-blue-400"
                  >
                    {u.primaryDomain || `${u.userName}.com`}
                  </button>
                  {u.suspended ? <span className="ml-2 text-xs text-red-600">Suspenso</span> : null}
                </td>
                <td className={`${accountsCellBorder} font-medium text-gray-900 dark:text-zinc-100`}>{u.userName}</td>
                <td className={`${accountsCellBorder} text-gray-600 dark:text-zinc-400`}>{u.email || '—'}</td>
                <td className={`${accountsCellBorder} text-gray-700 tabular-nums dark:text-zinc-300`}>{u.quotaLabel || '—'}</td>
                <td className={`${accountsCellBorder} text-gray-700 tabular-nums dark:text-zinc-300`}>{u.diskUsedLabel || '0 MB'}</td>
                <td className={`${accountsCellBorder} text-blue-700 dark:text-blue-400`}>{u.packageName || '—'}</td>
                <td className={`${accountsCellBorder} text-gray-600 dark:text-zinc-400`}>{u.resellerOwner || '—'}</td>
                <td className={`${accountsCellBorder} text-gray-600 dark:text-zinc-400`}>
                  {formatRegisteredAt(u.registeredAt)}
                </td>
                <td className="px-4 py-1.5 text-left">
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      if (openMenu?.userName === u.userName) setOpenMenu(null);
                      else setOpenMenu({ userName: u.userName, rect });
                    }}
                    className="inline-flex rounded border border-gray-200 p-1.5 text-zinc-600 transition-colors hover:border-red-300 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-red-800 dark:hover:bg-transparent dark:hover:text-red-400"
                    aria-label="Mais opções"
                  >
                    <MoreVertical size={18} />
                  </button>
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

      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-zinc-100">
              Alterar password — {passwordModal.userName}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Nova password</label>
                <div className="relative">
                  <input
                    type={showPasswordModal ? 'text' : 'password'}
                    value={passwordModal.password}
                    onChange={(e) => setPasswordModal({ ...passwordModal, password: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                    className={`${panelField} w-full pr-10`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
                    aria-label={showPasswordModal ? 'Ocultar password' : 'Mostrar password'}
                  >
                    {showPasswordModal ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Confirmar password</label>
                <input
                  type={showPasswordModal ? 'text' : 'password'}
                  value={passwordModal.confirmPassword}
                  onChange={(e) => setPasswordModal({ ...passwordModal, confirmPassword: e.target.value })}
                  placeholder="Repetir password"
                  className={`${panelField} w-full`}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setPasswordModal(null); setShowPasswordModal(false); }}
                className={panelBtnSecondary}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={savePassword}
                disabled={busy || passwordModal.password.length < 8 || passwordModal.password !== passwordModal.confirmPassword}
                className={panelBtnPrimary}
              >
                {busy ? 'A guardar…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
