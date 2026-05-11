'use client';

import React, { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { X, Trash2, ShoppingCart, CreditCard, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';

export function CartDrawer() {
  const { isCartOpen, setIsCartOpen, items, removeItem, total, clearCart } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'emola' | 'visa'>('mpesa');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    setIsProcessing(true);
    // Simular comunicação com Gateway de Pagamento
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    setIsSuccess(true);
    
    // Simular limpeza após sucesso
    setTimeout(() => {
      clearCart();
      setIsSuccess(false);
      setIsCheckingOut(false);
      setIsCartOpen(false);
    }, 3000);
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-[9998] transition-opacity" 
        onClick={() => setIsCartOpen(false)}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-[9999] flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-red-600" />
            Carrinho de Compras
          </h2>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <h3 className="text-xl font-bold text-slate-800">Pagamento Concluído!</h3>
              <p className="text-slate-500">O seu serviço foi ativado com sucesso. Verifique o seu email para mais detalhes.</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
              <ShoppingCart className="w-16 h-16 opacity-20" />
              <p>O seu carrinho está vazio</p>
            </div>
          ) : (
            <div className="space-y-6">
              {!isCheckingOut ? (
                <>
                  {/* Lista de Itens */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-slate-800 mb-2">O seu pedido</h3>
                    {items.map((item) => (
                      <div key={item.id} className="flex flex-col p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="inline-block px-2 py-1 bg-slate-100 text-[10px] font-bold text-slate-600 rounded-md uppercase tracking-wider mb-2">{item.type}</span>
                            <h4 className="font-bold text-slate-800 text-lg">{item.name}</h4>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="font-black text-slate-800 text-lg">{item.price} MT</span>
                            {item.renewPrice && <span className="text-[10px] text-slate-500">Renovação: {item.renewPrice} MT/ano</span>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <select className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 outline-none">
                            <option>{item.period} ano</option>
                            <option>2 anos</option>
                            <option>3 anos</option>
                          </select>
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 text-sm"
                          >
                            <Trash2 className="w-4 h-4" /> Remover
                          </button>
                        </div>
                        {item.type === 'domain' && (
                          <div className="mt-3 p-2 bg-green-50 rounded-lg flex items-center gap-2 border border-green-100">
                            <Shield className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-green-700 font-medium">Privacidade de Domínio Grátis incluída</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Cross-sells (Frequentes) */}
                  <div className="space-y-3 pt-4 border-t border-slate-200">
                    <h3 className="font-bold text-slate-800 text-sm">Frequentemente adicionados</h3>
                    
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-red-300 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-red-50 flex items-center justify-center">
                          <Server className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm group-hover:text-red-600 transition-colors">Alojamento Web Padrão</h4>
                          <p className="text-xs text-slate-500">Perfeito para começar</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-800 text-sm">1.500 MT</div>
                        <button className="text-[10px] text-red-600 font-bold uppercase hover:underline mt-1">+ Adicionar</button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-red-300 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-blue-50 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">Email Profissional</h4>
                          <p className="text-xs text-slate-500">Credibilidade para o negócio</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-800 text-sm">950 MT</div>
                        <button className="text-[10px] text-blue-600 font-bold uppercase hover:underline mt-1">+ Adicionar</button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                // Formulário de Checkout
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 bg-white p-4 rounded-xl border border-slate-200">
                  <div>
                    <h3 className="font-bold text-slate-800 mb-4">Escolha como pagar</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button 
                        onClick={() => setPaymentMethod('mpesa')}
                        className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition-all ${paymentMethod === 'mpesa' ? 'border-red-600 bg-red-50 text-red-700 ring-1 ring-red-600' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <span className="font-black text-lg tracking-tighter">M-Pesa</span>
                      </button>
                      <button 
                        onClick={() => setPaymentMethod('emola')}
                        className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition-all ${paymentMethod === 'emola' ? 'border-red-600 bg-red-50 text-red-700 ring-1 ring-red-600' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <span className="font-black text-lg tracking-tighter">e-Mola</span>
                      </button>
                      <button 
                        onClick={() => setPaymentMethod('visa')}
                        className={`p-3 border rounded-xl flex flex-col items-center gap-2 transition-all ${paymentMethod === 'visa' ? 'border-slate-800 bg-slate-50 text-slate-900 ring-1 ring-slate-800' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <CreditCard className="w-6 h-6" />
                        <span className="font-bold text-sm">Cartão</span>
                      </button>
                    </div>
                  </div>

                  {(paymentMethod === 'mpesa' || paymentMethod === 'emola') && (
                    <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                      <label className="text-sm font-bold text-slate-700">Número de Telemóvel ({paymentMethod === 'mpesa' ? 'Vodacom' : 'Movitel'})</label>
                      <input 
                        type="tel"
                        placeholder="Ex: 841234567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none font-medium text-lg"
                      />
                      <p className="text-xs text-slate-500">Irá receber um PIN de confirmação no seu ecrã para autorizar a compra.</p>
                    </div>
                  )}

                  {paymentMethod === 'visa' && (
                    <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-100 flex items-start gap-3">
                      <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Pagamento Seguro</strong><br/>
                        Será redirecionado para a página encriptada do seu banco no passo seguinte para introduzir os dados do cartão.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && !isSuccess && (
          <div className="p-6 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center text-slate-500 text-sm">
                <span>Subtotal</span>
                <span>{total} MT</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-sm">
                <span>Taxa ICANN (Domínios)</span>
                <span>{(items.filter(i => i.type === 'domain').length * 13).toFixed(2)} MT</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-slate-800 font-bold">Total a pagar</span>
                <span className="text-3xl font-black text-slate-900">{total + (items.filter(i => i.type === 'domain').length * 13)} MT</span>
              </div>
            </div>
            
            {!isCheckingOut ? (
              <button 
                onClick={() => setIsCheckingOut(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/30 hover:shadow-red-600/50"
              >
                Avançar para Pagamento
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsCheckingOut(false)}
                  className="px-4 py-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition-colors"
                >
                  Voltar
                </button>
                <button 
                  onClick={handleCheckout}
                  disabled={isProcessing || ((paymentMethod === 'mpesa' || paymentMethod === 'emola') && phoneNumber.length < 9)}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/30 hover:shadow-none"
                >
                  {isProcessing ? (
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
