'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Layers, Lock, LogIn, LogOut, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { panelBtnPrimary, panelBtnSecondary, panelCard, panelField } from '@/lib/panel-ui';
import {
  ACCOUNT_LEVEL_LABELS,
  ACCOUNT_LEVEL_SUMMARIES,
  type AccountScopeSummary,
} from '@/lib/account-levels';
import { clearAllPanelClientCaches } from '@/lib/panel-session-cache-clear';

/**
 * "Contas dos domínios" no hub de Domínios (painel revendedor/profissional):
 * nível da conta, contas de domínio ligadas e — conforme o nível — entrar
 * nelas com credenciais (Premium) ou geri-las daqui (Enterprise).
 */

type ApiResult<T> = { success: boolean; error?: string } & T;

async function postLinkedAccounts<T>(body: Record<string, unknown>): Promise<ApiResult<T>> {
  const res = await fetch('/api/panel/linked-accounts', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as ApiResult<T>;
  if (!res.ok && !data.error) data.error = 'O pedido falhou. Tente de novo.';
  return { ...data, success: res.ok && data.success !== false };
}

/** Troca de conta: limpa as caches do painel (são por browser, não por conta)
 * e recarrega, para nada da conta anterior ficar à vista. */
function reloadPanelFresh() {
  clearAllPanelClientCaches();
  window.location.reload();
}

export function LinkedAccountBanner({ account }: { account: string }) {
  const [leaving, setLeaving] = useState(false);
  const leave = async () => {
    setLeaving(true);
    await postLinkedAccounts({ action: 'leave' }).catch(() => undefined);
    reloadPanelFresh();
  };
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-100">
      <span className="flex min-w-0 items-center gap-2">
        <KeyRound className="h-4 w-4 shrink-0" />
        <span className="min-w-0">
          Está dentro da conta de domínio <strong className="break-all">{account}</strong> — tudo o que fizer aqui aplica-se só a esta conta.
        </span>
      </span>
      <button
        type="button"
        onClick={leave}
        disabled={leaving}
        className="flex shrink-0 items-center gap-1.5 rounded bg-sky-950/10 px-3 py-1 font-semibold transition-colors hover:bg-sky-950/20 disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/20"
      >
        <LogOut className="h-3.5 w-3.5" />
        {leaving ? 'A sair...' : 'Voltar à conta principal'}
      </button>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
      title="Copiar"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

function EnterForm({ username, onCancel }: { username: string; onCancel: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await postLinkedAccounts<{ entered?: string }>({ action: 'enter', username, password });
    if (result.success) {
      reloadPanelFresh();
      return;
    }
    setBusy(false);
    setError(result.error || 'Não foi possível entrar nesta conta.');
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label className="text-xs text-zinc-500 dark:text-zinc-400" htmlFor={`linked-pw-${username}`}>
          Password da conta <strong>{username}</strong>
        </label>
        <input
          id={`linked-pw-${username}`}
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={cn(panelField, 'w-full')}
        />
        {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      </div>
      <div className="flex gap-2 sm:mt-5">
        <button type="submit" disabled={busy || !password} className={panelBtnPrimary}>
          <LogIn className="h-4 w-4" />
          {busy ? 'A confirmar...' : 'Entrar'}
        </button>
        <button type="button" onClick={onCancel} className={panelBtnSecondary} aria-label="Cancelar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

function CreateForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ username: string; password: string; domain: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await postLinkedAccounts<{ account?: { username: string; password: string; domain: string } }>({
      action: 'create',
      domain,
    });
    setBusy(false);
    if (result.success && result.account) {
      setCreated(result.account);
      onCreated();
      return;
    }
    setError(result.error || 'Não foi possível criar a conta deste domínio.');
  };

  if (created) {
    return (
      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-medium">Conta criada para {created.domain}.</p>
        <p className="mt-1 text-xs">
          Guarde já estes dados — a password não volta a ser mostrada. São as credenciais para entrar na conta deste domínio.
        </p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-sm">
          <dt className="text-xs text-emerald-800 dark:text-emerald-300">Utilizador</dt>
          <dd className="flex min-w-0 items-center gap-2 font-mono">
            <span className="break-all">{created.username}</span>
            <CopyButton value={created.username} />
          </dd>
          <dt className="text-xs text-emerald-800 dark:text-emerald-300">Password</dt>
          <dd className="flex min-w-0 items-center gap-2 font-mono">
            <span className="break-all">{created.password}</span>
            <CopyButton value={created.password} />
          </dd>
        </dl>
        <button type="button" onClick={onCancel} className={cn(panelBtnSecondary, 'mt-3')}>
          Fechar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label className="text-xs text-zinc-500 dark:text-zinc-400" htmlFor="linked-new-domain">
          Domínio novo (fica com conta e espaço próprios)
        </label>
        <input
          id="linked-new-domain"
          placeholder="exemplo.co.mz"
          autoFocus
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className={cn(panelField, 'w-full')}
        />
        {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      </div>
      <div className="flex gap-2 sm:mt-5">
        <button type="submit" disabled={busy || !domain.includes('.')} className={panelBtnPrimary}>
          <Plus className="h-4 w-4" />
          {busy ? 'A criar...' : 'Criar'}
        </button>
        <button type="button" onClick={onCancel} className={panelBtnSecondary} aria-label="Cancelar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

export function LinkedAccountsPanel({ onChanged }: { onChanged?: () => void }) {
  const [data, setData] = useState<AccountScopeSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [entering, setEntering] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/panel/linked-accounts', { credentials: 'include', cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: AccountScopeSummary | null };
      setData(res.ok && json.success ? json.data ?? null : null);
    } catch {
      setData(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded || !data || !data.level) return null;

  const level = data.level;
  const canHaveLinked = level === 'premium' || level === 'enterprise';
  const usage =
    data.domainLimit !== null
      ? `${data.domainCount} de ${data.domainLimit} domínio${data.domainLimit === 1 ? '' : 's'}`
      : `${data.domainCount} domínio${data.domainCount === 1 ? '' : 's'}`;

  const leave = async () => {
    setLeaving(true);
    await postLinkedAccounts({ action: 'leave' }).catch(() => undefined);
    reloadPanelFresh();
  };

  return (
    <section className={cn(panelCard, 'p-4 md:p-5')} aria-label="Contas dos domínios">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Layers className="h-4 w-4 shrink-0 text-red-600 dark:text-red-500" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Contas dos domínios</h3>
          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            Plano {ACCOUNT_LEVEL_LABELS[level]}
          </span>
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{usage}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{ACCOUNT_LEVEL_SUMMARIES[level]}</p>

      {data.entered ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          <span>
            Está dentro da conta <strong>{data.entered}</strong>.
          </span>
          <button type="button" onClick={leave} disabled={leaving} className={panelBtnSecondary}>
            <LogOut className="h-4 w-4" />
            {leaving ? 'A sair...' : 'Voltar à conta principal'}
          </button>
        </div>
      ) : null}

      {canHaveLinked ? (
        <>
          {data.linked.length ? (
            <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-zinc-800 dark:border-zinc-700">
              {data.linked.map((row) => {
                const isEntered = data.entered === row.username;
                return (
                  <li key={row.username} className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-all text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {row.domains.length ? row.domains.join(', ') : 'Sem domínio'}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Conta <span className="font-mono">{row.username}</span>
                          {row.packageName ? ` · ${row.packageName}` : ''}
                        </p>
                      </div>
                      {isEntered ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                          Está nesta conta
                        </span>
                      ) : row.locked ? (
                        entering === row.username ? null : (
                          <button
                            type="button"
                            onClick={() => {
                              setCreating(false);
                              setEntering(row.username);
                            }}
                            className={panelBtnSecondary}
                          >
                            <Lock className="h-4 w-4" />
                            Entrar na conta
                          </button>
                        )
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Gerida daqui
                        </span>
                      )}
                    </div>
                    {entering === row.username ? (
                      <EnterForm username={row.username} onCancel={() => setEntering(null)} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-gray-200 px-3 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Ainda não há domínios com conta própria.
            </p>
          )}

          {!data.entered ? (
            creating ? (
              <CreateForm
                onCreated={() => {
                  void load();
                  onChanged?.();
                }}
                onCancel={() => setCreating(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEntering(null);
                  setCreating(true);
                }}
                className={cn(panelBtnSecondary, 'mt-3')}
              >
                <Plus className="h-4 w-4" />
                Adicionar domínio com conta própria
              </button>
            )
          ) : null}
        </>
      ) : null}
    </section>
  );
}
