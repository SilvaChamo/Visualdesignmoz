export type DomainHubTab = 'meus' | 'adicionar' | 'registados' | 'registar';

export interface PanelMenuSubItem {
  id: string;
  label: string;
}

export interface PanelMenuItemDef {
  id: string;
  label: string;
  subItems?: PanelMenuSubItem[];
  isNewMenu?: boolean;
}

/** Menu admin (sidebar esquerda — referência aprovada) */
export const NEW_MENU_ITEM_DEFS: PanelMenuItemDef[] = [
  { id: 'dashboard', label: 'Dashboard', isNewMenu: true },
  {
    id: 'utilizadores',
    label: 'Utilizadores',
    isNewMenu: true,
    subItems: [
      { id: 'clientes', label: 'Clientes' },
      { id: 'utilizadores-visitantes', label: 'Visitantes' },
      { id: 'utilizadores-gestao', label: 'Gestão' },
    ],
  },
  {
    id: 'nov-hospedagem',
    label: 'Hospedagem',
    isNewMenu: true,
    subItems: [
      { id: 'hospedagem-contas', label: 'Contas' },
      { id: 'hospedagem-mover-revenda', label: 'Mover contas' },
      { id: 'packages-list', label: 'Pacotes' },
      { id: 'revendedores', label: 'Revendedores' },
    ],
  },
  {
    id: 'nov-email',
    label: 'E-mail',
    isNewMenu: true,
    subItems: [
      { id: 'emails-new', label: 'Contas de e-mail' },
      { id: 'webmail', label: 'Webmail' },
      { id: 'setup-smtp', label: 'Configurar SMTP' },
    ],
  },
  {
    id: 'newsletter',
    label: 'E-mail Marketing',
    isNewMenu: true,
    subItems: [
      { id: 'newsletter-subs', label: 'Gerir Contactos' },
      { id: 'newsletter-comp', label: 'Mailmarketing' },
      { id: 'newsletter-camp', label: 'Histórico' },
    ],
  },
  {
    id: 'nov-dominios',
    label: 'Domínios & DNS',
    isNewMenu: true,
    subItems: [
      { id: 'domain-manager', label: 'Domínios' },
      { id: 'dns-central', label: 'DNS Central' },
      { id: 'cp-ssl', label: 'SSL / TLS' },
      { id: 'cp-php', label: 'Configurar PHP' },
      { id: 'cp-dns-nameserver', label: 'Nameservers' },
      { id: 'transferir-dominio', label: 'Transferir' },
    ],
  },
  {
    id: 'nov-notificacoes',
    label: 'Notificações',
    isNewMenu: true,
    subItems: [
      { id: 'renewals', label: 'Visão geral' },
      { id: 'cadastrar-renovacao', label: 'Cadastrar' },
      { id: 'templates-renovacao', label: 'Templates' },
    ],
  },
  {
    id: 'cotacoes',
    label: 'Cotações',
    isNewMenu: true,
  },
  {
    id: 'nov-wordpress',
    label: 'WordPress',
    isNewMenu: true,
    subItems: [
      { id: 'wp-sites', label: 'Sites' },
      { id: 'wordpress-install', label: 'Criar Website' },
      { id: 'wp-plugins', label: 'Plugins' },
      { id: 'wp-backup', label: 'Backups' },
      { id: 'cp-databases', label: 'Bases de Dados' },
    ],
  },
  {
    id: 'nov-sistema',
    label: 'Sistema',
    isNewMenu: true,
    subItems: [
      { id: 'infrastructure', label: 'Servidor e API' },
      { id: 'git-deploy', label: 'Deploy / GitHub' },
      { id: 'cp-security', label: 'Segurança' },
      { id: 'cp-reseller-permissions', label: 'Painel do Revendedor' },
    ],
  },
];

