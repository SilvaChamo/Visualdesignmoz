'use client';

import { useState } from 'react';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { panelBtnPrimary, panelBtnSecondary, panelField } from '@/lib/panel-ui';

export function DomainTransferSection() {
  const [domain, setDomain] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim() || !authCode.trim()) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/domain-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim(), tld: '' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsgOk(false);
        setMsg(data.error || 'Não foi possível validar o domínio.');
        return;
      }
      setMsgOk(true);
      setMsg(
        `Pedido registado para ${domain.trim()}. A equipa concluirá a transferência com o código EPP indicado. Pode acompanhar em Notificações → Cadastrar.`,
      );
      setDomain('');
      setAuthCode('');
    } catch (e: unknown) {
      setMsgOk(false);
      setMsg(e instanceof Error ? e.message : 'Erro ao enviar pedido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded border border-gray-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-gray-200 dark:border-zinc-700">
            <ArrowRightLeft className="h-5 w-5 text-gray-600 dark:text-zinc-400" />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              Introduza o domínio e o código de autorização (EPP) do registador actual. O domínio permanece activo durante a transferência.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">
              Domínio
            </label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="exemplo.com"
              className={`${panelField} w-full font-mono`}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">
              Código de autorização (EPP)
            </label>
            <input
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              placeholder="Código do registador actual"
              className={`${panelField} w-full font-mono`}
              required
            />
          </div>

          {msg && (
            <div
              className={`rounded border px-4 py-3 text-sm ${
                msgOk
                  ? 'border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400'
              }`}
            >
              {msg}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" disabled={loading || !domain.trim() || !authCode.trim()} className={panelBtnPrimary}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              Iniciar transferência
            </button>
            <button
              type="button"
              onClick={() => {
                setDomain('');
                setAuthCode('');
                setMsg('');
              }}
              className={panelBtnSecondary}
            >
              Limpar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
