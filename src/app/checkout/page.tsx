'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/lib/supabase-client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
  ArrowLeft,
  Smartphone,
  User,
  Eye,
  EyeOff
} from 'lucide-react';

function CheckoutContent() {
  const { items, total, clearCart } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Payment Method
  const [paymentMethod, setPaymentMethod] = useState<'visa' | 'mpesa' | 'emola'>('visa');

  // Card Form State
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardType, setCardType] = useState<'visa' | 'mastercard' | 'generic'>('generic');

  // Phone Number State (M-Pesa / e-Mola)
  const [phoneNumber, setPhoneNumber] = useState('');

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
  const [status, setStatus] = useState<'idle' | 'validating' | 'processing' | 'registering' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function checkSession() {
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      if (!sessionUser) {
        setIsAuthenticated(false);
      } else {
        setUser(sessionUser);
        setIsAuthenticated(true);
      }
    }
    checkSession();
  }, [router]);

  // Set initial payment method from URL
  useEffect(() => {
    const methodParam = searchParams.get('method');
    if (methodParam === 'mpesa' || methodParam === 'emola' || methodParam === 'visa') {
      setPaymentMethod(methodParam);
    }
  }, [searchParams]);

  // Formatação do número do cartão
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 16);
    if (value.startsWith('4')) {
      setCardType('visa');
    } else if (value.startsWith('5')) {
      setCardType('mastercard');
    } else {
      setCardType('generic');
    }
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

  // Formatação do número de telefone (M-Pesa / e-Mola)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 9);
    // Formata com espaço opcional: "84 123 4567"
    let formatted = value;
    if (value.length > 2) {
      formatted = `${value.substring(0, 2)} ${value.substring(2, 5)} ${value.substring(5)}`;
    }
    setPhoneNumber(formatted);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Validações locais conforme o método de pagamento
    if (paymentMethod === 'visa') {
      if (!cardholderName || cardNumber.replace(/\s/g, '').length < 16 || expiryDate.length < 5 || cvv.length < 3) {
        setErrorMessage('Por favor, preencha todos os campos do cartão de crédito corretamente.');
        setStatus('error');
        return;
      }
    } else {
      const cleanPhone = phoneNumber.replace(/\s/g, '');
      if (cleanPhone.length !== 9) {
        setErrorMessage('O número de telefone deve conter exatamente 9 dígitos.');
        setStatus('error');
        return;
      }
      if (paymentMethod === 'mpesa') {
        if (!cleanPhone.startsWith('84') && !cleanPhone.startsWith('85')) {
          setErrorMessage('Número M-Pesa inválido. Deve começar com 84 ou 85 (Vodacom).');
          setStatus('error');
          return;
        }
      }
      if (paymentMethod === 'emola') {
        if (!cleanPhone.startsWith('86') && !cleanPhone.startsWith('87')) {
          setErrorMessage('Número e-Mola inválido. Deve começar com 86 ou 87 (Movitel).');
          setStatus('error');
          return;
        }
      }
    }

    // Auth Validation for Guests
    if (isAuthenticated === false) {
      if (!accountForm.name || !accountForm.email || accountForm.password.length < 6) {
        setErrorMessage('Por favor, preencha todos os dados da conta corretamente. A palavra-passe deve ter no mínimo 6 caracteres.');
        setStatus('error');
        return;
      }
    }

    // Fluxo de Simulação de Processamento
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
               throw new Error('Esta conta já existe. A palavra-passe está incorreta.');
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

      if (paymentMethod === 'visa') {
        setStatus('validating');
        await new Promise(r => setTimeout(r, 1200));

        setStatus('processing');
        await new Promise(r => setTimeout(r, 1500));
      } else {
        // M-Pesa / e-Mola Simulation
        setStatus('validating'); // Enviando pedido USSD
        await new Promise(r => setTimeout(r, 1600));

        setStatus('processing'); // Aguardando confirmação do PIN no telemóvel
        await new Promise(r => setTimeout(r, 2800));
      }

      setStatus('registering'); // Registando e ativando serviços no banco

      const res = await fetch('/api/checkout/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          paymentMethod,
          phoneNumber: paymentMethod !== 'visa' ? phoneNumber.replace(/\s/g, '') : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao processar registo de domínios ou saldo insuficiente.');
      }

      const hasDomain = items.some(item => item.type === 'domain');
      setStatus('success');
      setTimeout(async () => {
        await supabase.auth.refreshSession();
        clearCart();
        router.refresh(); // Clears Next.js router cache to ensure layout re-evaluates the fresh user role
        if (hasDomain) {
          router.replace('/client?section=domain-manager');
        } else {
          router.replace('/client');
        }
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

  const typeLabel: Record<string, string> = { domain: 'Domínio', hosting: 'Alojamento', email: 'Email', ssl: 'SSL' };
  const typeIcon: Record<string, React.ReactNode> = {
    domain: <Globe className="w-4 h-4 text-teal-650 dark:text-teal-400" />,
    hosting: <Server className="w-4 h-4 text-red-650 dark:text-red-400" />,
    email: <Mail className="w-4 h-4 text-blue-650 dark:text-blue-400" />,
    ssl: <Shield className="w-4 h-4 text-green-650 dark:text-green-400" />,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pt-32 pb-16 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 mt-4">
        
        {/* Header removed */}

        {items.length === 0 && status !== 'success' ? (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-12 text-center max-w-lg mx-auto space-y-6 shadow-sm">
            <ShoppingCart className="w-16 h-16 text-slate-300 dark:text-zinc-700 mx-auto" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100 font-panel">O seu carrinho está vazio</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Não existem produtos ou domínios prontos para finalização de compra.
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-red-650 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-md transition-colors"
            >
              Pesquisar Domínio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Form and loading steps */}
            <div className="lg:col-span-8 space-y-5">
              
              {/* SUCCESS STATE */}
              {status === 'success' && (
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-8 text-center space-y-4 shadow-sm">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto animate-bounce" />
                  <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-50 font-panel">Pagamento Concluído!</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                    A sua transação foi processada com sucesso. Os serviços e domínios foram ativados no registador.
                  </p>
                  <p className="text-xs text-red-650 dark:text-red-400 font-semibold animate-pulse pt-2">
                    A redirecionar para a sua área de cliente...
                  </p>
                </div>
              )}

              {/* PROCESSING TRANSACTIONS STEPS */}
              {(status === 'validating' || status === 'processing' || status === 'registering') && (
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-10 text-center space-y-6 shadow-sm">
                  <Loader2 className="w-12 h-12 text-red-650 animate-spin mx-auto" />
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 font-panel">
                      A Processar Transação
                    </h3>
                    <div className="max-w-md mx-auto space-y-3 pt-3 text-left">
                      {paymentMethod === 'visa' ? (
                        <>
                          <div className="flex items-center gap-3 text-sm">
                            <div className={`w-2.5 h-2.5 rounded-full ${status !== 'validating' ? 'bg-green-500' : 'bg-red-650 animate-ping'}`} />
                            <span className={status !== 'validating' ? 'text-slate-400 line-through dark:text-zinc-650' : 'text-slate-800 dark:text-zinc-200 font-semibold'}>
                              Verificação dos dados do cartão
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <div className={`w-2.5 h-2.5 rounded-full ${status === 'registering' ? 'bg-green-500' : status === 'processing' ? 'bg-red-650 animate-ping' : 'bg-slate-200 dark:bg-zinc-800'}`} />
                            <span className={status === 'registering' ? 'text-slate-400 line-through dark:text-zinc-650' : status === 'processing' ? 'text-slate-800 dark:text-zinc-200 font-semibold' : 'text-slate-400 dark:text-zinc-550'}>
                              Comunicação segura com a rede emissora
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 text-sm">
                            <div className={`w-2.5 h-2.5 rounded-full ${status !== 'validating' ? 'bg-green-500' : 'bg-red-650 animate-ping'}`} />
                            <span className={status !== 'validating' ? 'text-slate-400 line-through dark:text-zinc-650' : 'text-slate-800 dark:text-zinc-200 font-semibold'}>
                              A enviar solicitação de pagamento ao telemóvel ({paymentMethod === 'mpesa' ? 'M-Pesa' : 'e-Mola'})
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <div className={`w-2.5 h-2.5 rounded-full ${status === 'registering' ? 'bg-green-500' : status === 'processing' ? 'bg-red-650 animate-ping' : 'bg-slate-200 dark:bg-zinc-800'}`} />
                            <span className={status === 'registering' ? 'text-slate-400 line-through dark:text-zinc-650' : status === 'processing' ? 'text-slate-800 dark:text-zinc-200 font-semibold' : 'text-slate-400 dark:text-zinc-550'}>
                              A aguardar confirmação de PIN no telemóvel...
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex items-center gap-3 text-sm">
                        <div className={`w-2.5 h-2.5 rounded-full ${status === 'registering' ? 'bg-red-650 animate-ping' : 'bg-slate-200 dark:bg-zinc-800'}`} />
                        <span className={status === 'registering' ? 'text-slate-800 dark:text-zinc-200 font-semibold' : 'text-slate-400 dark:text-zinc-550'}>
                          Reserva e ativação dos serviços no registador
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ERROR STATE */}
              {status === 'error' && errorMessage && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-5 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-650 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-red-800 dark:text-red-300 text-sm font-panel">Falha na Transação</h4>
                    <p className="text-xs text-red-700 dark:text-red-450 mt-1 leading-normal">{errorMessage}</p>
                    <button 
                      onClick={() => setStatus('idle')}
                      className="mt-4 bg-red-650 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-red-700 transition-colors inline-block"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                </div>
              )}

              {/* PAY FORM */}
              {status === 'idle' && (
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
                                <select className="pl-3 pr-8 py-3 bg-slate-100 dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 text-sm text-slate-700 dark:text-zinc-300 outline-none cursor-pointer appearance-none">
                                  <option value="+258">🇲🇿 +258</option>
                                  <option value="+244">🇦🇴 +244</option>
                                  <option value="+351">🇵🇹 +351</option>
                                  <option value="+55">🇧🇷 +55</option>
                                </select>
                                <input type="tel" value={accountForm.telefone} onChange={e => setAccountForm(p => ({ ...p, telefone: e.target.value }))} className="flex-1 min-w-0 px-3 py-3 bg-transparent text-slate-800 dark:text-zinc-100 text-sm outline-none" />
                              </div>
                            </div>
                            <div className="col-span-2">
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Palavra-passe para a conta (mín. 6 caracteres)</label>
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
                      Escolha o método de pagamento preferencial e insira os dados necessários.
                    </p>
                  </div>

                  {/* Payment Method Selector Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {(['visa', 'mpesa', 'emola'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m);
                          setErrorMessage('');
                        }}
                        className={`p-3 border rounded-md flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-black cursor-pointer ${
                          paymentMethod === m 
                            ? 'border-red-655 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400' 
                            : 'border-slate-200 dark:border-zinc-800 text-slate-650 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50 dark:bg-zinc-900'
                        }`}
                      >
                        {m === 'visa' && (
                          <>
                            <CreditCard className="w-5 h-5" />
                            <span>Cartão</span>
                          </>
                        )}
                        {m === 'mpesa' && (
                          <>
                            <Smartphone className="w-5 h-5 text-red-650 dark:text-red-400" />
                            <span>M-Pesa</span>
                          </>
                        )}
                        {m === 'emola' && (
                          <>
                            <Smartphone className="w-5 h-5 text-orange-550 dark:text-orange-400" />
                            <span>e-Mola</span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* VISA/MASTERCARD SECTION */}
                  {paymentMethod === 'visa' && (
                    <div className="space-y-6 animate-fadeIn">
                      {/* Visa/Mastercard live card visualization */}
                      <div className="w-full max-w-sm mx-auto h-48 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black rounded-2xl p-5 text-white flex flex-col justify-between shadow-xl relative overflow-hidden border border-zinc-700/40">
                        <div className="absolute top-0 right-0 w-36 h-36 bg-red-650/10 rounded-full blur-3xl -z-10" />
                        
                        <div className="flex justify-between items-start">
                          <div className="bg-gradient-to-br from-yellow-300 to-amber-500 w-11 h-8 rounded-md shadow-inner" />
                          {cardType === 'visa' && <span className="text-2xl font-black italic text-blue-450">VISA</span>}
                          {cardType === 'mastercard' && <span className="text-2xl font-black italic text-orange-450">Mastercard</span>}
                          {cardType === 'generic' && <CreditCard className="w-8 h-8 text-zinc-550" />}
                        </div>

                        <div className="space-y-4">
                          <div className="text-xl sm:text-2xl font-mono tracking-widest text-center py-1">
                            {cardNumber || '•••• •••• •••• ••••'}
                          </div>

                          <div className="flex justify-between items-end text-[10px] font-mono uppercase">
                            <div className="max-w-[220px]">
                              <div className="text-[7px] text-zinc-500 tracking-wider">Titular do Cartão</div>
                              <div className="font-bold truncate text-xs mt-0.5">{cardholderName || 'NOME COMPLETO'}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[7px] text-zinc-550 tracking-wider">Validade</div>
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
                            className="w-full bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-150 border border-slate-200 dark:border-zinc-800 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-650 focus:border-transparent transition-all uppercase"
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
                              className="w-full bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-150 border border-slate-200 dark:border-zinc-800 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-655 focus:border-transparent transition-all font-mono tracking-wider"
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
                              className="w-full bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-150 border border-slate-200 dark:border-zinc-800 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-655 focus:border-transparent transition-all font-mono"
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
                              className="w-full bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-150 border border-slate-200 dark:border-zinc-800 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-655 focus:border-transparent transition-all font-mono"
                            />
                          </div>
                        </div>

                        <div className="mt-2 flex justify-start gap-3">
                          <button
                            type="submit"
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                          >
                            <Shield className="w-5 h-5 animate-pulse" /> Confirmar e Pagar {total} MT
                          </button>
                          <button
                            type="button"
                            onClick={() => window.history.back()}
                            className="bg-transparent border border-slate-200 hover:border-slate-300 dark:border-zinc-800 dark:hover:border-zinc-700 text-slate-600 dark:text-zinc-400 font-bold py-3 px-6 rounded-md transition-all cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* MPESA / EMOLA SECTION */}
                  {(paymentMethod === 'mpesa' || paymentMethod === 'emola') && (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/60 flex items-start gap-3">
                        <div className={`p-3 rounded-md ${paymentMethod === 'mpesa' ? 'bg-red-50 dark:bg-red-950/20' : 'bg-orange-50 dark:bg-orange-950/20'} flex-shrink-0`}>
                          <Smartphone className={`w-6 h-6 ${paymentMethod === 'mpesa' ? 'text-red-650 dark:text-red-400' : 'text-orange-550 dark:text-orange-400'}`} />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-800 dark:text-zinc-100">
                            Pagamento por Celular ({paymentMethod === 'mpesa' ? 'M-Pesa' : 'e-Mola'})
                          </h4>
                          <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1 leading-relaxed">
                            Insira o seu número de telemóvel associado à conta {paymentMethod === 'mpesa' ? 'M-Pesa (Vodacom)' : 'e-Mola (Movitel)'}. Irá receber uma mensagem pop-up no ecrã do seu telemóvel para introduzir o seu PIN e validar o pagamento.
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handlePay} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-655 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                            Número de Telemóvel {paymentMethod === 'mpesa' ? 'Vodacom (84/85)' : 'Movitel (86/87)'}
                          </label>
                          <input
                            type="tel"
                            placeholder={paymentMethod === 'mpesa' ? '84 123 4567' : '86 123 4567'}
                            value={phoneNumber}
                            onChange={handlePhoneChange}
                            required
                            className="w-full bg-white dark:bg-zinc-950 text-slate-850 dark:text-zinc-100 border border-slate-200 dark:border-zinc-800 rounded-md px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-red-650 focus:border-transparent transition-all font-mono tracking-widest text-center"
                          />
                        </div>

                        <div className="mt-2 flex justify-start gap-3">
                          <button
                            type="submit"
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                          >
                            <Lock className="w-5 h-5 animate-pulse" /> Confirmar e Pagar {total} MT
                          </button>
                          <button
                            type="button"
                            onClick={() => window.history.back()}
                            className="bg-transparent border border-slate-200 hover:border-slate-300 dark:border-zinc-800 dark:hover:border-zinc-700 text-slate-600 dark:text-zinc-400 font-bold py-3 px-6 rounded-md transition-all cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Cart summary */}
            <div className="lg:col-span-4">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 space-y-4 shadow-sm sticky top-28">
                <h3 className="font-bold text-slate-800 dark:text-zinc-50 text-base flex items-center gap-2 border-b border-slate-100 dark:border-zinc-850 pb-3 font-panel">
                  <ShoppingCart className="w-5 h-5 text-red-650" />
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
                    <span className="font-black text-xl text-red-650 dark:text-red-400">{total} MT</span>
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
        <Loader2 className="w-10 h-10 animate-spin text-red-650" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