/** Menu principal revendedor — espelha submenus da barra lateral (fonte única com permissões). */
export const RESELLER_MAIN_MENU_DEFS: PanelMenuItemDef[] = [
  {
    id: 'nov-hospedagem',
    label: 'Hospedagem',
    subItems: [
      { id: 'hospedagem-contas', label: 'Contas' },
      { id: 'packages-list', label: 'Pacotes' },
    ],
  },
  {
    id: 'nov-email',
    label: 'E-mail',
    subItems: [
      { id: 'emails-new', label: 'Contas de e-mail' },
      { id: 'webmail', label: 'Webmail' },
      { id: 'setup-smtp', label: 'Envio e Recepção' },
    ],
  },
  {
    id: 'newsletter',
    label: 'E-mail Marketing',
    subItems: [
      { id: 'newsletter-subs', label: 'Gerir Contactos' },
      { id: 'newsletter-comp', label: 'Mailmarketing' },
      { id: 'newsletter-camp', label: 'Histórico' },
    ],
  },
  {
    id: 'nov-dominios',
    label: 'Domínios & DNS',
    subItems: [
      { id: 'domain-manager', label: 'Domínios' },
      { id: 'registrar-domains', label: 'Registar domínio' },
      { id: 'domains-registados', label: 'Domínios registados' },
      { id: 'dns-central', label: 'DNS Central' },
      { id: 'cp-ssl', label: 'SSL / TLS' },
      { id: 'cp-php', label: 'Configurar PHP' },
      { id: 'cp-dns-nameserver', label: 'Nameservers' },
      { id: 'transferir-dominio', label: 'Transferir' },
    ],
  },
  {
    id: 'nov-wordpress',
    label: 'WordPress',
    subItems: [
      { id: 'wp-sites', label: 'Sites' },
      { id: 'wordpress-install', label: 'Criar Website' },
      { id: 'wp-plugins', label: 'Plugins' },
      { id: 'wp-backup', label: 'Backups' },
      { id: 'wp-backup-report', label: 'Backup e restauro' },
      { id: 'wp-backup-auto', label: 'Configurações de backup' },
      { id: 'cp-databases', label: 'Bases de Dados' },
    ],
  },
  {
    id: 'nov-notificacoes',
    label: 'Notificações',
    subItems: [
      { id: 'notificacoes-recebidas', label: 'Recebidas' },
      { id: 'renewals', label: 'Visão geral' },
      { id: 'cadastrar-renovacao', label: 'Cadastrar' },
      { id: 'templates-renovacao', label: 'Templates' },
    ],
  },
  {
    id: 'nov-definicoes',
    label: 'Definições',
    subItems: [
      { id: 'infrastructure', label: 'Servidor e API' },
      { id: 'git-deploy', label: 'Deploy / GitHub' },
      { id: 'file-manager', label: 'Gestor de ficheiros' },
      { id: 'cp-ftp', label: 'Contas FTP' },
      { id: 'settings-branding', label: 'Branding & Logo' },
      { id: 'settings-profile', label: 'Meu Perfil' },
    ],
  },
];

export const RESELLER_MENU_DEFS: PanelMenuItemDef[] = [...RESELLER_MAIN_MENU_DEFS];

/** IDs que abrem o hub de domínios (com tab específica) */
export const DOMAIN_HUB_ROUTE_IDS = new Set([
  'domain-manager',
  'domains',
  'domains-list',
  'domains-new',
  'cp-subdomains',
  'registrar-domains',
  'domains-registados',
]);

export function domainHubTabForSection(sectionId: string): DomainHubTab {
  if (sectionId === 'domains-new' || sectionId === 'cp-subdomains') return 'adicionar';
  if (sectionId === 'registrar-domains') return 'registar';
  if (sectionId === 'domains-registados') return 'registados';
  return 'meus';
}

export function isDomainHubRoute(sectionId: string): boolean {
  return DOMAIN_HUB_ROUTE_IDS.has(sectionId);
}

/** Aliases de IDs antigos → secção canónica (dashboard em cards, URLs legadas) */
export const LEGACY_ALIAS: Record<string, string> = {
  'domains-legacy': 'domain-manager',
  'domains-list-legacy': 'domain-manager',
  'domains-new-legacy': 'domain-manager',
  'packages-list-legacy': 'packages-list',
  'backup-manager-legacy': 'backup-manager',
  'infrastructure-legacy': 'infrastructure',
  'cp-reseller-legacy': 'cp-reseller',
  'cp-users-legacy': 'cp-users',
  'dns-central-legacy': 'dns-central',
  'domains-dns': 'dns-central',
  'cp-dns-zone-editor': 'dns-central',
  'emails-new-legacy': 'emails-new',
  'webmail-legacy': 'webmail',
  'emails-webmail': 'webmail',
  'cp-email-mgmt': 'emails-new',
  'criar-email-legacy': 'criar-email',
  'wordpress-install-legacy': 'wordpress-install',
  'newsletter-legacy': 'newsletter',
  'renewals-legacy': 'renewals',
  'cadastrar-renovacao-legacy': 'cadastrar-renovacao',
  'templates-renovacao-legacy': 'templates-renovacao',
  'git-deploy-legacy': 'git-deploy',
  'wp-update': 'wp-plugins',
  'cp-wp-list': 'wp-sites',
  'cp-wp-plugins': 'wp-plugins',
  'cp-wp-backup': 'backup-manager',
  'cp-wp-restore-backup': 'backup-manager',
  'cp-wp-remote-backup': 'backup-manager',
  'wp-backup': 'backup-manager',
  'wp-backup-auto': 'backup-manager',
  'wp-backup-report': 'backup-manager',
  'porkbun-domains': 'registrar-domains',
  'porkbun-my-domains': 'domains-registados',
  'porkbun-domains-legacy': 'registrar-domains',
  'porkbun-my-domains-legacy': 'domains-registados',
  domains: 'domain-manager',
  'domains-list': 'domain-manager',
  'domains-new': 'domain-manager',
  'cp-api': 'infrastructure',
  notifications: 'renewals',
};

