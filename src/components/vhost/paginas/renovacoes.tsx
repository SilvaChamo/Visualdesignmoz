'use client';

// Renovações no painel vhost (Silva, 24/10/2026: "o módulo de renovação precisamos de activar no vhost"). As renovações dos domínios e
// da hospedagem vêm do dashboard antigo tal e qual — os próprios componentes (RenewalsSection para o administrador, ClientRenewalsSection
// para o cliente), as mesmas rotas (/api/renewals…), sem reescrever nada —, só com novo sítio: Admin › Renovações e Gestão › Renovações.
// Os modelos das mensagens de renovação já estão em Admin › Mensagem a todos › Templates (TemplatesSection); os comprovativos e pagamentos
// das renovações, em Admin › Contabilidade. O aviso diário aos clientes é o /api/cron/renewal-check (instalado pelo deploy).
import { RenewalsSection } from '@/components/vhost/comuns/RenewalsSection';
import ClientRenewalsSection, { type SiteInfo } from '@/components/vhost/comuns/ClientRenewalsSection';
import type { ScreenFn } from '../screens';
import { DESC, EN, MENU } from '../generated/data';

// ---------- Menu: grupo "Renovações" no Admin e na Gestão (antes de "Suporte e ajuda") ----------
{
  const admin = MENU.admin;
  if (!admin.some(([g]) => g === 'Renovações')) {
    admin.push([
      'Renovações',
      [
        {
          id: 'renovacoes',
          fa: 'fa-rotate',
          t: 'Renovações',
          c: 'c3',
          da: '—',
          f: ['Domínios e hospedagem a expirar, de todos os clientes', 'Registar uma renovação e enviar avisos', 'Estado e preços das renovações'],
          hx: { s: 'app', cmd: '', n: 'Renovações de domínios e hospedagem da VisualDesign' },
        },
      ],
    ]);
  }
  const util = MENU.utilizador;
  if (!util.some(([g]) => g === 'Renovações')) {
    const i = util.findIndex(([g]) => g === 'Suporte e ajuda');
    util.splice(i < 0 ? util.length : i, 0, [
      'Renovações',
      [
        {
          id: 'renovacoes',
          fa: 'fa-rotate',
          t: 'Renovações',
          c: 'c3',
          da: '—',
          f: ['Os seus domínios e serviços a expirar', 'Pagar a renovação', 'Avisos antes de expirar'],
          hx: { s: 'app', cmd: '', n: 'Renovações dos seus domínios e serviços' },
        },
      ],
    ]);
  }
  DESC['admin/renovacoes'] = ['Domínios e hospedagem a expirar, registo de renovações e avisos aos clientes', 'Domains and hosting about to expire, renewal records and client reminders'];
  DESC['utilizador/renovacoes'] = ['Os seus domínios e serviços a expirar, e o pagamento da renovação', 'Your domains and services about to expire, and renewal payment'];
  const novas: Record<string, string> = {
    Renovações: 'Renewals',
  };
  for (const [pt, en] of Object.entries(novas)) if (!(pt in EN)) EN[pt] = en;
}

/** Admin › Renovações: todas as renovações (visão geral, domínios, hospedagem) e o registo de uma nova */
export const renovacoesAdminPagina: ScreenFn = () => ({
  title: 'Renovações',
  desc: 'Domínios e hospedagem a expirar, de todos os clientes',
  crumbs: [{ t: 'Renovações' }],
  body: (
    <div className="tw-livre">
      <RenewalsSection initialTab="overview" />
    </div>
  ),
});

/** Gestão › Renovações: as renovações do próprio cliente */
export const renovacoesClientePagina: ScreenFn = (vh) => {
  // um por domínio da conta, com o que o servidor leu: caixas de e-mail, espaço e tráfego
  const sites: SiteInfo[] = vh.a.domains
    .filter((d) => !d.soDominio)
    .map((d) => ({
      domain: d.name,
      emailAccounts: vh.a.mails.filter((m) => m.dom === d.name).length,
      diskUsage: d.disk,
      bandwidth: d.bw ?? '—',
      status: d.status === 'ok' ? 'active' : 'suspended',
    }));
  return {
  title: 'Renovações',
  desc: 'Os seus domínios e serviços a expirar',
  crumbs: [{ t: 'Renovações' }],
  body: (
    <div className="tw-livre">
      <ClientRenewalsSection sites={sites} />
    </div>
  ),
  };
};
