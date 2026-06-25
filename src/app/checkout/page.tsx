'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { 
  CreditCard, 
  Shield, 
  Lock, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ShoppingCart, 
  Globe, 
  Server, 
  Mail, 
  ArrowLeft 
} from 'lucide-react';

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Card Form State
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardType, setCardType] = useState<'visa' | 'mastercard' | 'generic'>('generic');

  // Flow State
  const [status, setStatus] = useState<'idle' | 'validating' | 'processing' | 'registering' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function checkSession() {
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      if (!sessionUser) {
        setIsAuthenticated(false);
        // Redireciona para o login preservando o target do checkout
        router.replace(`/auth/login?redirect=${encodeURIComponent('/checkout')}`);
      } else {
        setUser(sessionUser);
        setIsAuthenticated(true);
      }
    }
    checkSession();
  }, [router]);

  // Formatação do número do cartão
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 16);
    // Deteta bandeiras comuns
    if (value.startsWith('4')) {
      setCardType('visa');
    } else if (value.startsWith('5')) {
      setCardType('mastercard');
    } else {
      setCardType('generic');
    }
    // Formata em grupos de 4 dígitos
    const formatted = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (value.length >= 2) {
      value = `${value.substring(0, 2)}/${value.substring(2)}`;
    }
    setExpiryDate(value);
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 3);
    setCvv(value);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardholderName || cardNumber.replace(/\s/g, '').length < 16 || expiryDate.length < 5 || cvv.length < 3) {
      setErrorMessage('Por favor, preencha todos os campos do cartão de crédito corretamente.');
      setStatus('error');
      return;
    }

    setErrorMessage('');
    
    // Etapa 1: Validação do Cartão
    setStatus('validating');
    await new Promise(r => setTimeout(r, 1200));

    // Etapa 2: Processamento e Autorização
    setStatus('processing');
    await new Promise(r => setTimeout(r, 1500));

    // Etapa 3: Registo e Ativação dos Serviços na BD
    setStatus('registering');
    
    try {
      const res = await fetch('/api/checkout/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          paymentMethod: 'visa',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao processar registo de domínios ou saldo insuficiente.');
      }

      // Sucesso total
      setStatus('success');
      setTimeout(() => {
        clearCart();
        router.replace('/client');
      }, 2500);

    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao comunicar com o servidor de registo.');
      setStatus('error');
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-red-650 mx-auto" />
          <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">A validar sessão segura...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return null; // Redirecionando para login...
  }

  const typeLabel: Record<string, string> = { domain: 'Domínio', hosting: 'Alojamento', email: 'Email', ssl: 'SSL' };
  const typeIcon: Record<string, React.ReactNode> = {
    domain: <Globe className="w-4 h-4 text-teal-650 dark:text-teal-400" />,
    hosting: <Server className="w-4 h-4 text-red-650 dark:text-red-400" />,
    email: <Mail className="w-4 h-4 text-blue-650 dark:text-blue-400" />,
    ssl: <Shield className="w-4 h-4 text-green-650 dark:text-green-400" />,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pt-28 pb-16 transition-colors duration-200">
      <div className="max-w-5xl mx-auto px-4">
        
        {/* Top secure seal indicator */}
        <div className="mb-8 flex items-center justify-between">
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-450 transition-colors font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex items-center gap-2 text-xs font-bold text-green-700 dark:text-green-450 bg-green-50 dark:bg-green-950/20 px-3.5 py-1 rounded-full border border-green-200 dark:border-green-900/40">
            <Lock className="w-3.5 h-3.5" /> Ligação Segura SSL de 256 bits
          </div>
        </div>

        {items.length === 0 && status !== 'success' ? (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-6 shadow-sm">
            <ShoppingCart className="w-16 h-16 text-slate-300 dark:text-zinc-700 mx-auto" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100 font-panel">O seu carrinho está vazio</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Não existem produtos ou domínios prontos para finalização de compra.
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-red-650 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-red-600/20"
            >
              Pesquisar Domínio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Form and loading steps */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* SUCCESS STATE */}
              {status === 'success' && (
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 text-center space-y-4 shadow-sm">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto animate-bounce" />
                  <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-50 font-panel">Pagamento Concluído!</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                    A sua transação foi processada com sucesso. Os serviços e domínios foram ativados no registador.
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 font-semibold animate-pulse pt-2">
                    A redirecionar para a sua área de cliente...
                  </p>
                </div>
              )}

              {/* PROCESSING TRANSACTIONS STEPS */}
              {(status === 'validating' || status === 'processing' || status === 'registering') && (
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-10 text-center space-y-6 shadow-sm">
                  <Loader2 className="w-12 h-12 text-red-600 animate-spin mx-auto" />
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 font-panel">
                      A Processar Transação
                    </h3>
                    <div className="max-w-xs mx-auto space-y-3 pt-3 text-left">
                      <div className="flex items-center gap-3 text-sm">
                        <div className={`w-2.5 h-2.5 rounded-full ${status !== 'validating' ? 'bg-green-500' : 'bg-red-600 animate-ping'}`} />
                        <span className={status !== 'validating' ? 'text-slate-400 line-through dark:text-zinc-650' : 'text-slate-800 dark:text-zinc-200 font-semibold'}>
                          Verificação dos dados do cartão
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className={`w-2.5 h-2.5 rounded-full ${status === 'registering' ? 'bg-green-500' : status === 'processing' ? 'bg-red-600 animate-ping' : 'bg-slate-200 dark:bg-zinc-800'}`} />
                        <span className={status === 'registering' ? 'text-slate-400 line-through dark:text-zinc-650' : status === 'processing' ? 'text-slate-800 dark:text-zinc-200 font-semibold' : 'text-slate-400 dark:text-zinc-550'}>
                          Comunicação segura com a rede emissora
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className={`w-2.5 h-2.5 rounded-full ${status === 'registering' ? 'bg-red-600 animate-ping' : 'bg-slate-200 dark:bg-zinc-800'}`} />
                        <span className={status === 'registering' ? 'text-slate-800 dark:text-zinc-200 font-semibold' : 'text-slate-400 dark:text-zinc-550'}>
                          Reserva e ativação dos serviços
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ERROR STATE */}
              {status === 'error' && errorMessage && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-5 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-650 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-red-800 dark:text-red-300 text-sm font-panel">Falha na Transação</h4>
                    <p className="text-xs text-red-700 dark:text-red-450 mt-1 leading-normal">{errorMessage}</p>
                    <button 
                      onClick={() => setStatus('idle')}
                      className="mt-4 bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-red-700 transition-colors inline-block"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                </div>
              )}

              {/* PAY FORM */}
              {status === 'idle' && (
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6 shadow-sm">
                  
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-50 font-panel">Cartão de Crédito ou Débito</h2>
                    <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1">
                      Transação segura encriptada por SSL. Insira os dados do seu cartão.
                    </p>
                  </div>

                  {/* Visa/Mastercard live card visualization */}
                  <div className="w-full max-w-sm mx-auto h-48 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black rounded-2xl p-5 text-white flex flex-col justify-between shadow-xl relative overflow-hidden border border-zinc-700/40">
                    <div className="absolute top-0 right-0 w-36 h-36 bg-red-600/10 rounded-full blur-3xl -z-10" />
                    
                    <div className="flex justify-between items-start">
                      <div className="bg-gradient-to-br from-yellow-300 to-amber-500 w-11 h-8 rounded-md shadow-inner" /> {/* Chip */}
                      {cardType === 'visa' && <span className="text-2xl font-black italic text-blue-400">VISA</span>}
                      {cardType === 'mastercard' && <span className="text-2xl font-black italic text-orange-400">Mastercard</span>}
                      {cardType === 'generic' && <CreditCard className="w-8 h-8 text-zinc-500" />}
                    </div>

                    <div className="space-y-4">
                      {/* Card digits */}
                      <div className="text-xl sm:text-2xl font-mono tracking-widest text-center py-1">
                        {cardNumber || '•••• •••• •••• ••••'}
                      </div>

                      {/* Info layout */}
                      <div className="flex justify-between items-end text-[10px] font-mono uppercase">
                        <div className="max-w-[220px]">
                          <div className="text-[7px] text-zinc-500 tracking-wider">Titular do Cartão</div>
                          <div className="font-bold truncate text-xs mt-0.5">{cardholderName || 'NOME COMPLETO'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[7px] text-zinc-500 tracking-wider">Validade</div>
                          <div className="font-bold text-xs mt-0.5">{expiryDate || 'MM/YY'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handlePay} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-650 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                        Nome no Cartão
                      </label>
                      <input
                        type="text"
                        placeholder="NOME DO TITULAR"
                        value={cardholderName}
                        onChange={e => setCardholderName(e.target.value.toUpperCase())}
                        required
                        className="w-full bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-150 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-650 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                        Número do Cartão
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="0000 0000 0000 0000"
                          value={cardNumber}
                          onChange={handleCardNumberChange}
                          required
                          className="w-full bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-150 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all font-mono tracking-wider"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <Lock className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-650 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                          Data de Expiração
                        </label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          value={expiryDate}
                          onChange={handleExpiryChange}
                          required
                          className="w-full bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-150 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-650 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                          Código CVV / CVC
                        </label>
                        <input
                          type="password"
                          placeholder="•••"
                          value={cvv}
                          onChange={handleCvvChange}
                          required
                          maxLength={3}
                          className="w-full bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-150 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all font-mono"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full mt-2 bg-red-655 hover:bg-red-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/30 hover:shadow-red-600/50 cursor-pointer"
                    >
                      <Shield className="w-5 h-5 animate-pulse" /> Pagar {total} MT Agora
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Right Column: Cart summary */}
            <div className="lg:col-span-5">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-sm sticky top-28">
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

                <div className="pt-2 flex items-start gap-2 text-[10px] text-slate-400 leading-normal">
                  <Shield className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>
                    Ligação segura. Encriptação ponta-a-ponta SSL/AES-256.
                  </span>
                </div>
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
