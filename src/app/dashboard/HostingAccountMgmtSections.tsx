'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome';
import { panelBtnPrimary, panelBtnSecondary, panelField } from '@/lib/panel-ui';
import { PRIMARY_RESELLER_DA_USER } from '@/lib/panel-contas-enrich';

type DaUserRow = {
  userName: string;
  email?: string;
  type?: string;
  resellerOwner?: string;
};

type MessageTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

const TEMPLATE_STORAGE_KEY = 'vd-account-message-templates-v1';

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'welcome',
    name: 'Boas-vindas',
    subject: 'Bem-vindo à VisualDesign',
    body: 'Olá,\n\nA sua conta de hospedagem foi criada com sucesso.\n\nCom os melhores cumprimentos,\nEquipa VisualDesign',
  },
  {
    id: 'payment',
    name: 'Aviso de renovação',
    subject: 'Renovação do seu serviço',
    body: 'Olá,\n\nO seu serviço está próximo da data de renovação. Contacte-nos se precisar de apoio.\n\nEquipa VisualDesign',
  },
  {
    id: 'suspend',
    name: 'Conta suspensa',
    subject: 'Conta suspensa',
    body: 'Olá,\n\nA sua conta foi suspensa. Responda a este email para reactivar o serviço.\n\nEquipa VisualDesign',
  },
];

