'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Globe, ArrowRightLeft, ServerCog, Loader2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Spinner } from '@/components/ui/spinner';
import { hostingItemsNeedingDomain, HOSTING_DOMAIN_REGEX } from '@/lib/checkout-flow';
import { DOMAIN_TLD_PRICES, domainRegistrationPriceMt, domainRenewalPriceMt, domainTransferPriceMt } from '@/lib/domain-tld-prices';

type Mode = 'register' | 'transfer' | 'existing';

type Staged =
  | { mode: 'register'; domain: string; price: number; renewPrice?: number }
  | { mode: 'transfer'; domain: string; price: number; authCode: string }
  | { mode: 'existing'; domain: string };

const MODE_META: Record<Mode, { title: string; Icon: typeof Globe }> = {
  register: { title: 'Registar um novo domínio', Icon: Globe },
  transfer: { title: 'Transferir domínio para a MozServer', Icon: ArrowRightLeft },
  existing: { title: 'Vou usar o meu domínio já existente e atualizar os nameservers — DNS', Icon: ServerCog },
};

export default function EscolherDominioPage() {
  const router = useRouter();
  const { items, addItem, updateItemHostingDomain } = useCart();
  const { formatPrice } = useCurrency();

  const [mode, setMode] = useState<Mode>('register');
  const [staged, setStaged] = useState<Staged | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Registar
  const [regName, setRegName] = useState('');
  const [regTld, setRegTld] = useState(DOMAIN_TLD_PRICES[0].value);
  const [regChecking, setRegChecking] = useState(false);
  const [regResult, setRegResult] = useState<{ available: boolean; domain: string; error?: string; alreadyOurs?: boolean } | null>(null);

  // Transferir
  const [trDomain, setTrDomain] = useState('');
  const [trAuthCode, setTrAuthCode] = useState('');
  const [trChecking, setTrChecking] = useState(false);
  const [trMsg, setTrMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Usar existente
  const [exDomain, setExDomain] = useState('');
  const [exError, setExError] = useState('');

  const pending = hostingItemsNeedingDomain(items);
  const target = pending[0];

  useEffect(() => {
    if (items.length === 0) {
      router.replace('/precos/hospedagem');
      return;
    }
    if (pending.length === 0) {
      router.replace('/checkout');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, pending.length]);

  const resetStage = () => {
    setStaged(null);
    setRegResult(null);
    setTrMsg(null);
    setExError('');
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    resetStage();
  };

  const handleCheckRegister = async () => {
    if (!regName.trim()) return;
    setRegChecking(true);
    setRegResult(null);
    setStaged(null);
    try {
      const res = await fetch('/api/domain-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: regName.trim().toLowerCase(), tld: regTld }),
      });
      const data = await res.json();
      if (data.error) {
        setRegResult({ available: false, domain: '', error: data.error });
        return;
      }
      const domain = data.domain as string;
      setRegResult({ available: data.available, domain, alreadyOurs: Boolean(data.alreadyOurs) });
      if (data.available) {
        const tld = DOMAIN_TLD_PRICES.find((t) => domain.endsWith(t.value));
        if (tld) {
          setStaged({
            mode: 'register',
            domain,
            price: domainRegistrationPriceMt(tld, 1),
            renewPrice: domainRenewalPriceMt(tld, 1),
          });
        }
      }
    } catch {
      setRegResult({ available: false, domain: '', error: 'Erro ao verificar disponibilidade.' });
    } finally {
      setRegChecking(false);
    }
  };

  const handleValidateTransfer = async () => {
    if (!trDomain.trim() || !trAuthCode.trim()) return;
    setTrChecking(true);
    setTrMsg(null);
    setStaged(null);
    try {
      const clean = trDomain.trim().toLowerCase();
      const res = await fetch('/api/domain-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: clean, tld: '' }),
      });
      const data = await res.json();

      if (data.error) {
        setTrMsg({ ok: false, text: data.error });
        return;
      }
      if (data.available) {
        setTrMsg({ ok: false, text: 'Este domínio está livre — não há nada para transferir. Escolha "Registar um novo domínio" em vez disso.' });
        return;
      }
      if (data.alreadyOurs) {
        setTrMsg({ ok: false, text: 'Este domínio já está registado connosco — não é preciso transferir.' });
        return;
      }

      const tld = DOMAIN_TLD_PRICES.find((t) => clean.endsWith(t.value));
      if (!tld) {
        setTrMsg({ ok: false, text: 'Não reconhecemos esta extensão de domínio.' });
        return;
      }

      const price = domainTransferPriceMt(tld, 1);
      setStaged({ mode: 'transfer', domain: clean, price, authCode: trAuthCode.trim() });
      setTrMsg({ ok: true, text: `Domínio ${clean} confirmado — pronto para pedir a transferência (${formatPrice(price)}).` });
    } catch (e: unknown) {
      setTrMsg({ ok: false, text: e instanceof Error ? e.message : 'Erro ao validar domínio.' });
    } finally {
      setTrChecking(false);
    }
  };

  const handleUseExisting = () => {
    const clean = exDomain.trim().toLowerCase();
    if (!HOSTING_DOMAIN_REGEX.test(clean)) {
      setExError('Indique um domínio válido (ex: oseudominio.co.mz).');
      setStaged(null);
      return;
    }
    setExError('');
    setStaged({ mode: 'existing', domain: clean });
  };

  const handleContinue = () => {
    if (!staged || !target) return;
    setConfirming(true);

    if (staged.mode === 'register') {
      addItem({ id: staged.domain, type: 'domain', name: staged.domain, price: staged.price, period: 1, renewPrice: staged.renewPrice });
    } else if (staged.mode === 'transfer') {
      addItem({ id: staged.domain, type: 'domain', name: staged.domain, price: staged.price, period: 1, authCode: staged.authCode });
    }
    updateItemHostingDomain(target.id, staged.domain);

    const stillPending = pending.filter((i) => i.id !== target.id);
    if (stillPending.length > 0) {
      setMode('register');
      resetStage();
      setRegName('');
      setTrDomain('');
      setTrAuthCode('');
      setExDomain('');
      setConfirming(false);
    } else {
      router.push('/checkout');
    }
  };

  if (!target) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pt-32 pb-16 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pt-32 pb-24 transition-colors duration-200">
      <div className="max-w-3xl mx-auto px-5 sm:px-[40px] mt-4">
        <Link href="/precos/hospedagem" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar aos planos
        </Link>

        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">Passo 1 de 2 — Domínio</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">Escolha um domínio para "{target.name}"</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Escolha uma das opções abaixo para continuar para o checkout.</p>
        </div>

        <div className="space-y-3">
          {/* CARD: Registar novo domínio */}
          <div className={`bg-white dark:bg-zinc-900 border rounded-lg shadow-sm overflow-hidden transition-colors ${mode === 'register' ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-zinc-800'}`}>
            <button type="button" onClick={() => switchMode('register')} className="w-full flex items-center gap-3 px-5 py-4 text-left">
              <RadioDot active={mode === 'register'} />
              <Globe className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
              <span className="font-bold text-sm text-slate-800 dark:text-zinc-100">{MODE_META.register.title}</span>
            </button>
            {mode === 'register' && (
              <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-zinc-800">
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <div className="flex-1 flex items-center border border-slate-200 dark:border-zinc-800 rounded overflow-hidden bg-slate-50 dark:bg-zinc-950">
                    <span className="pl-3 pr-1 text-sm text-slate-400 dark:text-zinc-500 shrink-0">www.</span>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => { setRegName(e.target.value); setRegResult(null); setStaged(null); }}
                      placeholder="exemplo"
                      className="flex-1 min-w-0 py-2.5 pr-3 bg-transparent text-sm font-medium text-slate-800 dark:text-zinc-100 outline-none"
                    />
                  </div>
                  <select
                    value={regTld}
                    onChange={(e) => { setRegTld(e.target.value); setRegResult(null); setStaged(null); }}
                    className="rounded border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3 py-2.5 text-sm font-bold text-slate-600 dark:text-zinc-300"
                  >
                    {DOMAIN_TLD_PRICES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleCheckRegister()}
                    disabled={regChecking || !regName.trim()}
                    className="shrink-0 inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold px-6 py-2.5 rounded transition-colors"
                  >
                    {regChecking ? <Spinner className="w-4 h-4" /> : 'Verifica'}
                  </button>
                </div>

                {regResult && (
                  <div className={`mt-3 flex items-center justify-between gap-3 rounded border px-4 py-3 text-sm ${
                    regResult.available
                      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400'
                  }`}>
                    {regResult.error ? (
                      <span>{regResult.error}</span>
                    ) : regResult.available ? (
                      <>
                        <span className="font-bold">{regResult.domain} está disponível!</span>
                        {staged?.mode === 'register' && (
                          <span className="font-bold whitespace-nowrap">{formatPrice(staged.price)}/1º ano</span>
                        )}
                      </>
                    ) : regResult.alreadyOurs ? (
                      <span>{regResult.domain} já está registado connosco.</span>
                    ) : (
                      <span>{regResult.domain} já está registado — tente outro nome ou use "Transferir domínio".</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CARD: Transferir domínio */}
          <div className={`bg-white dark:bg-zinc-900 border rounded-lg shadow-sm overflow-hidden transition-colors ${mode === 'transfer' ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-zinc-800'}`}>
            <button type="button" onClick={() => switchMode('transfer')} className="w-full flex items-center gap-3 px-5 py-4 text-left">
              <RadioDot active={mode === 'transfer'} />
              <ArrowRightLeft className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
              <span className="font-bold text-sm text-slate-800 dark:text-zinc-100">{MODE_META.transfer.title}</span>
            </button>
            {mode === 'transfer' && (
              <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-3">
                  Introduza o domínio e o código de autorização (EPP) do registador actual. O domínio mantém-se activo durante a transferência.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={trDomain}
                    onChange={(e) => { setTrDomain(e.target.value); setTrMsg(null); setStaged(null); }}
                    placeholder="oseudominio.com"
                    className="rounded border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-zinc-100 outline-none"
                  />
                  <input
                    type="text"
                    value={trAuthCode}
                    onChange={(e) => { setTrAuthCode(e.target.value); setTrMsg(null); setStaged(null); }}
                    placeholder="Código de autorização (EPP)"
                    className="rounded border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-zinc-100 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleValidateTransfer()}
                  disabled={trChecking || !trDomain.trim() || !trAuthCode.trim()}
                  className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold px-6 py-2.5 rounded transition-colors"
                >
                  {trChecking ? <Spinner className="w-4 h-4" /> : 'Transferir'}
                </button>

                {trMsg && (
                  <div className={`rounded border px-4 py-3 text-sm ${
                    trMsg.ok
                      ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400'
                  }`}>
                    {trMsg.text}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CARD: Usar domínio existente */}
          <div className={`bg-white dark:bg-zinc-900 border rounded-lg shadow-sm overflow-hidden transition-colors ${mode === 'existing' ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-zinc-800'}`}>
            <button type="button" onClick={() => switchMode('existing')} className="w-full flex items-center gap-3 px-5 py-4 text-left">
              <RadioDot active={mode === 'existing'} />
              <ServerCog className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
              <span className="font-bold text-sm text-slate-800 dark:text-zinc-100">{MODE_META.existing.title}</span>
            </button>
            {mode === 'existing' && (
              <div className="px-5 pb-5 pt-1 border-t border-slate-100 dark:border-zinc-800 space-y-3">
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-3">
                  Vamos indicar os nameservers exactos a configurar no seu registador actual assim que a compra for confirmada — disponíveis na área de cliente.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={exDomain}
                    onChange={(e) => { setExDomain(e.target.value); setExError(''); setStaged(null); }}
                    placeholder="oseudominio.co.mz"
                    className="flex-1 min-w-0 rounded border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-zinc-100 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleUseExisting}
                    disabled={!exDomain.trim()}
                    className="shrink-0 inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold px-6 py-2.5 rounded transition-colors"
                  >
                    Usar
                  </button>
                </div>
                {exError && <p className="text-xs font-medium text-red-600 dark:text-red-400">{exError}</p>}
                {staged?.mode === 'existing' && (
                  <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400 px-4 py-3 text-sm font-bold">
                    <Check className="w-4 h-4 shrink-0" /> Vamos usar {staged.domain} para esta hospedagem.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!staged || confirming}
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-lg shadow-sm transition-colors"
          >
            {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Continuar <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function RadioDot({ active }: { active: boolean }) {
  return (
    <span className={`flex items-center justify-center w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${active ? 'border-red-600 bg-red-600' : 'border-slate-300 dark:border-zinc-700'}`}>
      {active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
    </span>
  );
}
