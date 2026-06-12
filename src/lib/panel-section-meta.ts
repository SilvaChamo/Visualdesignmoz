import {
  ADMIN_MENU_ITEM_DEFS,
  LEGACY_SUB_ITEM_DEFS,
  resolveSectionId,
} from '@/lib/panel-admin-menu';

export type PanelSectionMeta = {
  title: string;
  description: string;
};

/** Descrições por secção (título vem do menu quando existir). */
const SECTION_DESCRIPTIONS: Record<string, string> = {
  dashboard: 'Painel de controlo principal',
  domains: 'Gestão de websites e domínios',
  'domains-list': 'Listar todos os websites',
  'domains-new': 'Criar novo website',
  'file-manager': 'Gestão de ficheiros',
  'cp-file-manager': 'Gestor de ficheiros DirectAdmin',
  'infra-manager': 'Gestão de infraestrutura',
  'news-manager': 'Gestão de notícias',
  clientes: 'Clientes com acesso ao painel cliente',
  revendedores: 'Contas de revenda no painel',
  'cp-subdomains': 'Criar e gerir subdomínios',
  'cp-list-subdomains': 'Ver subdomínios e addon domains',
  'cp-databases': 'Crie e gira bases de dados MySQL para os seus websites',
  'cp-ftp': 'Gira contas FTP para transferência de ficheiros',
  'cp-users': 'Utilizadores do painel e do servidor',
  'cp-php': 'Configure a versão PHP e parâmetros por website',
  'cp-security': 'Gira firewall, ModSecurity e IPs bloqueados',
  'cp-ssl': 'Emita certificados SSL Let\'s Encrypt',
  'cp-api': 'Tokens de acesso à API e estado do servidor',
  'git-deploy': 'Deploy automático via GitHub',
  'emails-new': 'Cria, elimina e configura contas de e-mail corporativo',
  'cp-email-mgmt': 'Cria, elimina e configura contas de e-mail corporativo',
  webmail: 'Acesso ao webmail',
  'cp-email-delete': 'Apagar contas de e-mail',
  'cp-email-forwarding': 'Regras de encaminhamento de e-mail',
  'cp-email-catchall': 'Endereço catch-all para e-mails não encontrados',
  'cp-email-pattern-fwd': 'Encaminhar e-mails por padrão',
  'cp-email-plus-addr': 'Plus-addressing (user+tag@domínio)',
  'cp-email-change-pass': 'Alterar password de contas de e-mail',
  'cp-email-dkim': 'Gestão de DKIM por domínio',
  'cp-email-limits': 'Limites de envio por conta',
  'setup-smtp': 'Brevo + DirectAdmin — envio e recepção',
  'cp-wp-list': 'Sites WordPress, plugins, instalação e backups',
  'cp-wp-plugins': 'Sites WordPress, plugins, instalação e backups',
  'cp-wp-backup': 'Cópias de segurança WordPress',
  'cp-wp-restore-backup': 'Restaurar site a partir de backup',
  'cp-wp-remote-backup': 'Backup remoto WordPress',
  'wordpress-install': 'Instalar e gerir WordPress no servidor',
  'cp-modify-website': 'Alterar pacote e PHP do website',
  'cp-suspend-website': 'Suspender ou reactivar websites',
  'cp-delete-website': 'Remover website permanentemente',
  'domain-manager': 'Gestor de domínios e serviços associados',
  'provision-client': 'Utilizador + pacote + domínio num só formulário',
  'website-preview': 'Pré-visualização do website',
  'manage-website': 'Gerir website e serviços associados',
  'email-import': 'Importar contas de e-mail',
  'packages-list': 'Criar e gerir pacotes de hospedagem',
  'packages-new': 'Criar novo pacote',
  'cp-reseller': 'ACLs e permissões de revendedores',
  'cp-dns-nameserver': 'Criar child nameservers',
  'cp-dns-default-ns': 'Nameservers por defeito para novos sites',
  'cp-dns-create-zone': 'Criar nova zona DNS',
  'cp-dns-delete-zone': 'Apagar zona DNS',
  'domains-dns': 'Registos DNS no servidor',
  'cp-dns-cloudflare': 'Integração CloudFlare',
  'cp-dns-reset': 'Repor DNS aos valores por defeito',
  'dns-central': 'Gestão centralizada de zonas DNS — seleccione um domínio para ver os registos',
  'cp-dns-zone-editor': 'Editor de zona DNS no servidor',
  'porkbun-domains':
    'Pesquise disponibilidade e registe domínios com preço em tempo real (conta de registo ligada ao servidor)',
  'porkbun-my-domains':
    'Domínios associados à conta de registo ligada ao painel Visual Design',
  newsletter: 'Campanhas e envio de email marketing',
  'da-emails': 'Contas POP/IMAP no DirectAdmin',
  'backup-manager': 'Gere backups de sites, ficheiros, bases de dados e e-mails',
  infrastructure: 'Estado e configuração do servidor',
  'wp-update': 'Sites WordPress, plugins, instalação e backups',
  'cp-client-permissions': 'Módulos visíveis no painel do cliente',
  'cp-reseller-permissions': 'Módulos visíveis no painel do revendedor',
  renewals: 'Renovações de domínios e hospedagem',
  'cadastrar-renovacao': 'Registar nova renovação',
  'templates-renovacao': 'Modelos de notificação de renovação',
  'cp-audit-sync': 'Auditoria e sincronização com o servidor',
  'email-diagnostico': 'Diagnóstico de envio e recepção de e-mail',
};

function menuLabelForSection(sectionId: string): string | null {
  for (const item of ADMIN_MENU_ITEM_DEFS) {
    if (item.id === sectionId) return item.label;
    for (const sub of item.subItems ?? []) {
      if (sub.id === sectionId || resolveSectionId(sub.id) === sectionId) {
        return sub.label;
      }
    }
  }
  for (const sub of LEGACY_SUB_ITEM_DEFS) {
    if (sub.id === sectionId || resolveSectionId(sub.id) === sectionId) {
      return sub.label;
    }
  }
  return null;
}

export function getPanelSectionMeta(section: string): PanelSectionMeta {
  const id = resolveSectionId(section);
  const title = menuLabelForSection(id) || menuLabelForSection(section) || 'Painel';
  const description = SECTION_DESCRIPTIONS[id] || SECTION_DESCRIPTIONS[section] || '';
  return { title, description };
}
