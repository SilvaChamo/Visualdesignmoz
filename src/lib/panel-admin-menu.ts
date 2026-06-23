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
      { id: 'clientes', label: 'Acessos ao painel' },
    ],
  },
  {
    id: 'nov-hospedagem',
    label: 'Hospedagem',
    isNewMenu: true,
    subItems: [
      { id: 'hospedagem-contas', label: 'Contas de hospedagem' },
      { id: 'revendedores', label: 'Revendedores' },
      { id: 'packages-list', label: 'Pacotes' },
      { id: 'cp-client-permissions', label: 'Painel do cliente' },
    ],
  },
  {
    id: 'nov-email',
    label: 'E-mail',
    isNewMenu: true,
    subItems: [
      { id: 'emails-new', label: 'Contas de e-mail' },
      { id: 'webmail', label: 'Webmail' },
      { id: 'newsletter-subs', label: 'Gerir Contactos' },
      { id: 'newsletter-comp', label: 'Criar Campanha' },
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
      { id: 'transferir-dominio', label: 'Transferir domínio' },
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
      { id: 'cp-reseller-permissions', label: 'Painel do Revendedor' },
    ],
  },
];

/** Menu principal revendedor */
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
      { id: 'newsletter-comp', label: 'Criar Campanha' },
      { id: 'newsletter-camp', label: 'Histórico' },
    ],
  },
  {
    id: 'nov-dominios',
    label: 'Domínios & DNS',
    subItems: [
      { id: 'domain-manager', label: 'Domínios' },
      { id: 'dns-central', label: 'DNS Central' },
      { id: 'cp-ssl', label: 'SSL / TLS' },
      { id: 'cp-php', label: 'Configurar PHP' },
      { id: 'cp-dns-nameserver', label: 'Nameservers' },
      { id: 'transferir-dominio', label: 'Transferir domínio' },
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
  'wp-users': 'nov-wordpress',
  'provision-client': 'nov-hospedagem',
  'hospedagem-contas': 'nov-hospedagem',
  revendedores: 'nov-hospedagem',
  'cp-client-permissions': 'nov-hospedagem',
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
  newsletter: 'nov-email',
  'newsletter-subs': 'nov-email',
  'newsletter-comp': 'nov-email',
  'newsletter-camp': 'nov-email',
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
  'cp-reseller-permissions': 'nov-sistema',
};

export const RESELLER_SECTION_TO_PARENT: Record<string, string> = {
  dashboard: 'dashboard',
  'hospedagem-contas': 'nov-hospedagem',
  'packages-list': 'nov-hospedagem',
  'emails-new': 'nov-email',
  webmail: 'nov-email',
  newsletter: 'nov-email',
  'setup-smtp': 'nov-email',
  'domain-manager': 'nov-dominios',
  'dns-central': 'nov-dominios',
  'cp-ssl': 'nov-dominios',
  'cp-ssl-view': 'nov-dominios',
  'cp-php': 'nov-dominios',
  'cp-dns-nameserver': 'nov-dominios',
  'transferir-dominio': 'nov-dominios',
  'registrar-domains': 'nov-dominios',
  'domains-registados': 'nov-dominios',
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
  'manage-website': 'wp-sites',
  infrastructure: 'nov-definicoes',
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
