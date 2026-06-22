'use client';

import React from 'react';
import { Globe, Server, Mail, ShoppingCart, CreditCard, LogOut, User } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { PanelHeader } from '@/components/panel/PanelHeader';
import { panelBtnSecondary } from '@/lib/panel-ui';

type Props = {
  userEmail?: string | null;
  userName?: string | null;
  onSignOut: () => void;
};

const offers = [
  {
    id: 'domain',
    title: 'Comprar domínio',
    description: 'Registe o seu .com, .co.mz ou outra extensão.',
    icon: Globe,
    action: 'shop-domain',
    color: 'border-blue-200 bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    id: 'hosting',
    title: 'Comprar hospedagem',
    description: 'Alojamento web com email e painel de gestão.',
    icon: Server,
    action: 'shop-hosting',
    color: 'border-red-200 bg-red-50',
    iconColor: 'text-red-600',
  },
  {
    id: 'email',
    title: 'Comprar email profissional',
    description: 'Conta de email no seu domínio.',
    icon: Mail,
    action: 'shop-email',
    color: 'border-cyan-200 bg-cyan-50',
    iconColor: 'text-cyan-600',
  },
];

export function GuestDashboard({ userEmail, userName, onSignOut }: Props) {
  const { setIsCartOpen } = useCart();

  const handleAction = (action: string) => {
    if (action === 'shop-domain') {
      window.location.href = '/precos#dominios';
      return;
    }
    if (action === 'shop-hosting') {
      window.location.href = '/precos#hospedagem';
      return;
    }
    if (action === 'shop-email') {
      window.location.href = '/precos#email';
      return;
    }
    setIsCartOpen(true);
  };

  const displayName = userName || userEmail?.split('@')[0] || 'Visitante';

  return (
    <div className="panel-shell font-panel min-h-screen bg-gray-50 dark:bg-zinc-950">
      <PanelHeader
        title={`Olá, ${displayName}`}
        description={userEmail || 'Conta visitante'}
        actions={
          <button type="button" onClick={onSignOut} className={panelBtnSecondary}>
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        }
      />

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Ainda não tem produtos activos</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                A sua conta está registada como <strong>visitante (guest)</strong>. Após a primeira
                compra confirmada (domínio, hospedagem ou email), passa automaticamente a{' '}
                <strong>cliente</strong> com acesso ao painel correspondente.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
            O que pretende comprar?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {offers.map((offer) => {
              const Icon = offer.icon;
              return (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => handleAction(offer.action)}
                  className={`text-left p-5 rounded-xl border-2 ${offer.color} hover:shadow-md transition-all`}
                >
                  <Icon className={`w-8 h-8 mb-3 ${offer.iconColor}`} />
                  <h3 className="font-bold text-gray-900">{offer.title}</h3>
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">{offer.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-red-600 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" /> Ver carrinho
          </button>
          <a
            href="/precos"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-bold hover:border-red-300 hover:text-red-600 transition-colors"
          >
            <CreditCard className="w-4 h-4" /> Ver preços
          </a>
        </section>
      </main>
    </div>
  );
}