function readTemplates(): MessageTemplate[] {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES;
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return DEFAULT_TEMPLATES;
    const parsed = JSON.parse(raw) as MessageTemplate[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

function writeTemplates(templates: MessageTemplate[]) {
  try {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    /* quota */
  }
}

const MOVE_FORM_CARD_CLS =
  'rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900';

const MOVE_CLIENTES_CACHE_KEY = 'vd-admin-clientes-v4';

function readMoveClientesCache(): DaUserRow[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(MOVE_CLIENTES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { users?: DaUserRow[] };
    return Array.isArray(parsed.users) && parsed.users.length ? parsed.users : null;
  } catch {
    return null;
  }
}

function writeMoveClientesCache(users: DaUserRow[]) {
  try {
    const raw = sessionStorage.getItem(MOVE_CLIENTES_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    sessionStorage.setItem(
      MOVE_CLIENTES_CACHE_KEY,
      JSON.stringify({ ...parsed, users, ts: Date.now() }),
    );
  } catch {
    /* quota */
  }
}

function deriveResellerList(users: DaUserRow[], primary?: string | null): string[] {
  const names = users
    .filter((u) => String(u.type || '').toLowerCase() === 'reseller')
    .map((u) => u.userName);
  const p = String(primary || PRIMARY_RESELLER_DA_USER);
  return [...new Set([p, ...names])].filter(Boolean);
}

function isHostingAccount(row: DaUserRow): boolean {
  return String(row.type || '').toLowerCase() !== 'reseller';
}

export function MoveUsersBetweenResellersSection({ isActive = true }: { isActive?: boolean }) {
  const { setChrome } = useAdminSectionChrome();
  const [users, setUsers] = useState<DaUserRow[]>([]);
  const [resellers, setResellers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [fromReseller, setFromReseller] = useState('');
  const [toReseller, setToReseller] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const defaultsSetRef = useRef(false);

  const applyClientesPayload = useCallback((allUsers: DaUserRow[], primary?: string | null) => {
    const resellerList = deriveResellerList(allUsers, primary);
    setUsers(allUsers.filter(isHostingAccount));
    setResellers(resellerList);
    if (!defaultsSetRef.current && resellerList.length > 0) {
      setFromReseller(resellerList[0]);
      setToReseller(resellerList[1] ?? resellerList[0]);
      defaultsSetRef.current = true;
    }
  }, []);

  const fetchClientes = useCallback(
    async (sync = false) => {
      const url = sync ? '/api/admin/clientes?sync=1' : '/api/admin/clientes';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao carregar contas');
      const allUsers: DaUserRow[] = data.users || [];
      const primary = data.primaryResellerAccount || data.osherReseller || null;
      writeMoveClientesCache(allUsers);
      applyClientesPayload(allUsers, primary);
    },
    [applyClientesPayload],
  );

  const refresh = useCallback(
    async (options?: { sync?: boolean; background?: boolean }) => {
      const sync = options?.sync === true;
      const background = options?.background === true;
      if (sync) setSyncing(true);
      else if (!background) setLoading(true);
      setMsg('');
      try {
        await fetchClientes(sync);
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : 'Erro ao carregar');
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    },
    [fetchClientes],
  );

  useEffect(() => {
    if (!isActive) return;
    setChrome(null);

    const cached = readMoveClientesCache();
    if (cached?.length) {
      applyClientesPayload(cached, null);
      setLoading(false);
      void refresh({ background: true });
    } else {
      void refresh();
    }

    return () => setChrome(null);
  }, [isActive, applyClientesPayload, refresh, setChrome]);

  const movableUsers = useMemo(
    () =>
      users.filter((u) => {
        if (!fromReseller) return true;
        const owner = String(u.resellerOwner || '').toLowerCase();
        return owner === fromReseller.toLowerCase() || owner === 'admin' || owner === '—' || !owner;
      }),
    [users, fromReseller],
  );

  useEffect(() => {
    if (!selectedUser) return;
    if (!movableUsers.some((u) => u.userName === selectedUser)) setSelectedUser('');
  }, [movableUsers, selectedUser]);

  const submit = async () => {
    if (!selectedUser || !fromReseller || !toReseller) {
      setMsg('Seleccione utilizador, revendedor actual e destino.');
      return;
    }
    if (fromReseller === toReseller) {
      setMsg('O revendedor de origem e destino devem ser diferentes.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/clientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'moveToReseller',
          userName: selectedUser,
          fromReseller,
          toReseller,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao mover');
      setMsg(`Conta ${selectedUser} movida para ${toReseller}.`);
      setSelectedUser('');
      await refresh({ sync: true });
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro ao mover');
    }
    setBusy(false);
  };

  const showInitialLoader = loading && users.length === 0;

  return (
    <div className="space-y-4 font-panel">
      <div className={MOVE_FORM_CARD_CLS}>
        {showInitialLoader ? (
          <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar contas…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400">
                  Revendedor actual
                </span>
                <select
                  value={fromReseller}
                  onChange={(e) => setFromReseller(e.target.value)}
                  className={`${panelField} w-full`}
                  disabled={busy || syncing}
                >
                  {resellers.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400">
                  Novo revendedor
                </span>
                <select
                  value={toReseller}
                  onChange={(e) => setToReseller(e.target.value)}
                  className={`${panelField} w-full`}
                  disabled={busy || syncing}
                >
                  {resellers.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400">
                  Utilizador
                </span>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className={`${panelField} w-full`}
                  disabled={busy || syncing}
                >
                  <option value="">Seleccionar…</option>
                  {movableUsers.map((u) => (
                    <option key={u.userName} value={u.userName}>
                      {u.userName}
                      {u.email ? ` (${u.email})` : ''}
                      {u.resellerOwner ? ` · ${u.resellerOwner}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {movableUsers.length} conta(s) disponível(is) no revendedor seleccionado.
                </p>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || syncing || showInitialLoader}
                className={panelBtnPrimary}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Mover conta
              </button>
              <button
                type="button"
                onClick={() => void refresh({ sync: true })}
                disabled={syncing || busy}
                className={panelBtnSecondary}
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          </>
        )}

        {msg ? (
          <p
            className={`mt-4 text-sm ${
              msg.includes('movida') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
            }`}
          >
            {msg}
          </p>
        ) : null}
      </div>
    </div>
  );
}

async function loadHostingUsers(): Promise<DaUserRow[]> {
  const res = await fetch('/api/admin/clientes', { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao carregar contas');
  return data.users || [];
}

export function AccountMessageTemplatesSection({ isActive = true }: { isActive?: boolean }) {
  const { setChrome } = useAdminSectionChrome();
  const [templates, setTemplates] = useState<MessageTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedId, setSelectedId] = useState(DEFAULT_TEMPLATES[0]?.id || '');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!isActive) return;
    setChrome(null);
    setTemplates(readTemplates());
    return () => setChrome(null);
  }, [isActive, setChrome]);

  const selected = templates.find((t) => t.id === selectedId) || templates[0];

  const updateSelected = (patch: Partial<MessageTemplate>) => {
    if (!selected) return;
    setTemplates((prev) => prev.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)));
  };

  const save = () => {
    writeTemplates(templates);
    setMsg('Modelos guardados.');
    window.setTimeout(() => setMsg(''), 3000);
  };

  const resetDefaults = () => {
    setTemplates(DEFAULT_TEMPLATES);
    writeTemplates(DEFAULT_TEMPLATES);
    setSelectedId(DEFAULT_TEMPLATES[0]?.id || '');
    setMsg('Modelos repostos.');
  };

  return (
    <div className="space-y-6 font-panel">
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelectedId(t.id)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              selected?.id === t.id
                ? 'border-red-600 bg-red-50 text-red-700'
                : 'border-gray-200 text-gray-700 dark:border-zinc-700 dark:text-zinc-300'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase text-gray-500">Nome do modelo</span>
            <input
              value={selected.name}
              onChange={(e) => updateSelected({ name: e.target.value })}
              className={panelField}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase text-gray-500">Assunto</span>
            <input
              value={selected.subject}
              onChange={(e) => updateSelected({ subject: e.target.value })}
              className={panelField}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase text-gray-500">Mensagem</span>
            <textarea
              value={selected.body}
              onChange={(e) => updateSelected({ body: e.target.value })}
              rows={8}
              className={`${panelField} min-h-[10rem] resize-y`}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} className={panelBtnPrimary}>
              <Save className="h-4 w-4" />
              Guardar modelos
            </button>
            <button type="button" onClick={resetDefaults} className={panelBtnSecondary}>
              <Trash2 className="h-4 w-4" />
              Repor predefinições
            </button>
          </div>
          {msg ? <p className="text-sm text-green-700">{msg}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function BulkChangePasswordsSection({ isActive = true }: { isActive?: boolean }) {
  const { setChrome } = useAdminSectionChrome();
  const [users, setUsers] = useState<DaUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await loadHostingUsers());
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro ao carregar');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    setChrome(null);
    void load();
    return () => setChrome(null);
  }, [isActive, load, setChrome]);

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.userName.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  const savePassword = async (userName: string) => {
    const password = passwords[userName] || '';
    if (password.length < 8) {
      setMsg('A password deve ter pelo menos 8 caracteres.');
      return;
    }
    setBusyUser(userName);
    setMsg('');
    try {
      const res = await fetch('/api/admin/clientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'changePassword', userName, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao alterar senha');
      setPasswords((prev) => ({ ...prev, [userName]: '' }));
      setMsg(`Password actualizada para ${userName}.`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Erro ao alterar senha');
    }
    setBusyUser(null);
  };

  return (
    <div className="space-y-4 font-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar utilizador ou email…"
          className={`${panelField} w-full sm:max-w-xs`}
        />
        <button type="button" onClick={() => void load()} className={panelBtnSecondary} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {msg ? <p className="text-sm text-gray-700 dark:text-zinc-300">{msg}</p> : null}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="grid grid-cols-12 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-bold uppercase text-gray-500 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="col-span-4">Utilizador</div>
          <div className="col-span-5">Nova password</div>
          <div className="col-span-3 text-right">Acção</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">Nenhuma conta encontrada.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-zinc-800">
            {filtered.map((u) => (
              <div key={u.userName} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
                <div className="col-span-12 sm:col-span-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{u.userName}</p>
                  <p className="text-xs text-gray-500">{u.email || '—'}</p>
                </div>
                <div className="col-span-12 sm:col-span-5">
                  <input
                    type="password"
                    value={passwords[u.userName] || ''}
                    onChange={(e) => setPasswords((prev) => ({ ...prev, [u.userName]: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                    className={panelField}
                  />
                </div>
                <div className="col-span-12 flex justify-end sm:col-span-3">
                  <button
                    type="button"
                    onClick={() => void savePassword(u.userName)}
                    disabled={busyUser === u.userName}
                    className={panelBtnPrimary}
                  >
                    {busyUser === u.userName ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function getAccountMessageTemplates(): MessageTemplate[] {
  return readTemplates();
}
