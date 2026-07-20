'use client';

import React, { useState, Suspense } from 'react';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  Globe,
  Server,
  Mail,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';

function CheckoutContent() {
  const { items, total, clearCart } = useCart();
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const isAuthenticated = authLoading ? null : !!authUser;

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Account Form State (For unauthenticated users)
  const [accountForm, setAccountForm] = useState({
    name: '',
    sobrenome: '',
    email: '',
    telefone: '',
    password: '',
    empresa: '',
    endereco: '',
    endereco2: '',
    cidade: '',
    estado: '',
    codigoPostal: '',
    pais: 'Mozambique'
  });
  const [showPassword, setShowPassword] = useState(false);

  // Flow State
  const [status, setStatus] = useState<'idle' | 'registering' | 'redirecting' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Evita duplo-clique / duplo pagamento
    setIsSubmitting(true);
    setErrorMessage('');

    if (isAuthenticated === false) {
      if (!accountForm.name.trim()) {
        setErrorMessage('Por favor, preencha o seu Nome Completo para criar a conta.');
        setStatus('error');
        setIsSubmitting(false);
        return;
      }
      if (!accountForm.email.trim()) {
        setErrorMessage('Por favor, introduza o seu Email para criar a conta.');
        setStatus('error');
        setIsSubmitting(false);
        return;
      }
      if (accountForm.password.length < 6) {
        setErrorMessage('A Palavra-passe é demasiado curta. Deve ter no mínimo 6 caracteres.');
        setStatus('error');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      if (isAuthenticated === false) {
        setStatus('registering');
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: accountForm.email,
            password: accountForm.password,
            nome: accountForm.name
          })
        });
        const data = await res.json();

        if (!res.ok) {
          if (data.error?.includes('Já existe uma conta') || data.error?.includes('already')) {
             try {
               await supabase.auth.signInWithPassword({
                 email: accountForm.email,
                 password: accountForm.password,
               });
             } catch (loginErr) {
               throw new Error('Já existe uma conta com este email. Por favor, faça login para continuar.');
             }
          } else {
            throw new Error(data.error || 'Erro ao criar a sua conta.');
          }
        } else {
          try {
            await supabase.auth.signInWithPassword({
              email: accountForm.email,
              password: accountForm.password,
            });
          } catch (e) {}
        }
      }

      setStatus('redirecting');
      const res = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error || 'Não foi possível iniciar o pagamento com Stripe.');
      }
      // Redirecciona para o Stripe Checkout hospedado — o webhook confirma o pagamento
      // e activa os produtos; esta página não marca nada como "pago" directamente.
      window.location.href = data.url;
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao comunicar com o servidor de registo.');
      setStatus('error');
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-red-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">A validar sessão segura...</p>
        </div>
      </div>
    );
  }

  const typeLabel: Record<string, string> = { domain: 'Domínio', hosting: 'Alojamento', email: 'Email', ssl: 'SSL' };
  const typeIcon: Record<string, React.ReactNode> = {
    domain: <Globe className="w-4 h-4 text-teal-650 dark:text-teal-400" />,
    hosting: <Server className="w-4 h-4 text-red-600 dark:text-red-400" />,
    email: <Mail className="w-4 h-4 text-blue-650 dark:text-blue-400" />,
    ssl: <Shield className="w-4 h-4 text-green-650 dark:text-green-400" />,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pt-32 pb-16 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 mt-4">

        {items.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-12 text-center max-w-lg mx-auto space-y-6 shadow-sm">
            <ShoppingCart className="w-16 h-16 text-slate-300 dark:text-zinc-700 mx-auto" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100 font-panel">O seu carrinho está vazio</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Não existem produtos ou domínios prontos para finalização de compra.
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-md transition-colors"
            >
              Pesquisar Domínio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

            {/* Left Column: Form and loading steps */}
            <div className="lg:col-span-8 space-y-5">

              {/* PROCESSING STEPS */}
              {(status === 'registering' || status === 'redirecting') && (
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-10 text-center space-y-4 shadow-sm">
                  <Loader2 className="w-12 h-12 text-red-600 animate-spin mx-auto" />
                  <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 font-panel">
                    {status === 'registering' ? 'A criar a sua conta...' : 'A abrir o pagamento seguro da Stripe...'}
                  </h3>
                </div>
              )}

              {/* ERROR STATE */}
              {status === 'error' && errorMessage && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-5 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-red-800 dark:text-red-300 text-sm font-panel">Falha na Transação</h4>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1 leading-normal">{errorMessage}</p>
                    {errorMessage.toLowerCase().includes('login') || errorMessage.toLowerCase().includes('já existe') ? (
                      <Link href={`/auth/login?redirect=${encodeURIComponent('/checkout')}`} className="mt-4 bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-red-700 transition-colors inline-block">
                        Fazer Login
                      </Link>
                    ) : (
                      <button
                        onClick={() => setStatus('idle')}
                        className="mt-4 bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-red-700 transition-colors inline-block"
                      >
                        Voltar para corrigir
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* PAY FORM */}
              {(status === 'idle' || status === 'error') && (
                <div className="space-y-5">

                  {isAuthenticated === false && (
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                      <div className="mb-6 pb-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                        <p className="text-sm text-slate-600 dark:text-zinc-400">
                          Já tem uma conta? <Link href={`/auth/login?redirect=${encodeURIComponent('/checkout')}`} className="text-blue-600 font-bold hover:underline">Inicie sessão</Link> para concluir o processo de pagamento.
                        </p>
                      </div>

                      <div className="space-y-8">
                        {/* Informação pessoal */}
                        <div>
                          <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-50 mb-4">Informação pessoal</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Nome</label>
                              <input type="text" value={accountForm.name} onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Sobrenome</label>
                              <input type="text" value={accountForm.sobrenome} onChange={e => setAccountForm(p => ({ ...p, sobrenome: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">E-mail</label>
                              <input type="email" value={accountForm.email} onChange={e => setAccountForm(p => ({ ...p, email: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Telefone</label>
                              <div className="flex border border-slate-200 dark:border-zinc-800 rounded-md bg-slate-50 dark:bg-zinc-950 overflow-hidden focus-within:ring-1 focus-within:ring-blue-500">
                                <div className="relative flex items-center border-r border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900">
                                  <select className="pl-3 pr-8 py-3 bg-transparent text-sm text-slate-700 dark:text-zinc-300 outline-none cursor-pointer appearance-none w-full h-full">
                                    <option value="+258">🇲🇿 +258</option>
                                    <option value="+244">🇦🇴 +244</option>
                                    <option value="+351">🇵🇹 +351</option>
                                    <option value="+55">🇧🇷 +55</option>
                                  </select>
                                  <svg className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                                <input type="tel" value={accountForm.telefone} onChange={e => setAccountForm(p => ({ ...p, telefone: e.target.value }))} className="flex-1 min-w-0 px-3 py-3 bg-transparent text-slate-800 dark:text-zinc-100 text-sm outline-none" />
                              </div>
                            </div>
                            <div className="col-span-2">
                              <div className="flex justify-between items-end mb-1.5">
                                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block">Palavra-passe para a conta (mín. 6 caracteres)</label>
                                <button type="button" onClick={() => { setAccountForm(p => ({ ...p, password: Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-2).toUpperCase() + '@' })); setShowPassword(true); }} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Gerar senha segura</button>
                              </div>
                              <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} value={accountForm.password} onChange={e => setAccountForm(p => ({ ...p, password: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 pr-10" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300">
                                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Endereço de cobrança */}
                        <div className="pt-6 border-t border-dashed border-slate-200 dark:border-zinc-800">
                          <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-50 mb-4">Endereço de cobrança</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Empresa (opcional)</label>
                              <input type="text" value={accountForm.empresa} onChange={e => setAccountForm(p => ({ ...p, empresa: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Endereço</label>
                              <input type="text" value={accountForm.endereco} onChange={e => setAccountForm(p => ({ ...p, endereco: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Endereço 2</label>
                              <input type="text" value={accountForm.endereco2} onChange={e => setAccountForm(p => ({ ...p, endereco2: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Cidade</label>
                              <input type="text" value={accountForm.cidade} onChange={e => setAccountForm(p => ({ ...p, cidade: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Estado</label>
                              <input type="text" value={accountForm.estado} onChange={e => setAccountForm(p => ({ ...p, estado: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Código Postal</label>
                              <input type="text" value={accountForm.codigoPostal} onChange={e => setAccountForm(p => ({ ...p, codigoPostal: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div className="col-span-2">
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">País</label>
                              <select value={accountForm.pais} onChange={e => setAccountForm(p => ({ ...p, pais: e.target.value }))} className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="Mozambique">Mozambique</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 space-y-5 shadow-sm">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-50 font-panel">Finalizar Pagamento</h2>
                      <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1">
                        Pagamento seguro por cartão, através da Stripe.
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/60 flex items-start gap-3">
                      <div className="p-3 rounded-md bg-indigo-100 dark:bg-indigo-800/40 flex-shrink-0">
                        <CreditCard className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-indigo-800 dark:text-indigo-300">
                          Pagamento seguro por cartão (Stripe)
                        </h4>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 leading-relaxed">
                          Ao clicar em "Pagar", será encaminhado para a página segura da Stripe para introduzir os dados do cartão. Este site nunca vê nem guarda o número do seu cartão.
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex justify-start gap-3">
                      <button
                        type="button"
                        onClick={handlePay}
                        disabled={isSubmitting}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <Lock className="w-5 h-5 animate-pulse" /> {isSubmitting ? 'A abrir pagamento seguro...' : `Pagar ${total} MT`}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.history.back()}
                        disabled={isSubmitting}
                        className="bg-transparent border border-slate-200 hover:border-slate-300 dark:border-zinc-800 dark:hover:border-zinc-700 text-slate-600 dark:text-zinc-400 font-bold py-3 px-6 rounded-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Cart summary */}
            <div className="lg:col-span-4">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 space-y-4 shadow-sm sticky top-28">
                <h3 className="font-bold text-slate-800 dark:text-zinc-50 text-base flex items-center gap-2 border-b border-slate-100 dark:border-zinc-850 pb-3 font-panel">
                  <ShoppingCart className="w-5 h-5 text-red-600" />
                  Resumo da Compra
                </h3>

                <div className="divide-y divide-slate-100 dark:divide-zinc-800/40 max-h-80 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div key={item.id} className="py-3 flex justify-between items-start gap-4">
                      <div className="flex gap-2.5 items-start">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-850 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {typeIcon[item.type] || <Globe className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div>
                          <span className="inline-block px-1.5 py-0.2 bg-slate-100 dark:bg-zinc-800 text-[8px] font-bold text-slate-500 dark:text-zinc-400 rounded uppercase tracking-wider mb-0.5">
                            {typeLabel[item.type] || item.type}
                          </span>
                          <h4 className="font-bold text-slate-800 dark:text-zinc-100 text-xs break-all leading-tight">{item.name}</h4>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Período: {item.period} {item.period === 1 ? 'ano' : 'anos'}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-bold text-slate-800 dark:text-zinc-100 text-sm">{item.price} MT</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Subtotal</span>
                    <span>{total} MT</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Impostos e IVA</span>
                    <span className="text-green-600 dark:text-green-400 font-bold">0.00 MT (Grátis)</span>
                  </div>
                  <div className="pt-3 border-t border-dashed border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                    <span className="font-black text-slate-800 dark:text-zinc-200 text-sm font-panel">Total</span>
                    <span className="font-black text-xl text-red-600 dark:text-red-400">{total} MT</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Loader2 className="w-10 h-10 animate-spin text-red-600" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
