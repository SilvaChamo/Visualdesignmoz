'use client';

import React, { useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Globe, X } from 'lucide-react';
import { panelBtnPrimary, panelBtnSecondary } from '@/lib/panel-ui';
import { Spinner } from '@/components/ui/spinner';

/**
 * Associa um domínio que o cliente já tem ao plano de email à espera de
 * domínio (/api/client/attach-email-domain — cria o email no servidor).
 */
export async function attachEmailDomain(rawDomain: string): Promise<{ ok: true; domain: string } | { ok: false; error: string }> {
  const domain = rawDomain.trim().toLowerCase();
  try {
    const res = await fetch('/api/client/attach-email-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { ok: false, error: data.error || 'Não foi possível associar o domínio.' };
    }
    return { ok: true, domain: data.domain || domain };
  } catch {
    return { ok: false, error: 'Erro de rede — tente novamente.' };
  }
}

type Props = {
  onClose: () => void;
  /** Há um plano de email comprado ainda sem domínio. */
  emailPlanWaitingDomain: boolean;
  onAttached: () => void;
  onNavigate: (section: string) => void;
};

/**
 * "Adicionar domínio" no painel Cliente. Quem não tem site não cria domínios
 * no servidor (isso é do Profissional/staff): ou liga um domínio seu ao plano
 * de email, ou regista/transfere um domínio connosco.
 */
export function ClientAddDomainModal({ onClose, emailPlanWaitingDomain, onAttached, onNavigate }: Props) {
  const [domain, setDomain] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attached, setAttached] = useState<string | null>(null);

  const handleAttach = async () => {
    if (!domain.trim()) return;
    setSaving(true);
    setError(null);
    const result = await attachEmailDomain(domain);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAttached(result.domain);
    onAttached();
  };

  const goTo = (section: string) => {
    onClose();
    onNavigate(section);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40">
              <Globe className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100">Adicionar domínio</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {emailPlanWaitingDomain ? 'Usar um domínio seu no plano de e-mail' : 'Registar ou transferir um domínio'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {attached ? (
          <>
            <div className="space-y-3 px-6 py-6">
              <div className="flex items-start gap-3 rounded border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/30">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-700 dark:text-green-400" />
                <p className="text-sm text-green-800 dark:text-green-300">
                  <strong>{attached}</strong> ficou associado ao seu plano de e-mail. Já pode criar as caixas de correio.
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Para o e-mail receber mensagens, os nameservers do domínio têm de apontar para os nossos (Domínios &amp; DNS → Nameservers).
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-zinc-800">
              <button type="button" onClick={onClose} className={panelBtnSecondary}>Fechar</button>
              <button type="button" onClick={() => goTo('emails-new')} className={panelBtnPrimary}>
                Criar caixas de e-mail <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : emailPlanWaitingDomain ? (
          <>
            <div className="space-y-4 px-6 py-6">
              <p className="text-sm text-gray-600 dark:text-zinc-300">
                Indique um domínio que já seja seu. Activamos o e-mail desse domínio no servidor e depois cria as caixas em
                {' '}<strong>E-mail → Contas de e-mail</strong>.
              </p>
              {error && (
                <div className="flex items-start gap-2 rounded border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-400">
                  Nome do domínio
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleAttach(); }}
                  placeholder="meusite.co.mz"
                  autoFocus
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Ainda não tem domínio?{' '}
                <a href="/servicos/dominios?origem=painel" className="font-bold text-red-600 hover:underline dark:text-red-400">Registe um connosco</a>
                {' '}— fica ligado ao plano automaticamente.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-zinc-800">
              <button type="button" onClick={onClose} className={panelBtnSecondary}>Cancelar</button>
              <button
                type="button"
                onClick={() => void handleAttach()}
                disabled={saving || !domain.trim()}
                className={`${panelBtnPrimary} disabled:opacity-50`}
              >
                {saving ? <Spinner className="h-4 w-4" /> : null}
                {saving ? 'A activar…' : 'Associar ao plano de e-mail'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3 px-6 py-6 text-sm text-gray-600 dark:text-zinc-300">
              <p>
                Os domínios do seu painel são registados connosco ou transferidos de outro registador.
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Para usar no e-mail um domínio que já tem noutro sítio, compre primeiro um plano de e-mail — depois associa-o aqui.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-zinc-800">
              <a href="/precos/email" className={panelBtnSecondary}>Planos de e-mail</a>
              <button type="button" onClick={() => goTo('transferir-dominio')} className={panelBtnSecondary}>Transferir domínio</button>
              <a href="/servicos/dominios?origem=painel" className={panelBtnPrimary}>Registar domínio</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
