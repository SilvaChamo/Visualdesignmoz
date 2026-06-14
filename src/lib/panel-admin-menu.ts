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

/** Menu novo simplificado (partilhado admin + revendedor) */
export const NEW_MENU_ITEM_DEFS: PanelMenuItemDef[] = [
  { id: 'dashboard', label: 'Dashboard', isNewMenu: true },
  {
    id: 'utilizadores',
    label: 'Utilizadores',
    isNewMenu: true,
    subItems: [
      { id: 'cp-users', label: 'Usuários' },
      { id: 'revendedores', label: 'Revendedores' },
      { id: 'clientes', label: 'Clientes' },
    ],
  },
  {
    id: 'nov-hospedagem',
    label: 'Hospedagem',
    isNewMenu: true,
    subItems: [
      { id: 'provision-client', label: 'Criar conta completa' },
      { id: 'packages-list', label: 'Pacotes' },
    ],
  },
  {
    id: 'nov-email',
    label: 'E-mail',
    isNewMenu: true,
    subItems: [
      { id: 'emails-new', label: 'Contas de e-mail' },
      { id: 'webmail', label: 'Webmail' },
      { id: 'newsletter', label: 'Mailmarketing' },
    ],
  },
  {
    id: 'nov-dominios',
    label: 'Domínios & DNS',
    isNewMenu: true,
    subItems: [
      { id: 'domain-manager', label: 'Meus domínios' },
      { id: 'domains-new', label: 'Criar domínio' },
      { id: 'dns-central', label: 'DNS Central' },
      { id: 'cp-ssl', label: 'SSL / TLS' },
      { id: 'cp-php', label: 'Configurar PHP' },
      { id: 'cp-dns-nameserver', label: 'Nameservers' },
      { id: 'porkbun-domains', label: 'Registar domínio' },
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
      { id: 'infrastructure', label: 'Estado do servidor' },
      { id: 'git-deploy', label: 'Deploy / GitHub' },
    ],
  },
];

/** Itens do menu legado revendedor (referência do painel cliente original) */
export const RESELLER_LEGACY_MENU_SUBITEMS: PanelMenuSubItem[] = [
  { id: 'gestao-sites-header', label: '— Gestão de Sites —' },
  { id: 'domains-legacy', label: 'Listar Websites' },
  { id: 'packages-list-legacy', label: 'Pacotes' },
  { id: 'cp-users-legacy', label: 'Contas' },
  { id: 'gestao-dominios-header', label: '— Gestão de Domínios —' },
  { id: 'domains-list-legacy', label: 'Listar Domínios' },
  { id: 'domains-new-legacy', label: 'Criar Domínio' },
  { id: 'cp-subdomains', label: 'Criar Subdomínio' },
  { id: 'cp-suspend-website', label: 'Suspender' },
  { id: 'gestao-wp-header', label: '— WordPress —' },
  { id: 'cp-wp-list', label: 'Listar sites WordPress' },
  { id: 'wordpress-install-legacy', label: 'Instalar WordPress' },
  { id: 'cp-wp-plugins', label: 'Gerir plugins' },
  { id: 'gestao-builders-header', label: '— Construtores —' },
  { id: 'page-builders', label: 'Abrir Construtores' },
  { id: 'templates-saved', label: 'Templates Guardados' },
  { id: 'gestao-emails-header', label: '— Gestão de E-mails —' },
  { id: 'emails-new-legacy', label: 'Listar E-mails' },
  { id: 'criar-email-legacy', label: 'Criar E-mail' },
  { id: 'webmail-legacy', label: 'Webmail' },
  { id: 'cp-email-dkim', label: 'DKIM Manager' },
  { id: 'gestao-outros-header', label: '— Outros —' },
  { id: 'cp-databases', label: 'Bases de Dados' },
  { id: 'cp-ftp', label: 'Contas FTP' },
  { id: 'cp-ssl', label: 'SSL / TLS' },
  { id: 'cp-php', label: 'Configuração PHP' },
  { id: 'backup-manager-legacy', label: 'Backups' },
];

