'use client';

// Admin › Encomendas e contabilidade (Silva, 21/10/2026): a gestão das encomendas e a contabilidade são sempre do administrador
// e vêm do dashboard antigo (/dashboard) tal e qual — os próprios componentes (CotacoesSection, EncomendasClientesSection,
// ContabilidadeTable), as mesmas rotas, sem reescrever nada. Só mudam o sítio (separador Admin do painel) e o enquadramento:
// o desenho do dashboard antigo (Tailwind) dentro do cartão principal (.tw-livre) e os botões da secção na barra de cima,
// como em Mensagem a todos. O lado do cliente é Gestão › Compras e encomendas (encomendas.tsx).
import { useState } from 'react';
import { AdminSectionChromeProvider } from '@/components/admin/AdminSectionChrome';
import { CotacoesSection } from '@/app/dashboard/CotacoesSection';
import { EncomendasClientesSection } from '@/components/dashboard/EncomendasClientesSection';
import { ContabilidadeTable } from '@/components/quotations/ContabilidadeTable';
import type { ScreenFn } from '../screens';
import { useVH } from '../context';
import { DESC, EN, MENU } from '../generated/data';
import { Tabs } from './componentes';
import { LugarBarraAntiga, PonteBarraAntiga } from './mensagem-todos';

// ---------- Menu: grupo "Encomendas e contabilidade" no Admin, antes de "Gestão do servidor" ----------
{
  const grupos = MENU.admin;
  if (!grupos.some(([g]) => g === 'Encomendas e contabilidade')) {
    const i = grupos.findIndex(([g]) => g === 'Gestão do servidor');
    grupos.splice(i < 0 ? grupos.length : i, 0, [
      'Encomendas e contabilidade',
      [
        {
          id: 'gestao-encomendas',
          fa: 'fa-box-open',
          t: 'Encomendas',
          c: 'c2',
          da: '—',
          f: ['Todas as encomendas de produção gráfica, brindes e webdesign', 'Aprovar, pedir pagamento, entregar e cancelar', 'Contas de clientes das encomendas'],
          hx: { s: 'app', cmd: '', n: 'Encomendas do site da VisualDesign' },
        },
        {
          id: 'contabilidade',
          fa: 'fa-calculator',
          t: 'Contabilidade',
          c: 'c4',
          da: '—',
          f: ['Receitas e despesas das encomendas', 'Facturas, pagamentos e fecho do ano'],
          hx: { s: 'app', cmd: '', n: 'Contabilidade do site da VisualDesign' },
        },
      ],
    ]);
  }
  DESC['admin/gestao-encomendas'] = ['As encomendas de todos os clientes e as contas de quem encomenda', 'Every client’s orders and the accounts of those who order'];
  DESC['admin/contabilidade'] = ['Receitas, despesas, facturas e pagamentos das encomendas', 'Income, expenses, invoices and payments from orders'];
  const novas: Record<string, string> = {
    'Encomendas e contabilidade': 'Orders and accounting',
    Contabilidade: 'Accounting',
    Contas: 'Accounts',
  };
  for (const [pt, en] of Object.entries(novas)) if (!(pt in EN)) EN[pt] = en;
}

const BASE = '/admin/gestao-encomendas';
type Aba = 'encomendas' | 'contas';

/** O desenho do dashboard antigo, com os botões da secção na barra de cima */
function ComBarraAntiga({ children }: { children: React.ReactNode }) {
  const [linhaTelemovel, setLinhaTelemovel] = useState<HTMLDivElement | null>(null);
  return (
    <AdminSectionChromeProvider>
      <PonteBarraAntiga noTelemovel={linhaTelemovel} />
      <div className="barra-antiga-m" ref={setLinhaTelemovel} />
      {children}
    </AdminSectionChromeProvider>
  );
}

function Encomendas({ aba }: { aba: Aba }) {
  const vh = useVH();
  return (
    <>
      <Tabs<Aba>
        tabs={[
          ['encomendas', 'Encomendas', 'fa-box-open'],
          ['contas', 'Contas', 'fa-users'],
        ]}
        on={aba}
        onChange={(k) => vh.nav(k === 'contas' ? BASE + '/contas' : BASE)}
      />
      <div className="tw-livre">
        <ComBarraAntiga key={aba}>{aba === 'contas' ? <EncomendasClientesSection isActive /> : <CotacoesSection />}</ComBarraAntiga>
      </div>
    </>
  );
}

export const gestaoEncomendasPagina: ScreenFn = (vh) => {
  const aba: Aba = vh.s.sub[0] === 'contas' ? 'contas' : 'encomendas';
  return {
    title: 'Encomendas',
    desc: aba === 'contas' ? 'Contas de clientes das encomendas' : 'As encomendas de todos os clientes',
    crumbs: [{ t: 'Encomendas', path: BASE }, ...(aba === 'contas' ? [{ t: 'Contas' }] : [])],
    actions: <LugarBarraAntiga />,
    body: <Encomendas aba={aba} />,
  };
};

export const contabilidadePagina: ScreenFn = () => ({
  title: 'Contabilidade',
  desc: 'Receitas, despesas, facturas e pagamentos das encomendas',
  actions: <LugarBarraAntiga />,
  body: (
    <div className="tw-livre">
      <ComBarraAntiga>
        <ContabilidadeTable />
      </ComBarraAntiga>
    </div>
  ),
});
