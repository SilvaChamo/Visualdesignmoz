'use client';

import React, { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { X, Trash2, ShoppingCart, ChevronRight, Shield, Server, Trash, Mail, Globe, ClipboardList } from 'lucide-react';
import { useEncomendaDraft } from '@/lib/use-encomenda-draft';
import {
  clearEncomendaDraft,
  descartarEncomendaRegistada,
  encomendaRegistadaValida,
  encomendaResumePath,
  priceEncomendaItems,
  type EncomendaDraft,
} from '@/lib/encomenda-checkout';
import { formatMt } from '@/lib/pricing-catalog';
import { HOSTING_PLANS } from '@/lib/hosting-plans';
import { EMAIL_BASICO_ID, EMAIL_BASICO_PRICE_MT } from '@/lib/package-catalog';
import { DOMAIN_TLD_PRICES, domainRegistrationPriceMt } from '@/lib/domain-tld-prices';
import { checkoutEntryPath, DOMAIN_STEP_PATH } from '@/lib/checkout-flow';
import { useI18n } from '@/lib/i18n';

const DOMAIN_REGISTRATION_YEARS = [1, 2, 3, 5, 10];

// Espaço em disco de cada plano, na mesma ordem de /precos/hospedagem — só
// para a descrição curta aqui no carrinho, não é usado no cálculo de preço.
const HOSTING_PLAN_STORAGE_GB: Record<string, number> = {
  'hosting-basico': 10,
  'hosting-pro': 20,
  'hosting-business': 30,
  'hosting-enterprise': 40,
};

/**
 * Encomenda VisualDesign a meio do pagamento (rascunho de /cotacao → checkout)
 * — fica aqui, no balão do carrinho, até o comprovativo seguir ou o cliente a
 * cancelar, para nunca se perder. "Continuar" volta exactamente ao passo onde
 * estava (pagar, ou anexar o comprovativo se já a gravou).
 */
function EncomendaPendenteCard({ draft, onNavigate }: { draft: EncomendaDraft; onNavigate: () => void }) {
  const [cancelling, setCancelling] = useState(false);
  const pricing = priceEncomendaItems(draft.itens);
  const registada = encomendaRegistadaValida(draft);
  const servicos = [...new Set(pricing.linhas.map((l) => l.categoriaLabel))].join(', ');

  const cancelar = async () => {
    if (!window.confirm('Cancelar esta encomenda? Os dados preenchidos e o pedido são apagados.')) return;
    setCancelling(true);
    if (draft.registada) {
      const descartada = await descartarEncomendaRegistada(draft.registada.quotationId);
      // 409: já tem comprovativo/está com a equipa — continua no painel das
      // encomendas, só sai daqui do carrinho.
      if (!descartada.ok && descartada.status !== 409) {
        window.alert(descartada.error);
        setCancelling(false);
        return;
      }
      if (!descartada.ok) window.alert(descartada.error);
    }
    clearEncomendaDraft();
    setCancelling(false);
  };

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Encomenda por concluir</h3>
      <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
        <div className="flex items-start justify-between p-4 gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ClipboardList className="w-4 h-4 text-red-600" />
            </div>
            <div className="min-w-0">
              <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-[9px] font-bold text-slate-500 rounded uppercase tracking-wider mb-1">Encomenda VisualDesign</span>
              <h4 className="font-bold text-slate-800 text-sm truncate">{draft.empresa}</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                {pricing.linhas.length} {pricing.linhas.length === 1 ? 'serviço' : 'serviços'} — {servicos}
              </p>
              <p className={`text-[11px] font-bold mt-1 ${registada ? 'text-blue-600' : 'text-amber-600'}`}>
                {registada ? 'Registada — falta anexar o comprovativo' : pricing.adiantamentoMt > 0 ? 'Falta pagar' : 'Falta submeter'}
              </p>
            </div>
          </div>
          {pricing.adiantamentoMt > 0 && (
            <div className="text-right flex-shrink-0">
              <div className="font-black text-slate-900 text-base">{formatMt(pricing.adiantamentoMt)} MT</div>
              <div className="text-[10px] text-slate-400">adiantamento 70%</div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-t border-slate-50 pt-3 gap-2">
          <button
            onClick={cancelar}
            disabled={cancelling}
            className="flex items-center gap-1 text-slate-400 hover:text-red-500 transition-colors text-xs disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> {cancelling ? 'A cancelar...' : 'Cancelar'}
          </button>
          <button
            onClick={() => {
              onNavigate();
              window.location.href = encomendaResumePath(draft);
            }}
            disabled={cancelling}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-md flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            {registada ? 'Anexar comprovativo' : 'Continuar'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function CartDrawer() {
  const { isCartOpen, setIsCartOpen, items, removeItem, updateItemPeriod, total, clearCart, addItem } = useCart();
  const { formatPrice } = useCurrency();
  const { t } = useI18n();
  const encomenda = useEncomendaDraft();
  const comTld = DOMAIN_TLD_PRICES.find((row) => row.value === '.com')!;
  const comPriceMt = domainRegistrationPriceMt(comTld, 1);
  const count = items.length + (encomenda ? 1 : 0);

  if (!isCartOpen) return null;

  const handleClose = () => {
    setIsCartOpen(false);
  };

  const goToCheckout = () => {
    setIsCartOpen(false);
    window.location.href = checkoutEntryPath(items);
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
            {count > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-black bg-red-600 text-white rounded-full">{count}</span>
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

          {encomenda && <EncomendaPendenteCard draft={encomenda} onNavigate={handleClose} />}

          {/* EMPTY */}
          {items.length === 0 && encomenda ? null : items.length === 0 ? (
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
                  onClick={() => { setIsCartOpen(false); window.location.href = '/servicos/dominios'; }}
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
                    <div className="font-bold text-slate-800 dark:text-zinc-200 text-sm">{formatPrice(comPriceMt)}<span className="text-[10px] text-slate-400 font-normal">/ano</span></div>
                    <span className="text-[10px] text-teal-600 dark:text-teal-500 font-bold">Pesquisar</span>
                  </div>
                </div>

                {HOSTING_PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl hover:border-red-300 hover:shadow-sm transition-all cursor-pointer group"
                    onClick={() => {
                      addItem({ id: plan.id, type: 'hosting', name: `Alojamento Web ${t(plan.nameKey)}`, price: plan.basePrice, period: 1 });
                      setIsCartOpen(false);
                      window.location.href = DOMAIN_STEP_PATH;
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/20 flex items-center justify-center flex-shrink-0">
                        <Server className="w-4 h-4 text-red-600 dark:text-red-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm group-hover:text-red-600 transition-colors">Alojamento Web {t(plan.nameKey)}</h4>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400">{HOSTING_PLAN_STORAGE_GB[plan.id]}GB SSD · DirectAdmin</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-slate-800 dark:text-zinc-200 text-sm">{formatPrice(plan.basePrice)}<span className="text-[10px] text-slate-400 font-normal">/mês</span></div>
                      <span className="text-[10px] text-red-600 dark:text-red-500 font-bold">+ Adicionar</span>
                    </div>
                  </div>
                ))}

                <div
                  className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
                  onClick={() => addItem({ id: EMAIL_BASICO_ID, type: 'email', name: 'Email Básico', price: EMAIL_BASICO_PRICE_MT, period: 1 })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-blue-600 dark:text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm group-hover:text-blue-600 transition-colors">Email Básico</h4>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">Domínio escolhe-se depois, no painel</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-slate-800 dark:text-zinc-200 text-sm">{formatPrice(EMAIL_BASICO_PRICE_MT)}<span className="text-[10px] text-slate-400 font-normal">/mês</span></div>
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
                          {item.renewPrice && <p className="text-[10px] text-slate-400 mt-0.5">Renovação: {formatPrice(item.renewPrice)}/ano</p>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-black text-slate-900 text-base">{formatPrice(item.price)}</div>
                        {item.type === 'hosting' || item.type === 'email' ? (
                          <div className="text-[10px] text-slate-400">/mês</div>
                        ) : (
                          <div className="text-[10px] text-slate-400">/ano</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 pb-3 border-t border-slate-50 pt-3">
                      {item.type === 'domain' && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-green-700 text-[10px] font-medium">
                            <Shield className="w-3 h-3" />
                            Privacidade grátis incluída
                          </div>
                          <select
                            value={item.period}
                            onChange={(e) => {
                              const years = Number(e.target.value);
                              const tld = DOMAIN_TLD_PRICES.find((t) => item.name.toLowerCase().endsWith(t.value));
                              const newPrice = tld ? domainRegistrationPriceMt(tld, years) : item.price;
                              updateItemPeriod(item.id, years, newPrice);
                            }}
                            className="ml-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600"
                          >
                            {DOMAIN_REGISTRATION_YEARS.map((y) => (
                              <option key={y} value={y}>{y} {y === 1 ? 'ano' : 'anos'}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {item.type === 'hosting' && !item.hostingDomain && (
                        <a href={DOMAIN_STEP_PATH} onClick={() => setIsCartOpen(false)} className="text-[10px] font-bold text-amber-600 hover:underline">
                          Falta escolher domínio →
                        </a>
                      )}
                      {(item.type === 'hosting' && item.hostingDomain) || item.type === 'email' ? (
                        <span className="text-[10px] text-slate-400">
                          {item.type === 'hosting' ? `${item.hostingDomain} · ` : ''}
                          Período: {item.period} {item.period === 1 ? 'mês' : 'meses'}
                        </span>
                      ) : null}
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
                    onClick={() => { setIsCartOpen(false); window.location.href = '/servicos/dominios'; }}
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
                      <div className="font-bold text-slate-800 text-sm">{formatPrice(comPriceMt)}<span className="text-[10px] text-slate-400 font-normal">/ano</span></div>
                      <span className="text-[10px] text-teal-600 font-bold">Pesquisar</span>
                    </div>
                  </div>
                )}
                {HOSTING_PLANS.filter((plan) => !items.find((i) => i.id === plan.id)).map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 hover:border-red-300 hover:shadow-sm transition-all cursor-pointer group"
                    onClick={() => {
                      addItem({ id: plan.id, type: 'hosting', name: `Alojamento Web ${t(plan.nameKey)}`, price: plan.basePrice, period: 1 });
                      setIsCartOpen(false);
                      window.location.href = DOMAIN_STEP_PATH;
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                        <Server className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-red-600 transition-colors">Alojamento Web {t(plan.nameKey)}</h4>
                        <p className="text-[10px] text-slate-500">{HOSTING_PLAN_STORAGE_GB[plan.id]}GB SSD · DirectAdmin</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-slate-800 text-sm">{formatPrice(plan.basePrice)}<span className="text-[10px] text-slate-400 font-normal">/mês</span></div>
                      <span className="text-[10px] text-red-600 font-bold">+ Adicionar</span>
                    </div>
                  </div>
                ))}
                {!items.find(i => i.id === 'email-basico') && (
                  <div
                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
                    onClick={() => addItem({ id: EMAIL_BASICO_ID, type: 'email', name: 'Email Básico', price: EMAIL_BASICO_PRICE_MT, period: 1 })}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">Email Básico</h4>
                        <p className="text-[10px] text-slate-500">Domínio escolhe-se depois, no painel</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-slate-800 text-sm">{formatPrice(EMAIL_BASICO_PRICE_MT)}<span className="text-[10px] text-slate-400 font-normal">/mês</span></div>
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
              <span className="text-2xl font-black text-slate-900">{formatPrice(total)}</span>
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
