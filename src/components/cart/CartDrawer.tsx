'use client';

import React from 'react';
import { useCart } from '@/contexts/CartContext';
import { X, Trash2, ShoppingCart, ChevronRight, Shield, Server, Trash, Mail, Globe } from 'lucide-react';

export function CartDrawer() {
  const { isCartOpen, setIsCartOpen, items, removeItem, total, clearCart, addItem } = useCart();

  if (!isCartOpen) return null;

  const handleClose = () => {
    setIsCartOpen(false);
  };

  const goToCheckout = () => {
    setIsCartOpen(false);
    window.location.href = '/checkout';
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 space-y-5">

          {/* EMPTY */}
          {items.length === 0 ? (
            <div className="flex flex-col justify-between min-h-[400px]">
              <div className="flex flex-col items-center justify-center text-slate-400 space-y-4 py-8">
                <ShoppingCart className="w-16 h-16 opacity-20" />
                <p className="font-medium text-slate-800 dark:text-zinc-200">O seu carrinho está vazio</p>
                <p className="text-xs text-center text-slate-500 max-w-[250px]">Adicione um dos serviços recomendados abaixo ao seu carrinho:</p>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-zinc-800 mt-auto">
                <h3 className="font-bold text-slate-700 dark:text-zinc-400 text-xs uppercase tracking-wide">Frequentemente adicionados</h3>
                <div
                  className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer group"
                  onClick={() => addItem({ id: 'domain-com', type: 'domain', name: 'Registo de Domínio .com', price: 800, period: 1 })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/20 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-4 h-4 text-teal-600 dark:text-teal-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm group-hover:text-teal-600 transition-colors">Registo de Domínio .com</h4>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">meudominio.com · Privacidade Incluída</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-slate-800 dark:text-zinc-200 text-sm">800 MT<span className="text-[10px] text-slate-400 font-normal">/ano</span></div>
                    <span className="text-[10px] text-teal-600 dark:text-teal-500 font-bold">+ Adicionar</span>
                  </div>
                </div>

                <div
                  className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl hover:border-red-300 hover:shadow-sm transition-all cursor-pointer group"
                  onClick={() => addItem({ id: 'hosting-basico', type: 'hosting', name: 'Alojamento Web Básico', price: 680, period: 1 })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/20 flex items-center justify-center flex-shrink-0">
                      <Server className="w-4 h-4 text-red-600 dark:text-red-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm group-hover:text-red-600 transition-colors">Alojamento Web Básico</h4>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">10GB SSD · DirectAdmin</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-slate-800 dark:text-zinc-200 text-sm">680 MT<span className="text-[10px] text-slate-400 font-normal">/mês</span></div>
                    <span className="text-[10px] text-red-600 dark:text-red-500 font-bold">+ Adicionar</span>
                  </div>
                </div>

                <div
                  className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
                  onClick={() => addItem({ id: 'email-pro', type: 'email', name: 'Email Profissional', price: 250, period: 1 })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-blue-600 dark:text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm group-hover:text-blue-600 transition-colors">Email Profissional</h4>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">10 contas · Mail Marketing</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-slate-800 dark:text-zinc-200 text-sm">250 MT<span className="text-[10px] text-slate-400 font-normal">/mês</span></div>
                    <span className="text-[10px] text-blue-600 dark:text-blue-500 font-bold">+ Adicionar</span>
                  </div>
                </div>
              </div>
            </div>

          /* CART ITEMS */
          ) : (
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

              <div className="space-y-2 pt-2">
                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wide">Frequentemente adicionados</h3>
                {!items.find(i => i.type === 'domain') && (
                  <div
                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer group"
                    onClick={() => addItem({ id: 'domain-com', type: 'domain', name: 'Registo de Domínio .com', price: 800, period: 1 })}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                        <Globe className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-teal-600 transition-colors">Registo de Domínio .com</h4>
                        <p className="text-[10px] text-slate-500">meudominio.com · Privacidade Incluída</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-slate-800 text-sm">800 MT<span className="text-[10px] text-slate-400 font-normal">/ano</span></div>
                      <span className="text-[10px] text-teal-600 font-bold">+ Adicionar</span>
                    </div>
                  </div>
                )}
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
          )}

        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-5 bg-white border-t border-slate-200 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] space-y-3">

            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-sm">Total a pagar</span>
              <span className="text-2xl font-black text-slate-900">{total} MT</span>
            </div>

            <button
              onClick={goToCheckout}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-md flex items-center justify-center gap-2 transition-all"
            >
              Finalizar compra <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
