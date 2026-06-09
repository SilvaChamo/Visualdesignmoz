/**
 * Menu do painel revendedor — espelha as secções do DirectAdmin (CpanelDashboard).
 * Fonte única para sidebar e permissões.
 */

export type ResellerMenuIcon =
  | 'home'
  | 'link'
  | 'mail'
  | 'folder'
  | 'globe'
  | 'wordpress'
  | 'archive'
  | 'database'
  | 'server'
  | 'shield'
  | 'code'
  | 'users'
  | 'package'
  | 'chart'
  | 'bell'
  | 'settings';

export type ResellerMenuEntry = {
  id: string;
  label: string;
  icon: ResellerMenuIcon;
  description?: string;
  subItems?: { id: string; label: string }[];
};

/** Alinhado com CpanelDashboard + extras de revenda Visual Design */
export const RESELLER_DA_MENU: ResellerMenuEntry[] = [
  { id: 'dashboard', label: 'Centro DirectAdmin', icon: 'home', description: 'Todas as ferramentas (como no DirectAdmin)' },
  {
    id: 'acesso-directo',
    label: 'Acesso Directo',
    icon: 'link',
    description: 'DirectAdmin nativo, Roundcube e webmail',
  },
  {
    id: 'gestao-emails',
    label: 'E-mails',
    icon: 'mail',
    subItems: [
      { id: 'cp-email-mgmt', label: 'Gerir e-mails' },
      { id: 'webmail', label: 'Webmail (painel)' },
      { id: 'cp-email-delete', label: 'Apagar e-mail' },
      { id: 'cp-email-forwarding', label: 'Encaminhamento' },
      { id: 'cp-email-catchall', label: 'Catch-All' },
      { id: 'cp-email-pattern-fwd', label: 'Pattern Forwarding' },
      { id: 'cp-email-plus-addr', label: 'Plus-Addressing' },
      { id: 'cp-email-change-pass', label: 'Alterar password' },
      { id: 'cp-email-dkim', label: 'DKIM Manager' },
      { id: 'cp-email-limits', label: 'Limites de e-mail' },
      { id: 'setup-smtp', label: 'Configurar SMTP' },
      { id: 'email-diagnostico', label: 'Diagnóstico' },
      { id: 'newsletter', label: 'Email Marketing' },
    ],
  },
  {
    id: 'ficheiros',
    label: 'Ficheiros',
    icon: 'folder',
    subItems: [
      { id: 'file-manager', label: 'Gestor de ficheiros' },
      { id: 'cp-ftp', label: 'Contas FTP' },
      { id: 'infrastructure', label: 'Estado do servidor' },
    ],
  },
  {
    id: 'gestao-dominios',
    label: 'Domínios',
    icon: 'globe',
    subItems: [
      { id: 'porkbun-domains', label: 'Comprar domínio' },
      { id: 'porkbun-my-domains', label: 'Os meus domínios' },
      { id: 'domains-new', label: 'Criar website' },
      { id: 'domains', label: 'Listar websites' },
      { id: 'domain-manager', label: 'Gestor de domínios' },
      { id: 'cp-subdomains', label: 'Criar subdomínio' },
      { id: 'cp-list-subdomains', label: 'Listar sub/addon' },
      { id: 'cp-modify-website', label: 'Modificar website' },
      { id: 'cp-suspend-website', label: 'Suspender / activar' },
      { id: 'website-preview', label: 'Preview' },
      { id: 'cp-delete-website', label: 'Apagar website' },
    ],
  },
  {
    id: 'wordpress',
    label: 'WordPress',
    icon: 'wordpress',
    subItems: [
      { id: 'wordpress-install', label: 'Instalar WordPress' },
      { id: 'cp-wp-list', label: 'Painel WP Admin' },
      { id: 'cp-wp-plugins', label: 'Gerir plugins' },
      { id: 'cp-wp-backup', label: 'Backup WordPress' },
      { id: 'cp-wp-restore-backup', label: 'Restaurar backup' },
      { id: 'cp-wp-remote-backup', label: 'Backup remoto' },
    ],
  },
  {
    id: 'backup',
    label: 'Backup',
    icon: 'archive',
    subItems: [{ id: 'backup-manager', label: 'Gestão de backups' }],
  },
  {
    id: 'databases',
    label: 'Bases de dados',
    icon: 'database',
    subItems: [{ id: 'cp-databases', label: 'Gerir bases de dados' }],
  },
  {
    id: 'dns',
    label: 'DNS',
    icon: 'server',
    subItems: [
      { id: 'domains-dns', label: 'Editar DNS' },
      { id: 'dns-central', label: 'DNS Central' },
      { id: 'cp-dns-nameserver', label: 'Nameservers' },
      { id: 'cp-dns-default-ns', label: 'NS padrão' },
      { id: 'cp-dns-create-zone', label: 'Criar zona DNS' },
      { id: 'cp-dns-delete-zone', label: 'Apagar zona DNS' },
      { id: 'cp-dns-cloudflare', label: 'CloudFlare' },
      { id: 'cp-dns-reset', label: 'Reset DNS' },
    ],
  },
  {
    id: 'seguranca',
    label: 'Segurança',
    icon: 'shield',
    subItems: [
      { id: 'cp-ssl', label: 'SSL / TLS' },
      { id: 'cp-security', label: 'Firewall & ModSecurity' },
      { id: 'cp-api', label: 'Configurações API' },
    ],
  },
  {
    id: 'software',
    label: 'Software / PHP',
    icon: 'code',
    subItems: [{ id: 'cp-php', label: 'Configuração PHP' }],
  },
  {
    id: 'utilizadores',
    label: 'Utilizadores',
    icon: 'users',
    subItems: [
      { id: 'cp-reseller', label: 'Centro de revenda' },
      { id: 'cp-users', label: 'Contas de utilizador' },
    ],
  },
  {
    id: 'pacotes',
    label: 'Pacotes de hosting',
    icon: 'package',
    subItems: [
      { id: 'packages-new', label: 'Criar pacote' },
      { id: 'packages-list', label: 'Listar pacotes' },
    ],
  },
  {
    id: 'metricas',
    label: 'Métricas',
    icon: 'chart',
    subItems: [
      { id: 'reports', label: 'Relatórios' },
      { id: 'analyses', label: 'Análises' },
    ],
  },
  {
    id: 'notificacoes',
    label: 'Notificações',
    icon: 'bell',
    subItems: [
      { id: 'renewals', label: 'Renovações' },
      { id: 'cadastrar-renovacao', label: 'Cadastrar' },
      { id: 'templates-renovacao', label: 'Templates' },
    ],
  },
  {
    id: 'configuracoes',
    label: 'Definições',
    icon: 'settings',
    subItems: [
      { id: 'settings-branding', label: 'Branding & Logo' },
      { id: 'settings-profile', label: 'Meu perfil' },
    ],
  },
];

/** IDs de secção → menu pai (para highlight na sidebar) */
export function resellerMenuParentForSection(sectionId: string): string | null {
  for (const item of RESELLER_DA_MENU) {
    if (item.id === sectionId) return item.id;
    if (item.subItems?.some((s) => s.id === sectionId)) return item.id;
  }
  const aliases: Record<string, string> = {
    'emails-new': 'gestao-emails',
    'emails-webmail': 'gestao-emails',
    'cp-file-manager': 'ficheiros',
    'domains-list': 'gestao-dominios',
    'manage-website': 'gestao-dominios',
    'git-deploy': 'gestao-dominios',
    'deploy': 'gestao-dominios',
    'diagnostico': 'metricas',
    'cp-audit-sync': 'metricas',
  };
  return aliases[sectionId] ?? null;
}