/** Rotas internas fora do sistema de secções do painel (sidebar / dashboard). */
export const PANEL_EXTERNAL_PATHS: Record<string, string> = {
  mensagens: '/dashboard/mensagens',
  'mensagens-subs': '/dashboard/mensagens/subscritores',
  'mensagens-camp': '/dashboard/mensagens/campanhas',
};

export type PanelNavigationTarget = {
  section: string;
  domainHubTab?: DomainHubTab;
  openPackagesCreate?: boolean;
};

/** Normaliza secção + opções (sidebar, dashboard cards, ?section= na URL) */
export function resolvePanelNavigation(sectionId: string): PanelNavigationTarget {
  const raw = sectionId.trim();
  if (!raw) return { section: 'dashboard' };

  if (raw === 'packages-new') {
    return { section: 'packages-list', openPackagesCreate: true };
  }

  const hubSource = LEGACY_ALIAS[raw] ?? raw;
  if (isDomainHubRoute(hubSource) || isDomainHubRoute(raw)) {
    const hubKey = isDomainHubRoute(raw) ? raw : hubSource;
    return {
      section: 'domain-manager',
      domainHubTab: domainHubTabForSection(hubKey),
    };
  }

  return { section: resolveSectionId(raw) };
}

export const NEW_SECTION_TO_PARENT: Record<string, string> = {
  dashboard: 'dashboard',
  'cp-users': 'utilizadores',
  clientes: 'utilizadores',
  'utilizadores-revendedores': 'nov-hospedagem',
  'utilizadores-visitantes': 'utilizadores',
  'utilizadores-gestao': 'utilizadores',
  'wp-users': 'nov-wordpress',
  'provision-client': 'nov-hospedagem',
  'provision-reseller': 'nov-hospedagem',
  'provision-admin': 'nov-hospedagem',
  'hospedagem-contas': 'nov-hospedagem',
  'hospedagem-meus': 'nov-hospedagem',
  'hospedagem-mover-revenda': 'nov-hospedagem',
  'hospedagem-templates-mensagem': 'nov-hospedagem',
  'hospedagem-alterar-senhas': 'nov-hospedagem',
  'hospedagem-administradores': 'nov-hospedagem',
  'packages-reseller': 'nov-hospedagem',
  revendedores: 'nov-hospedagem',
  'cp-client-permissions': 'nov-sistema',
  'packages-list': 'nov-hospedagem',
  domains: 'nov-dominios',
  'emails-new': 'nov-email',
  webmail: 'nov-email',
  'setup-smtp': 'nov-email',
  'criar-email': 'nov-email',
  'dns-central': 'nov-dominios',
  'domain-manager': 'nov-dominios',
  'domains-new': 'nov-dominios',
  'domains-list': 'nov-dominios',
  'cp-dns-nameserver': 'nov-dominios',
  'cp-dns-default-ns': 'nov-dominios',
  'cp-dns-create-zone': 'nov-dominios',
  'cp-dns-delete-zone': 'nov-dominios',
  'cp-dns-reset': 'nov-dominios',
  'cp-subdomains': 'nov-dominios',
  'cp-ssl': 'nov-dominios',
  'cp-ssl-view': 'nov-dominios',
  'cp-php': 'nov-dominios',
  'registrar-domains': 'nov-dominios',
  'domains-registados': 'nov-dominios',
  'transferir-dominio': 'nov-dominios',
  renewals: 'nov-notificacoes',
  'cadastrar-renovacao': 'nov-notificacoes',
  'templates-renovacao': 'nov-notificacoes',
  newsletter: 'newsletter',
  'newsletter-subs': 'newsletter',
  'newsletter-comp': 'newsletter',
  'newsletter-camp': 'newsletter',
  'cp-email-delete': 'nov-email',
  'cp-email-forwarding': 'nov-email',
  'cp-email-catchall': 'nov-email',
  'cp-email-pattern-fwd': 'nov-email',
  'cp-email-plus-addr': 'nov-email',
  'cp-email-change-pass': 'nov-email',
  'cp-email-dkim': 'nov-email',
  'cp-email-limits': 'nov-email',
  'cp-email-mgmt': 'nov-email',
  'emails-webmail': 'nov-email',
  mensagens: 'newsletter',
  'mensagens-subs': 'newsletter',
  'mensagens-camp': 'newsletter',
  'wp-sites': 'nov-wordpress',
  'wp-plugins': 'nov-wordpress',
  'wordpress-install': 'nov-wordpress',
  'wp-backup': 'nov-wordpress',
  'wp-backup-auto': 'nov-wordpress',
  'wp-backup-report': 'nov-wordpress',
  'cp-databases': 'nov-wordpress',
  'manage-website': 'nov-wordpress',
  'backup-manager': 'nov-wordpress',
  infrastructure: 'nov-sistema',
  'git-deploy': 'nov-sistema',
  'cp-security': 'nov-sistema',
  'cp-reseller-permissions': 'nov-sistema',
};