/** Menu principal revendedor (bloco superior) */
export const RESELLER_MAIN_MENU_DEFS: PanelMenuItemDef[] = [
  {
    id: 'nov-hospedagem',
    label: 'Hospedagem',
    subItems: [{ id: 'packages-list', label: 'Pacotes' }],
  },
  {
    id: 'nov-email',
    label: 'E-mail',
    subItems: [
      { id: 'emails-new', label: 'Contas de e-mail' },
      { id: 'webmail', label: 'Webmail' },
      { id: 'newsletter', label: 'Mailmarketing' },
    ],
  },
  {
    id: 'nov-dominios',
    label: 'Domínios & DNS',
    subItems: [
      { id: 'dns-central', label: 'DNS Central' },
      { id: 'domain-manager', label: 'Gestor de domínios' },
      { id: 'cp-dns-nameserver', label: 'Nameservers' },
      { id: 'porkbun-domains', label: 'Registar domínio' },
      { id: 'transferir-dominio', label: 'Transferir domínio' },
      { id: 'porkbun-my-domains', label: 'Os meus domínios' },
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
      { id: 'infrastructure', label: 'Estado do servidor' },
      { id: 'settings-branding', label: 'Branding & Logo' },
      { id: 'settings-profile', label: 'Meu Perfil' },
    ],
  },
];

/** Menu legado revendedor — secções pai/filho (bloco inferior) */
export const RESELLER_LEGACY_MENU_DEFS: PanelMenuItemDef[] = [
  {
    id: 'leg-gestao-sites',
    label: 'Gestão de Sites',
    subItems: [
      { id: 'domains-legacy', label: 'Listar Websites' },
      { id: 'packages-list-legacy', label: 'Pacotes' },
      { id: 'cp-users-legacy', label: 'Contas' },
    ],
  },
  {
    id: 'leg-gestao-dominios',
    label: 'Gestão de Domínios',
    subItems: [
      { id: 'domains-list-legacy', label: 'Listar Domínios' },
      { id: 'domains-new-legacy', label: 'Criar Domínio' },
      { id: 'cp-subdomains', label: 'Criar Subdomínio' },
      { id: 'cp-suspend-website', label: 'Suspender' },
    ],
  },
  {
    id: 'leg-wordpress',
    label: 'WordPress',
    subItems: [
      { id: 'cp-wp-list', label: 'Listar sites WordPress' },
      { id: 'wordpress-install-legacy', label: 'Instalar WordPress' },
      { id: 'cp-wp-plugins', label: 'Gerir plugins' },
    ],
  },
  {
    id: 'leg-construtores',
    label: 'Construtores',
    subItems: [
      { id: 'page-builders', label: 'Abrir Construtores' },
      { id: 'templates-saved', label: 'Templates Guardados' },
    ],
  },
  {
    id: 'leg-gestao-emails',
    label: 'Gestão de E-mails',
    subItems: [
      { id: 'emails-new-legacy', label: 'Listar E-mails' },
      { id: 'criar-email-legacy', label: 'Criar E-mail' },
      { id: 'webmail-legacy', label: 'Webmail' },
      { id: 'cp-email-dkim', label: 'DKIM Manager' },
    ],
  },
  {
    id: 'leg-outros',
    label: 'Outros',
    subItems: [
      { id: 'cp-databases', label: 'Bases de Dados' },
      { id: 'cp-ftp', label: 'Contas FTP' },
      { id: 'cp-ssl', label: 'SSL / TLS' },
      { id: 'cp-php', label: 'Configuração PHP' },
      { id: 'backup-manager-legacy', label: 'Backups' },
    ],
  },
];

/** Menu revendedor completo (privilégios + referência) */
export const RESELLER_MENU_DEFS: PanelMenuItemDef[] = [
  ...RESELLER_MAIN_MENU_DEFS,
  ...RESELLER_LEGACY_MENU_DEFS,
];

