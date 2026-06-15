'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MoreVertical, Plus, RefreshCw, User, X } from 'lucide-react';
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome';
import { ProvisionAccountFormInline } from '@/app/admin/ProvisionAccountFormInline';
import type { DirectAdminPackage } from '@/lib/directadmin-api';

const CLIENTES_CACHE_KEY = 'vd-admin-clientes-v1';

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

const headerBtnCls =
  'inline-flex h-[30px] items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';

const actionBtnCls =
  'inline-flex h-[30px] items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';

function generatePassword(length = 16): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

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
  packages = [],
  initialView = 'list',
  initialAccountType = 'client',
  isActive = true,
}: {
  onRefresh?: () => void;
  listFilter?: 'all' | 'client' | 'reseller';
  packages?: DirectAdminPackage[];
  initialView?: 'list' | 'create';
  initialAccountType?: 'client' | 'reseller' | 'admin';
  isActive?: boolean;
}) {
  const { setChrome } = useAdminSectionChrome();
  const initialCache = useMemo(() => readClientesCache(), []);
  const [users, setUsers] = useState<DaUserRow[]>(initialCache?.users ?? []);
  const [loading, setLoading] = useState(!initialCache);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'create'>(initialView);
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

  useEffect(() => { load(); }, [load]);

  const goToList = useCallback(() => {
    setView('list');
    setMsg('');
  }, []);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    if (!isActive) return;
    if (view === 'list') {
      setChrome({
        search: {
          value: search,
          onChange: setSearch,
          placeholder: 'Pesquisar utilizador ou email…',
        },
        toolbar: (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setView('create'); setMsg(''); }}
              className="flex items-center gap-2 rounded border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
            >
              <Plus className="h-4 w-4" />
              Criar conta
            </button>
            <button
              type="button"
              onClick={() => void load({ sync: true })}
              disabled={loading || syncing}
              className={headerBtnCls}
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'A actualizar…' : 'Actualizar'}
            </button>
          </div>
        ),
      });
    } else {
      setChrome({
        toolbar: (
          <button
            type="button"
            onClick={goToList}
            className="flex items-center gap-2 rounded border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
          >
            Cancelar
          </button>
        ),
      });
    }
    return () => setChrome(null);
  }, [view, search, syncing, loading, setChrome, load, goToList, isActive]);

  const filtered = users.filter((u) => {
    if (listFilter === 'client' && isDaReseller(u)) return false;
    if (listFilter === 'reseller' && !isDaReseller(u)) return false;
    const q = search.toLowerCase();
    return !q || u.userName.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
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

  if (view === 'create') {
    return (
      <div className="font-panel space-y-4">
        <ProvisionAccountFormInline
          packages={packages}
          initialAccountType={initialAccountType}
          onCancel={goToList}
          onComplete={() => {
            void load({ sync: true });
            onRefresh?.();
            setMsg('✅ Conta criada com sucesso.');
          }}
        />
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
