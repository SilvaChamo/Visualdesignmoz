'use client';

import React, { useEffect, useState } from 'react';
import {
  Globe,
  Server,
  RefreshCw,
  ShoppingCart,
  ExternalLink,
  Calendar,
  AlertCircle,
  FileText,
  ArrowRight,
} from 'lucide-react';
import type { ClientProductTier, UserProductsSummary } from '@/lib/user-products';
import { useCart } from '@/contexts/CartContext';

type Props = {
  onNavigate?: (section: string) => void;
};

// Só a contagem interessa aqui — a lista/estado detalhado de cada encomenda
// vive no painel próprio da VisualDesign (/encomendas), não neste painel de
// hospedagem, para não misturar as duas marcas.
type Quotation = {
  id: string;
};

export function ClientProductsHub({ onNavigate }: Props) {
  const { setIsCartOpen } = useCart();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<UserProductsSummary | null>(null);
  const [tier, setTier] = useState<ClientProductTier>('none');
  const [quotations, setQuotations] = useState<Quotation[]>([]);

  useEffect(() => {
    fetch('/api/my-products', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products ?? null);
        setTier(data.products?.tier ?? 'none');
      })
      .catch(() => setProducts(null))
      .finally(() => setLoading(false));

    fetch('/api/cotacoes')
      .then((r) => r.json())
      .then((data) => { if (data.success) setQuotations(data.quotations); })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!products || tier === 'none') {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
        Ainda não encontrámos produtos na sua conta. Se acabou de comprar, aguarde alguns minutos
        ou contacte o suporte.
        <button
          type="button"
          onClick={() => (window.location.href = '/guest')}
          className="block mt-3 font-bold text-red-600 hover:underline"
        >
          Voltar à área de compras →
        </button>
      </div>
    );
  }

  const showDomainPanel = tier === 'domain' || tier === 'both';
  const showHostingPanel = tier === 'hosting' || tier === 'both';

  return (
    <div className="space-y-6 p-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Os meus produtos</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tier === 'domain' && 'Gestão de domínios, renovações e novas compras.'}
          {tier === 'hosting' && 'Acesso à hospedagem e opção de comprar domínio.'}
          {tier === 'both' && 'Domínios, hospedagem, renovações e compras adicionais.'}
        </p>
      </div>

      {quotations.length > 0 && (
        <a
          href="/encomendas"
          className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl p-5 hover:border-red-300 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900">Encomendas VisualDesign</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Tem {quotations.length} {quotations.length === 1 ? 'encomenda' : 'encomendas'} de design gráfico — acompanhe no painel próprio.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </a>
      )}

      {showDomainPanel && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">Domínios</h2>
          </div>
          <div className="p-5 space-y-3">
            {products.domains.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum domínio registado ainda.</p>
            ) : (
              products.domains.map((d) => (
                <div
                  key={d.id ?? d.name}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div>
                    <p className="font-bold text-gray-900">{d.name}</p>
                    {d.expirationDate && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Expira: {new Date(d.expirationDate).toLocaleDateString('pt-PT')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate?.('facturas')}
                      className="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Renovar
                    </button>
                    <a
                      href={`https://${d.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold border border-gray-300 px-4 py-2 rounded-lg hover:border-blue-400 flex items-center gap-1"
                    >
                      Ver site <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))
            )}
            <button
              type="button"
              onClick={() => (window.location.href = '/precos#dominios')}
              className="text-sm font-bold text-red-600 hover:underline flex items-center gap-1"
            >
              <ShoppingCart className="w-4 h-4" /> Comprar outro domínio
            </button>
          </div>
        </section>
      )}

      {showHostingPanel && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-red-600" />
            <h2 className="font-bold text-gray-900">Hospedagem</h2>
          </div>
          <div className="p-5 space-y-3">
            {products.hosting.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum pacote de hospedagem activo.</p>
            ) : (
              products.hosting.map((h) => (
                <div
                  key={h.id ?? h.domain}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div>
                    <p className="font-bold text-gray-900">{h.domain}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Plano: {h.plan || 'Standard'}
                      {h.expirationDate &&
                        ` · Renova: ${new Date(h.expirationDate).toLocaleDateString('pt-PT')}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate?.('webmail')}
                      className="text-xs font-bold border border-gray-300 px-4 py-2 rounded-lg hover:border-red-400"
                    >
                      Webmail
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('facturas')}
                      className="text-xs font-bold bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                    >
                      Renovar
                    </button>
                  </div>
                </div>
              ))
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate?.('gestao-emails')}
                className="text-xs font-bold border border-gray-300 px-4 py-2 rounded-lg hover:border-red-400"
              >
                Gerir emails
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = '/precos#dominios')}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <ShoppingCart className="w-4 h-4" /> Comprar domínio no painel
              </button>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Acesso técnico ao servidor: apenas revendedores. Clientes gerem pelo painel Visual Design.
            </p>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsCartOpen(true)}
        className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-red-600"
      >
        <ShoppingCart className="w-4 h-4" /> Nova compra
      </button>
    </div>
  );
}