/** Secções do menu legado admin */
export const LEGACY_SUB_ITEM_DEFS: PanelMenuSubItem[] = [
  { id: 'gestao-paineis-header', label: '— Gestão de Painéis —' },
  { id: 'cp-client-permissions', label: 'Painel do Cliente' },
  { id: 'cp-reseller-permissions', label: 'Painel do Revendedor' },
  { id: 'gestao-sites-header', label: '— Hospedagem —' },
  { id: 'domains-legacy', label: 'Listar Websites' },
  { id: 'packages-list-legacy', label: 'Pacotes' },
  { id: 'cp-databases', label: 'Bases de Dados' },
  { id: 'cp-ftp', label: 'Contas FTP' },
  { id: 'cp-ssl', label: 'SSL / TLS' },
  { id: 'cp-php', label: 'Configuração PHP' },
  { id: 'backup-manager-legacy', label: 'Backups' },
  { id: 'infrastructure-legacy', label: 'Estado do Servidor' },
  { id: 'cp-reseller-legacy', label: 'Centro de Revenda' },
  { id: 'porkbun-domains-legacy', label: 'Registar domínio' },
  { id: 'porkbun-my-domains-legacy', label: 'Domínios Spaceship' },
  { id: 'cp-subdomains', label: 'Criar Subdomínio' },
  { id: 'cp-list-subdomains', label: 'Listar Sub/Addon' },
  { id: 'cp-modify-website', label: 'Modificar Website' },
  { id: 'cp-suspend-website', label: 'Suspender' },
  { id: 'cp-delete-website', label: 'Apagar Website' },
  { id: 'gestao-emails-header', label: '— Gestão de E-mails —' },
  { id: 'emails-new-legacy', label: 'E-mails' },
  { id: 'setup-smtp', label: 'Envio e Recepção' },
  { id: 'webmail-legacy', label: 'Webmail' },
  { id: 'cp-email-dkim', label: 'DKIM Manager' },
  { id: 'gestao-outros-header', label: '— Outros —' },
  { id: 'newsletter-legacy', label: 'Mailmarketing' },
  { id: 'renewals-legacy', label: 'Notificações — Visão Geral' },
  { id: 'cadastrar-renovacao-legacy', label: 'Notificações — Cadastrar' },
  { id: 'templates-renovacao-legacy', label: 'Notificações — Templates' },
  { id: 'git-deploy-legacy', label: 'Deploy / GitHub' },
];

export const LEGACY_ALIAS: Record<string, string> = {
  'domains-legacy': 'domains',
  'domains-list-legacy': 'domains-list',
  'domains-new-legacy': 'domains-new',
  'packages-list-legacy': 'packages-list',
  'backup-manager-legacy': 'backup-manager',
  'infrastructure-legacy': 'infrastructure',
  'cp-reseller-legacy': 'cp-reseller',
  'cp-users-legacy': 'cp-users',
  'porkbun-domains-legacy': 'porkbun-domains',
  'porkbun-my-domains-legacy': 'porkbun-my-domains',
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
};

export const LEGACY_ONLY_IDS = new Set(
  LEGACY_SUB_ITEM_DEFS
    .filter((s) => !s.id.endsWith('-header'))
    .map((s) => (LEGACY_ALIAS[s.id] ? null : s.id))
    .filter(Boolean) as string[],
);

export const RESELLER_LEGACY_ONLY_IDS = new Set(
  RESELLER_LEGACY_MENU_SUBITEMS
    .filter((s) => !s.id.endsWith('-header'))
    .map((s) => (LEGACY_ALIAS[s.id] ? null : s.id))
    .filter(Boolean) as string[],
);

export const NEW_SECTION_TO_PARENT: Record<string, string> = {
  dashboard: 'dashboard',
  'cp-users': 'utilizadores',
  revendedores: 'utilizadores',
  clientes: 'utilizadores',
  'provision-client': 'nov-hospedagem',
  'packages-list': 'nov-hospedagem',
  domains: 'nov-wordpress',
  'domains-list': 'menu-anterior',
  'domains-new': 'menu-anterior',
  'emails-new': 'nov-email',
  webmail: 'nov-email',
  'criar-email': 'menu-anterior',
  'dns-central': 'nov-dominios',
  'domain-manager': 'nov-dominios',
  'domains-new': 'nov-dominios',
  'domains-list': 'nov-dominios',
  'cp-dns-nameserver': 'nov-dominios',
  'cp-subdomains': 'nov-dominios',
  'cp-ssl': 'nov-dominios',
  'cp-php': 'nov-dominios',
  'porkbun-domains': 'nov-dominios',
  'transferir-dominio': 'nov-dominios',
  'notificacoes-recebidas': 'nov-notificacoes',
  renewals: 'nov-notificacoes',
  'cadastrar-renovacao': 'nov-notificacoes',
  'templates-renovacao': 'nov-notificacoes',
  newsletter: 'nov-email',
  'wp-sites': 'nov-wordpress',
  'wp-plugins': 'nov-wordpress',
  'wordpress-install': 'nov-wordpress',
  'wp-backup': 'nov-wordpress',
  'cp-databases': 'nov-wordpress',
  'backup-manager': 'menu-anterior',
  infrastructure: 'nov-definicoes',
  'settings-branding': 'nov-definicoes',
  'settings-profile': 'nov-definicoes',
  'git-deploy': 'nov-sistema',
};

