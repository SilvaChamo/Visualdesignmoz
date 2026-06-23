import {
  ADMIN_MENU_ITEM_DEFS,
  resolveSectionId,
} from '@/lib/panel-admin-menu';

export type PanelSectionMeta = {
  title: string;
  description: string;
};

const SECTION_TITLES: Record<string, string> = {
  'domain-manager': 'Domínios',
  'registrar-domains': 'Registar domínio',
  'domains-registados': 'Domínios registados',
  'wp-users': 'Contas WordPress',
  infrastructure: 'Servidor e API',
  'cp-client-permissions': 'Painel do cliente',
  revendedores: 'Revendedores',
  clientes: 'Acessos ao painel',
  'hospedagem-contas': 'Contas de hospedagem',
  'packages-new': 'Criar pacote',
  'manage-website': 'Gerir website',
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  dashboard: 'Painel de controlo principal',
  'file-manager': 'Gestão de ficheiros',
  'cp-file-manager': 'Gestor de ficheiros',
  'news-manager': 'Gestão de notícias',
  clientes: 'Utilizadores com acesso ao painel cliente',
  revendedores: 'Contas de revenda no painel',
  'cp-client-permissions': 'Módulos visíveis no painel do cliente',
  'wp-users': 'Gerir contas de utilizadores WordPress',
  'cp-subdomains': 'Adicionar subdomínio ou domínio addon',
  'cp-list-subdomains': 'Ver subdomínios e addon domains',
  'cp-databases': 'Crie e gira bases de dados MySQL para os seus websites',
  'cp-ftp': 'Gira contas FTP para transferência de ficheiros',
  'cp-users': 'Utilizadores do painel e do servidor',
  'cp-php': 'Configure a versão PHP e parâmetros por website',
  'cp-security': 'Gira firewall, ModSecurity e IPs bloqueados',
  'cp-ssl': 'Emita certificados SSL Let\'s Encrypt',
  'cp-ssl-view': 'Ver certificado SSL activo',
  'domain-manager': 'Gerir domínios de hospedagem e registo',
  'cp-dns-nameserver': 'Gestão de nameservers personalizados e predefinidos',
  'cp-api': 'Tokens de acesso à API e estado do servidor',
  infrastructure: 'Estado do servidor e token de API',
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
  'setup-smtp': 'Configuração de envio e recepção de e-mail',
  'cp-wp-list': 'Sites WordPress, plugins, instalação e backups',
  'cp-wp-plugins': 'Sites WordPress, plugins, instalação e backups',
  'cp-wp-backup': 'Cópias de segurança WordPress',
  'cp-wp-restore-backup': 'Restaurar site a partir de backup',
  'cp-wp-remote-backup': 'Backup remoto WordPress',
  'wordpress-install': 'Instalar e gerir WordPress no servidor',
  'cp-modify-website': 'Alterar pacote e PHP do website',
  'cp-suspend-website': 'Suspender ou reactivar websites',
  'cp-delete-website': 'Remover website permanentemente',
  'provision-client': 'Criar conta de hospedagem',
  'hospedagem-contas': 'Contas de hospedagem no servidor',
  'website-preview': 'Pré-visualização do website',
  'manage-website': 'Gerir website e serviços associados',
  'email-import': 'Importar contas de e-mail',
  'packages-list': 'Criar e gerir pacotes de hospedagem',
  'cp-reseller': 'ACLs e permissões de revendedores',
  'cp-dns-default-ns': 'Nameservers por defeito para novos sites',
  'cp-dns-create-zone': 'Criar nova zona DNS',
  'cp-dns-delete-zone': 'Apagar zona DNS',
  'domains-dns': 'Registos DNS no servidor',
  'cp-dns-cloudflare': 'Integração DNS externa',
  'cp-dns-reset': 'Repor DNS aos valores por defeito',
  'dns-central': 'Gestão centralizada de zonas DNS',
  'transferir-dominio': 'Transferir um domínio existente para a sua conta',
  'cp-dns-zone-editor': 'Editor de zona DNS no servidor',
  'registrar-domains': 'Pesquisar disponibilidade e registar domínios',
  'domains-registados': 'Domínios associados à conta de registo',
  newsletter: 'Campanhas e envio de email marketing',
  'da-emails': 'Contas POP/IMAP no servidor',
  'backup-manager': 'Gere backups de sites, ficheiros, bases de dados e e-mails',
  'wp-sites': 'Sites WordPress instalados no servidor',
  'wp-plugins': 'Activar, instalar, actualizar e gerir plugins',
  'wp-backup': 'Restaurar e backup remoto WordPress',
  'cp-reseller-permissions': 'Módulos visíveis no painel do revendedor',
  renewals: 'Renovações de domínios e hospedagem',
  'cadastrar-renovacao': 'Registar nova renovação',
  'templates-renovacao': 'Modelos de notificação de renovação',
  'cp-audit-sync': 'Auditoria e sincronização com o servidor',
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
  return null;
}

export function getPanelSectionMeta(section: string): PanelSectionMeta {
  const id = resolveSectionId(section);
  const title =
    SECTION_TITLES[id] ||
    SECTION_TITLES[section] ||
    menuLabelForSection(id) ||
    menuLabelForSection(section) ||
    'Painel';
  const description = SECTION_DESCRIPTIONS[id] || SECTION_DESCRIPTIONS[section] || '';
  return { title, description };
}
