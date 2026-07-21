'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, Server, Mail, ShoppingCart, CreditCard, LogOut, User, FileText, ArrowRight } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { PanelHeader } from '@/components/panel/PanelHeader';
import { panelBtnSecondary } from '@/lib/panel-ui';
import { formatMt } from '@/lib/pricing-catalog';

type Props = {
  userEmail?: string | null;
  userName?: string | null;
  onSignOut: () => void;
};

type Quotation = {
  id: string;
  categoria_label: string;
  produto: string;
  quantidade: number;
  total_mt: number;
  sob_consulta: boolean;
  status: string;
  data_limite_entrega: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Aguarda contacto', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30' },
  payment_selected: { label: 'Aguarda pagamento', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30' },
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
  const [quotations, setQuotations] = useState<Quotation[]>([]);

  useEffect(() => {
    fetch('/api/cotacoes')
      .then((res) => res.json())
      .then((data) => { if (data.success) setQuotations(data.quotations); })
      .catch(() => {});
  }, []);

  const handleAction = (action: string) => {
    if (action === 'shop-domain') {
      window.location.href = '/servicos/dominios';
      return;
    }
    if (action === 'shop-hosting') {
      window.location.href = '/servicos/hospedagem';
      return;
    }
    if (action === 'shop-email') {
      window.location.href = '/servicos/email';
      return;
    }
    setIsCartOpen(true);
  };

  const displayName = userName || userEmail?.split('@')[0] || 'Visitante';

  return (
    <div className="panel-shell font-panel min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-between">
      {/* Cabeçalho esticado na largura total do painel */}
      <PanelHeader
        title={`Olá, ${displayName}`}
        description="Painel de Acesso Temporário"
        actions={
          <button type="button" onClick={onSignOut} className={panelBtnSecondary}>
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        }
      />

      {/* Conteúdo principal fluido alinhado com o painel admin (p-4 lg:p-6) */}
      <div className="w-full p-4 lg:p-6 flex-grow">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 lg:gap-6">
          {/* Coluna Esquerda: Conteúdo Principal */}
          <div className="space-y-4 lg:space-y-6">
            <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-amber-600 dark:text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Ainda não tem produtos activos</h2>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1 max-w-2xl">
                    A sua conta está registada como <strong>visitante (guest)</strong>. Após a primeira
                    compra confirmada (domínio, hospedagem ou email), passa automaticamente a{' '}
                    <strong>cliente</strong> com acesso ao painel correspondente.
                  </p>
                </div>
              </div>
            </section>

            {quotations.length > 0 && (
              <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">As Suas Cotações</h3>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">
                  Contacte-nos por telefone ou email para dar seguimento, ou avance directamente para o pagamento do adiantamento.
                </p>
                <div className="space-y-3">
                  {quotations.map((q) => {
                    const statusInfo = STATUS_LABELS[q.status] || { label: q.status, color: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700' };
                    return (
                      <Link
                        key={q.id}
                        href={`/cotacao/${q.id}`}
                        className="flex items-center justify-between gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-500 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-red-600 dark:text-red-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{q.categoria_label} — {q.produto}</p>
                            <p className="text-xs text-gray-500 dark:text-zinc-400">Qtd: {q.quantidade} · {q.sob_consulta ? 'Sob Consulta' : `${formatMt(q.total_mt)} MT`}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                          <ArrowRight className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {offers.map((offer) => {
                  const Icon = offer.icon;
                  return (
                    <button
                      key={offer.id}
                      type="button"
                      onClick={() => handleAction(offer.action)}
                      className={`text-left p-5 rounded-lg border dark:bg-zinc-900 dark:border-zinc-800/80 hover:shadow-md transition-all ${offer.color}`}
                    >
                      <Icon className={`w-8 h-8 mb-3 ${offer.iconColor}`} />
                      <h3 className="font-bold text-gray-900 dark:text-white">{offer.title}</h3>
                      <p className="text-xs text-gray-600 dark:text-zinc-400 mt-2 leading-relaxed">{offer.description}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="inline-flex items-center gap-2 bg-black dark:bg-zinc-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-red-600 dark:hover:bg-red-600 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" /> Ver carrinho
              </button>
              <a
                href="/precos"
                className="inline-flex items-center gap-2 border border-zinc-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 px-5 py-2.5 rounded-lg text-sm font-bold hover:border-red-300 dark:hover:border-red-500 hover:text-red-600 dark:hover:text-red-500 transition-colors"
              >
                <CreditCard className="w-4 h-4" /> Ver preços
              </a>
            </section>
          </div>

          {/* Coluna Direita: Barra Lateral Compacta (Dados do Visitante) */}
          <div className="shrink-0">
            <aside className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800/80 pb-2">
                Dados da Conta
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 block uppercase font-bold">Nome</span>
                  <span className="font-semibold text-gray-800 dark:text-zinc-200">{displayName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 block uppercase font-bold">E-mail</span>
                  <span className="font-semibold text-gray-800 dark:text-zinc-200 break-all">{userEmail || 'Não disponível'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 block uppercase font-bold">Estado</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30 mt-1">
                    Visitante (Guest)
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Rodapé Compacto */}
      <footer className="w-full text-center py-4 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-gray-400 dark:text-zinc-500">
        <p>© {new Date().getFullYear()} VisualDesign. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