/** Parent menu no painel revendedor */
export function resellerMenuParentForSection(sectionId: string): string | null {
  const legacyParent = resellerLegacySectionParent(sectionId);
  if (legacyParent) return legacyParent;
  const resolved = resolveSectionId(sectionId);
  const mainParent = NEW_SECTION_TO_PARENT[resolved];
  if (mainParent && mainParent !== 'menu-anterior') return mainParent;
  return null;
}

export const ADMIN_MENU_ITEM_DEFS: PanelMenuItemDef[] = [
  ...NEW_MENU_ITEM_DEFS,
  {
    id: 'menu-anterior',
    label: 'Menu Anterior',
    subItems: LEGACY_SUB_ITEM_DEFS,
  },
];

/** Menu revendedor (sem dashboard — sidebar trata dashboard à parte) */
export const RESELLER_ADMIN_MENU_DEFS: PanelMenuItemDef[] = RESELLER_MENU_DEFS;

export function resolveSectionId(sectionId: string): string {
  return LEGACY_ALIAS[sectionId] || sectionId;
}

function resellerLegacySectionParent(sectionId: string): string | null {
  for (const parent of RESELLER_LEGACY_MENU_DEFS) {
    for (const sub of parent.subItems || []) {
      if (sub.id.endsWith('-header')) continue;
      if (sub.id === sectionId || resolveSectionId(sub.id) === sectionId) {
        return parent.id;
      }
    }
  }
  const resolved = resolveSectionId(sectionId);
  for (const parent of RESELLER_LEGACY_MENU_DEFS) {
    for (const sub of parent.subItems || []) {
      if (sub.id.endsWith('-header')) continue;
      if (resolveSectionId(sub.id) === resolved) return parent.id;
    }
  }
  return null;
}

export function isMenuHeaderSubItem(subId: string): boolean {
  return subId.endsWith('-header');
}

export function adminMenuParentForSection(sectionId: string): string | null {
  const resolved = resolveSectionId(sectionId);
  if (resolved === 'infrastructure' || resolved === 'git-deploy') return 'nov-sistema';
  if (['cp-ssl', 'cp-php', 'cp-subdomains', 'cp-list-subdomains', 'domains-new', 'domains-list'].includes(resolved)) {
    return 'nov-dominios';
  }
  if (resolved === 'cp-databases') return 'nov-wordpress';
  if (NEW_SECTION_TO_PARENT[resolved]) return NEW_SECTION_TO_PARENT[resolved];
  if (sectionId.endsWith('-legacy') || LEGACY_ONLY_IDS.has(sectionId)) return 'menu-anterior';
  if (sectionId.startsWith('cp-email')) return 'menu-anterior';
  if (['setup-smtp', 'cp-email-dkim'].includes(sectionId)) return 'menu-anterior';
  if (
    [
      'cp-subdomains',
      'cp-list-subdomains',
      'cp-modify-website',
      'cp-suspend-website',
      'cp-delete-website',
      'dns-central',
      'cp-databases',
      'cp-ftp',
      'cp-ssl',
      'cp-php',
      'cp-wp-list',
      'cp-wp-plugins',
      'page-builders',
      'templates-saved',
      'settings-branding',
      'settings-profile',
    ].includes(sectionId)
  ) {
    return 'menu-anterior';
  }
  return null;
}

export function isPanelMenuItemActive(
  item: PanelMenuItemDef,
  activeSection: string,
): boolean {
  const resolved = resolveSectionId(activeSection);
  if (resolved === item.id || activeSection === item.id) return true;
  if (item.subItems?.some((s) => resolveSectionId(s.id) === resolved || s.id === activeSection)) {
    return true;
  }
  if (item.id === 'menu-anterior') {
    return (
      activeSection.endsWith('-legacy') ||
      LEGACY_ONLY_IDS.has(activeSection) ||
      RESELLER_LEGACY_ONLY_IDS.has(activeSection) ||
      RESELLER_LEGACY_ONLY_IDS.has(resolveSectionId(activeSection))
    );
  }
  return false;
}
