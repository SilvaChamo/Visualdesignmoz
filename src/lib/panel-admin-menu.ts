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
    ],
  },
  {
    id: 'nov-dominios',
    label: 'Domínios & DNS',
    isNewMenu: true,
    subItems: [
      { id: 'dns-central', label: 'DNS Central' },
      { id: 'porkbun-domains', label: 'Registar domínio' },
      { id: 'porkbun-my-domains', label: 'Os meus domínios' },
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
  { id: 'newsletter', label: 'Mailmarketing', isNewMenu: true },
  {
    id: 'nov-wordpress',
    label: 'WordPress',
    isNewMenu: true,
    subItems: [
      { id: 'domains', label: 'Sites' },
      { id: 'wp-plugins', label: 'Plugins' },
      { id: 'wordpress-install', label: 'Instalar WP' },
      { id: 'wp-backup', label: 'Backups' },
    ],
  },
  {
    id: 'nov-sistema',
    label: 'Sistema',
    isNewMenu: true,
    subItems: [
      { id: 'infrastructure', label: 'Estado do servidor' },
      { id: 'backup-manager', label: 'Backups' },
      { id: 'git-deploy', label: 'Deploy / GitHub' },
    ],
  },
];

/** Secções do menu legado */
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
  { id: 'cp-security', label: 'Segurança' },
  { id: 'cp-php', label: 'Configuração PHP' },
  { id: 'backup-manager-legacy', label: 'Backups' },
  { id: 'infrastructure-legacy', label: 'Estado do Servidor' },
  { id: 'cp-reseller-legacy', label: 'Centro de Revenda' },
  { id: 'gestao-dominios-header', label: '— Gestão de Domínios —' },
  { id: 'porkbun-domains-legacy', label: 'Registar domínio' },
  { id: 'porkbun-my-domains-legacy', label: 'Domínios Spaceship' },
  { id: 'dns-central-legacy', label: 'DNS Central' },
  { id: 'domain-manager', label: 'Gestor de domínios' },
  { id: 'cp-subdomains', label: 'Criar Subdomínio' },
  { id: 'cp-list-subdomains', label: 'Listar Sub/Addon' },
  { id: 'cp-modify-website', label: 'Modificar Website' },
  { id: 'cp-suspend-website', label: 'Suspender' },
  { id: 'cp-delete-website', label: 'Apagar Website' },
  { id: 'domains-dns', label: 'Configurar DNS (servidor)' },
  { id: 'cp-dns-nameserver', label: 'Gerir Nameservers' },
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
  'packages-list-legacy': 'packages-list',
  'backup-manager-legacy': 'backup-manager',
  'infrastructure-legacy': 'infrastructure',
  'cp-reseller-legacy': 'cp-reseller',
  'porkbun-domains-legacy': 'porkbun-domains',
  'porkbun-my-domains-legacy': 'porkbun-my-domains',
  'dns-central-legacy': 'dns-central',
  'emails-new-legacy': 'emails-new',
  'webmail-legacy': 'webmail',
  'newsletter-legacy': 'newsletter',
  'renewals-legacy': 'renewals',
  'cadastrar-renovacao-legacy': 'cadastrar-renovacao',
  'templates-renovacao-legacy': 'templates-renovacao',
  'git-deploy-legacy': 'git-deploy',
  'wp-update': 'wp-plugins',
  'cp-wp-list': 'wp-sites',
  'cp-wp-plugins': 'wp-plugins',
  'cp-wp-backup': 'wp-backup',
  'cp-wp-restore-backup': 'wp-backup',
  'cp-wp-remote-backup': 'wp-backup',
};

export const LEGACY_ONLY_IDS = new Set(
  LEGACY_SUB_ITEM_DEFS
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
  'emails-new': 'nov-email',
  webmail: 'nov-email',
  'dns-central': 'nov-dominios',
  'porkbun-domains': 'nov-dominios',
  'porkbun-my-domains': 'nov-dominios',
  renewals: 'nov-notificacoes',
  'cadastrar-renovacao': 'nov-notificacoes',
  'templates-renovacao': 'nov-notificacoes',
  newsletter: 'newsletter',
  'wp-sites': 'nov-wordpress',
  'wp-plugins': 'nov-wordpress',
  'wordpress-install': 'nov-wordpress',
  'wp-backup': 'nov-wordpress',
  infrastructure: 'nov-sistema',
  'backup-manager': 'nov-sistema',
  'git-deploy': 'nov-sistema',
};

export const ADMIN_MENU_ITEM_DEFS: PanelMenuItemDef[] = [
  ...NEW_MENU_ITEM_DEFS,
  {
    id: 'menu-anterior',
    label: 'Menu Anterior',
    subItems: LEGACY_SUB_ITEM_DEFS,
  },
];

/** Menu admin/revendedor sem o dashboard (revendedor mantém dashboard próprio) */
export const RESELLER_ADMIN_MENU_DEFS: PanelMenuItemDef[] = ADMIN_MENU_ITEM_DEFS.filter(
  (item) => item.id !== 'dashboard',
);

export function resolveSectionId(sectionId: string): string {
  return LEGACY_ALIAS[sectionId] || sectionId;
}

export function isMenuHeaderSubItem(subId: string): boolean {
  return subId.endsWith('-header');
}

export function adminMenuParentForSection(sectionId: string): string | null {
  const resolved = resolveSectionId(sectionId);
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
      'domains-dns',
      'cp-dns-nameserver',
      'domain-manager',
      'cp-databases',
      'cp-ftp',
      'cp-ssl',
      'cp-security',
      'cp-php',
      'cp-client-permissions',
      'cp-reseller-permissions',
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
    return activeSection.endsWith('-legacy') || LEGACY_ONLY_IDS.has(activeSection);
  }
  return false;
}
