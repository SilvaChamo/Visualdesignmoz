'use client';

import React, { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/lib/supabase-client';
import { X, Trash2, ShoppingCart, CreditCard, ChevronRight, Loader2, CheckCircle2, Shield, Server, Trash, Mail, Globe, User, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

export function CartDrawer() {
  const { isCartOpen, setIsCartOpen, items, removeItem, total, clearCart, addItem } = useCart();
  const [step, setStep] = useState<'cart' | 'payment'>('cart');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'emola' | 'visa' | 'paypal' | 'stripe'>('mpesa');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWaitingPin, setIsWaitingPin] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/client');

  if (!isCartOpen) return null;

  const handleClose = () => {
    setIsCartOpen(false);
    setStep('cart');
  };



  const handleCheckout = async () => {
    if (paymentMethod === 'mpesa' || paymentMethod === 'emola') {
      setIsWaitingPin(true);
      // Simula o tempo que o utilizador demora a confirmar no telemóvel (4s)
      await new Promise(r => setTimeout(r, 4000));
      setIsWaitingPin(false);
      
      sessionStorage.setItem('tempPaymentData', JSON.stringify({
        method: paymentMethod,
        phoneNumber,
        isAuthorized: true
      }));
    } else if (paymentMethod === 'visa') {
      setIsProcessing(true);
      sessionStorage.setItem('tempPaymentData', JSON.stringify({
        method: paymentMethod,
        cardNumber,
        expiryDate,
        cvv,
        isAuthorized: true
      }));
    } else {
      setIsProcessing(true);
      sessionStorage.setItem('tempPaymentData', JSON.stringify({
        method: paymentMethod
      }));
    }

    setIsCartOpen(false);
    window.location.href = `/checkout?method=${paymentMethod}`;
  };

  const typeLabel: Record<string, string> = { domain: 'Domínio', hosting: 'Alojamento', email: 'Email', ssl: 'SSL' };
  const typeIcon: Record<string, React.ReactNode> = {
    domain: <Globe className="w-4 h-4 text-teal-600" />,
    hosting: <Server className="w-4 h-4 text-red-600" />,
    email: <Mail className="w-4 h-4 text-blue-600" />,
    ssl: <Shield className="w-4 h-4 text-green-600" />,
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[9998] transition-opacity" onClick={handleClose} />

      <div className="site-overlay-panel fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-zinc-950 dark:border-l dark:border-zinc-800 shadow-2xl z-[9999] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-red-600" />
            Carrinho de Compras
            {items.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-black bg-red-600 text-white rounded-full">{items.length}</span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
              >
                <Trash className="w-3.5 h-3.5" />
                Esvaziar
              </button>
            )}
            <button onClick={handleClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Steps indicator */}
        {items.length > 0 && !isSuccess && (
          <div className="flex items-center px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold gap-2">
            <span className={`flex items-center gap-1 ${step === 'cart' ? 'text-red-600' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${step === 'cart' ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</span>
              Carrinho
            </span>
            <div className="flex-1 h-px bg-slate-200" />
            <span className={`flex items-center gap-1 ${step === 'payment' ? 'text-red-600' : 'text-slate-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${step === 'payment' ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</span>
              Pagamento
            </span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 space-y-5">

          {/* SUCCESS */}
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
              <CheckCircle2 className="w-20 h-20 text-green-500" />
              <h3 className="text-2xl font-black text-slate-800">Pagamento Concluído!</h3>
              <p className="text-slate-500 text-sm max-w-xs">
                O seu serviço foi activado. A redireccionar para o painel…
              </p>
              <p className="text-xs text-slate-400">{redirectPath}</p>
            </div>

          /* EMPTY */
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 py-12">
              <ShoppingCart className="w-16 h-16 opacity-20" />
              <p className="font-medium">O seu carrinho está vazio</p>
              <p className="text-xs text-center">Pesquise um domínio ou escolha um plano para começar.</p>
            </div>

          /* CART ITEMS */
          ) : step === 'cart' ? (
            <>
              <div className="space-y-3">
                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">O seu pedido</h3>
                {items.map((item) => (
                  <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-start justify-between p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {typeIcon[item.type] ?? <Globe className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div>
                          <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-[9px] font-bold text-slate-500 rounded uppercase tracking-wider mb-1">{typeLabel[item.type] ?? item.type}</span>
                          <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                          {item.renewPrice && <p className="text-[10px] text-slate-400 mt-0.5">Renovação: {item.renewPrice} MT/ano</p>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-black text-slate-900 text-base">{item.price} MT</div>
                        {item.type === 'hosting' || item.type === 'email' ? (
                          <div className="text-[10px] text-slate-400">/mês</div>
                        ) : (
                          <div className="text-[10px] text-slate-400">/ano</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 pb-3 border-t border-slate-50 pt-3">
                      {item.type === 'domain' && (
                        <div className="flex items-center gap-1.5 text-green-700 text-[10px] font-medium">
                          <Shield className="w-3 h-3" />
                          Privacidade grátis incluída
                        </div>
                      )}
                      {(item.type === 'hosting' || item.type === 'email') && (
                        <span className="text-[10px] text-slate-400">Período: {item.period} {item.period === 1 ? 'mês' : 'meses'}</span>
                      )}
                      <button onClick={() => removeItem(item.id)} className="ml-auto flex items-center gap-1 text-slate-400 hover:text-red-500 transition-colors text-xs">
                        <Trash2 className="w-3.5 h-3.5" /> Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cross-sells */}
              <div className="space-y-2 pt-2">
                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wide">Frequentemente adicionados</h3>
                {!items.find(i => i.id === 'hosting-basico') && (
                  <div
                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 hover:border-red-300 hover:shadow-sm transition-all cursor-pointer group"
                    onClick={() => addItem({ id: 'hosting-basico', type: 'hosting', name: 'Alojamento Web Básico', price: 680, period: 1 })}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                        <Server className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-red-600 transition-colors">Alojamento Web Básico</h4>
                        <p className="text-[10px] text-slate-500">10GB SSD · DirectAdmin</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-slate-800 text-sm">680 MT<span className="text-[10px] text-slate-400 font-normal">/mês</span></div>
                      <span className="text-[10px] text-red-600 font-bold">+ Adicionar</span>
                    </div>
                  </div>
                )}
                {!items.find(i => i.id === 'email-pro') && (
                  <div
                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
                    onClick={() => addItem({ id: 'email-pro', type: 'email', name: 'Email Profissional', price: 250, period: 1 })}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">Email Profissional</h4>
                        <p className="text-[10px] text-slate-500">10 contas · Mail Marketing</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-slate-800 text-sm">250 MT<span className="text-[10px] text-slate-400 font-normal">/mês</span></div>
                      <span className="text-[10px] text-blue-600 font-bold">+ Adicionar</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          /* STEP 2 — PAYMENT */
          ) : (
            <div className="space-y-4">
              {/* Order summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
                <h3 className="font-bold text-slate-700 text-sm mb-3">Resumo do pedido</h3>
                {items.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      {typeIcon[item.type]}
                      {item.name}
                    </span>
                    <span className="font-bold text-slate-800">{item.price} MT</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="font-black text-slate-800">Total</span>
                  <span className="font-black text-2xl text-red-600">{total} MT</span>
                </div>
              </div>

              {/* Payment methods */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-green-600" />
                  Pagamento seguro
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {(['mpesa', 'emola', 'visa', 'paypal', 'stripe'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`p-3 border-2 rounded-lg flex flex-col items-center gap-1 transition-all text-xs font-black ${paymentMethod === m ? 'border-red-600 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                      {m === 'mpesa' && <img src="/assets/m-pesas.png" alt="M-Pesa" className="h-7 w-auto object-contain" />}
                      {m === 'emola' && <img src="/assets/E-MOLA.png" alt="e-Mola" className="h-7 w-auto object-contain rounded-sm" />}
                      {m === 'visa' && <img src="/assets/visa-classic.jpg" alt="Visa" className="h-7 w-auto object-contain" />}
                      {m === 'paypal' && <img src="/assets/paypal.svg" alt="PayPal" className="h-7 w-auto object-contain" />}
                      {m === 'stripe' && <img src="/assets/stripe.svg" alt="Stripe" className="h-7 w-auto object-contain" />}
                    </button>
                  ))}
                </div>

                {(paymentMethod === 'mpesa' || paymentMethod === 'emola') && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">
                      Número {paymentMethod === 'mpesa' ? 'Vodacom (84/85)' : 'Movitel (86/87)'}
                    </label>
                    <input
                      type="tel" placeholder="8X 123 4567"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      autoComplete="tel"
                      className="w-full px-3 py-3 border border-slate-200 rounded-lg text-base font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none tracking-widest"
                    />
                    <p className="text-[10px] text-slate-400">Receberá uma notificação para confirmar o pagamento.</p>
                  </div>
                )}

                {paymentMethod === 'visa' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">
                        Número do Cartão
                      </label>
                      <input
                        type="text" placeholder="0000 0000 0000 0000"
                        value={cardNumber}
                        onChange={e => setCardNumber(e.target.value)}
                        maxLength={19}
                        autoComplete="cc-number"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none tracking-widest font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">
                          Validade
                        </label>
                        <input
                          type="text" placeholder="MM/AA"
                          value={expiryDate}
                          onChange={e => setExpiryDate(e.target.value)}
                          maxLength={5}
                          autoComplete="cc-exp"
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none tracking-widest font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">
                          CVV
                        </label>
                        <input
                          type="password" placeholder="***"
                          value={cvv}
                          onChange={e => setCvv(e.target.value)}
                          maxLength={3}
                          autoComplete="cc-csc"
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none tracking-widest font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        {items.length > 0 && !isSuccess && (
          <div className="p-5 bg-white border-t border-slate-200 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] space-y-3">

            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-sm">Total a pagar</span>
              <span className="text-2xl font-black text-slate-900">{total} MT</span>
            </div>

            {step === 'cart' && (
              <button
                onClick={() => setStep('payment')}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-md flex items-center justify-center gap-2 transition-all"
              >
                Finalizar compra <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {step === 'payment' && (
              <div className="flex gap-3">
                <button onClick={() => setStep('cart')} className="px-4 py-2.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition-colors text-sm">
                  Voltar
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={isProcessing || isWaitingPin || ((paymentMethod === 'mpesa' || paymentMethod === 'emola') && phoneNumber.length < 9) || (paymentMethod === 'visa' && (!cardNumber || !expiryDate || !cvv))}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-md flex items-center justify-center gap-2 transition-all"
                >
                  {isWaitingPin ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Verifique o seu telemóvel...</>
                  ) : isProcessing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> A Processar...</>
                  ) : (
                    <>Confirmar Pagamento</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