export const RESELLER_SECTION_TO_PARENT: Record<string, string> = {
  dashboard: 'dashboard',
  'hospedagem-contas': 'nov-hospedagem',
  'packages-list': 'nov-hospedagem',
  'emails-new': 'nov-email',
  webmail: 'nov-email',
  'setup-smtp': 'nov-email',
  newsletter: 'newsletter',
  'newsletter-subs': 'newsletter',
  'newsletter-comp': 'newsletter',
  'newsletter-camp': 'newsletter',
  'domain-manager': 'nov-dominios',
  'registrar-domains': 'nov-dominios',
  'domains-registados': 'nov-dominios',
  'dns-central': 'nov-dominios',
  'cp-ssl': 'nov-dominios',
  'cp-ssl-view': 'nov-dominios',
  'cp-php': 'nov-dominios',
  'cp-dns-nameserver': 'nov-dominios',
  'transferir-dominio': 'nov-dominios',
  'notificacoes-recebidas': 'nov-notificacoes',
  renewals: 'nov-notificacoes',
  'cadastrar-renovacao': 'nov-notificacoes',
  'templates-renovacao': 'nov-notificacoes',
  'wp-sites': 'nov-wordpress',
  'wp-plugins': 'nov-wordpress',
  'wordpress-install': 'nov-wordpress',
  'wp-backup': 'nov-wordpress',
  'wp-backup-auto': 'nov-wordpress',
  'wp-backup-report': 'nov-wordpress',
  'cp-databases': 'nov-wordpress',
  'manage-website': 'nov-wordpress',
  infrastructure: 'nov-definicoes',
  'git-deploy': 'nov-definicoes',
  'file-manager': 'nov-definicoes',
  'cp-file-manager': 'nov-definicoes',
  'cp-ftp': 'nov-definicoes',
  'settings-branding': 'nov-definicoes',
  'settings-profile': 'nov-definicoes',
};

export function resellerMenuParentForSection(sectionId: string): string | null {
  const resolved = resolveSectionId(sectionId);
  const parent = RESELLER_SECTION_TO_PARENT[resolved];
  if (parent) return parent;
  return null;
}

export const ADMIN_MENU_ITEM_DEFS: PanelMenuItemDef[] = [...NEW_MENU_ITEM_DEFS];
export const RESELLER_ADMIN_MENU_DEFS: PanelMenuItemDef[] = RESELLER_MENU_DEFS;

export function resolveSectionId(sectionId: string): string {
  return LEGACY_ALIAS[sectionId] || sectionId;
}

export function isMenuHeaderSubItem(subId: string): boolean {
  return subId.endsWith('-header');
}

export function adminMenuParentForSection(sectionId: string): string | null {
  const resolved = resolveSectionId(sectionId);
  if (resolved === 'infrastructure' || resolved === 'git-deploy') return 'nov-sistema';
  if (
    [
      'cp-ssl',
      'cp-php',
      'cp-subdomains',
      'cp-list-subdomains',
      'domains-new',
      'domains-list',
      'domain-manager',
      'registrar-domains',
      'domains-registados',
    ].includes(resolved)
  ) {
    return 'nov-dominios';
  }
  if (resolved === 'cp-databases' || resolved === 'manage-website') return 'nov-wordpress';
  if (NEW_SECTION_TO_PARENT[resolved]) return NEW_SECTION_TO_PARENT[resolved];
  return null;
}

export function isPanelMenuItemActive(
  item: PanelMenuItemDef,
  activeSection: string,
  sectionToParent: Record<string, string> = NEW_SECTION_TO_PARENT,
): boolean {
  const resolved = resolveSectionId(activeSection);
  if (resolved === item.id || activeSection === item.id) return true;
  if (item.subItems?.some((s) => resolveSectionId(s.id) === resolved || s.id === activeSection)) {
    return true;
  }
  if (sectionToParent[resolved] === item.id) return true;
  return false;
}
