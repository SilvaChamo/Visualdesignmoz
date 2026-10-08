import type { PanelMenuItemDef } from '@/lib/panel-admin-menu';
import { resolveSectionId } from '@/lib/panel-admin-menu';

/**
 * Menu do painel Cliente — o mesmo menu lateral do painel Profissional
 * (ResellerSidebar), mas só com o que um cliente sem site gere: domínios,
 * DNS e nameservers (para o email funcionar) e as caixas de email. Quem quer
 * um site passa a Profissional (ver promoteBuyerAfterPurchase).
 */
export function clientPanelMenuDefs(opts: {
  /** Ainda sem produtos activos (só compras/facturas/webmail). */
  readOnly: boolean;
  hasEncomendas: boolean;
  /** Cliente antigo que já tem um site — não lhe tirar a gestão dele. */
  hasWebsites: boolean;
}): PanelMenuItemDef[] {
  const account: PanelMenuItemDef[] = [
    { id: 'minhas-compras', label: 'As Minhas Compras' },
    { id: 'facturas', label: 'Facturas' },
  ];
  if (opts.readOnly) {
    return [{ id: 'webmail', label: 'Webmail' }, ...account];
  }
  return [
    {
      id: 'nov-dominios',
      label: 'Domínios & DNS',
      subItems: [
        { id: 'domain-manager', label: 'Domínios' },
        { id: 'dns-central', label: 'DNS Central' },
        { id: 'cp-dns-nameserver', label: 'Nameservers' },
        { id: 'transferir-dominio', label: 'Transferir' },
      ],
    },
    {
      id: 'nov-email',
      label: 'E-mail',
      subItems: [
        { id: 'emails-new', label: 'Contas de e-mail' },
        { id: 'webmail', label: 'Webmail' },
        { id: 'cp-email-forwarding', label: 'Encaminhamento' },
        { id: 'cp-email-catchall', label: 'Catch-all' },
      ],
    },
    ...(opts.hasWebsites
      ? [{
          id: 'nov-wordpress',
          label: 'Websites',
          subItems: [
            { id: 'wp-sites', label: 'Sites' },
            { id: 'wordpress-install', label: 'Criar Website' },
            { id: 'wp-plugins', label: 'Plugins' },
            { id: 'wp-backup', label: 'Backups' },
          ],
        }]
      : []),
    ...(opts.hasEncomendas
      ? [{
          id: 'nov-encomendas',
          label: 'Encomendas',
          subItems: [
            { id: 'encomendas', label: 'Encomendas' },
            { id: 'encomendas-mensagens', label: 'Mensagens' },
            { id: 'encomendas-pagamentos', label: 'Pagamentos' },
          ],
        }]
      : []),
    { id: 'mailmarketing', label: 'Mailmarketing' },
    ...account,
    { id: 'tickets', label: 'Suporte' },
    { id: 'conta', label: 'Conta' },
  ];
}

export const CLIENT_SECTION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  'meus-produtos': 'Dashboard',
  'domain-detail': 'Gerir domínio',
  domains: 'O Meu Site',
  'nov-dominios': 'Domínios & DNS',
  'nov-wordpress': 'Websites',
  'dns-central': 'DNS Central',
  'domain-manager': 'Domínios',
  'cp-dns-nameserver': 'Nameservers',
  'registrar-domains': 'Registar domínio',
  'transferir-dominio': 'Transferir domínio',
  'domains-registados': 'Domínios registados',
  'wp-sites': 'Sites',
  'wordpress-install': 'Criar Website',
  'wp-plugins': 'Plugins',
  'wp-backup': 'Backups',
  webmail: 'Webmail',
  mailmarketing: 'Mailmarketing',
  tickets: 'Suporte',
  facturas: 'Facturas',
  conta: 'Conta',
  'emails-new': 'Contas de e-mail',
  'cp-email-forwarding': 'Encaminhamento',
  'cp-email-catchall': 'Catch-all',
  'nov-email': 'E-mail',
  encomendas: 'Encomendas',
  'encomendas-mensagens': 'Mensagens',
  'encomendas-pagamentos': 'Pagamentos',
  'minhas-compras': 'As Minhas Compras',
};

export function clientSectionLabel(sectionId: string): string {
  const resolved = resolveSectionId(sectionId);
  return CLIENT_SECTION_LABELS[sectionId] || CLIENT_SECTION_LABELS[resolved] || 'Painel de Gestão';
}
