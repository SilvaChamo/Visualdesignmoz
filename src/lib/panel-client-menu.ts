import type { PanelMenuItemDef } from '@/lib/panel-admin-menu';
import { resolveSectionId } from '@/lib/panel-admin-menu';

/** Menus com subsecções — alinhado ao painel admin */
export const CLIENT_MENU_DEFS: PanelMenuItemDef[] = [
  {
    id: 'nov-dominios',
    label: 'Domínios & DNS',
    subItems: [
      { id: 'domain-manager', label: 'Domínios' },
      { id: 'dns-central', label: 'DNS Central' },
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
];

export const CLIENT_SECTION_TO_PARENT: Record<string, string> = {
  'dns-central': 'nov-dominios',
  'domain-manager': 'nov-dominios',
  'cp-dns-nameserver': 'nov-dominios',
  'transferir-dominio': 'nov-dominios',
  'registrar-domains': 'nov-dominios',
  'domains-registados': 'nov-dominios',
  'domains-dns': 'nov-dominios',
  'wp-sites': 'nov-wordpress',
  'wordpress-install': 'nov-wordpress',
  'wp-plugins': 'nov-wordpress',
  'wp-backup': 'nov-wordpress',
  'cp-wp-list': 'nov-wordpress',
  'cp-wp-plugins': 'nov-wordpress',
};

export function clientMenuParentForSection(sectionId: string): string | null {
  const resolved = resolveSectionId(sectionId);
  return CLIENT_SECTION_TO_PARENT[sectionId] || CLIENT_SECTION_TO_PARENT[resolved] || null;
}

export function isClientMenuItemActive(item: PanelMenuItemDef, activeSection: string): boolean {
  const resolved = resolveSectionId(activeSection);
  if (resolved === item.id || activeSection === item.id) return true;
  return Boolean(
    item.subItems?.some(
      (s) => resolveSectionId(s.id) === resolved || s.id === activeSection,
    ),
  );
}

export const CLIENT_SECTION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  domains: 'O Meu Site',
  'nov-dominios': 'Domínios & DNS',
  'nov-wordpress': 'WordPress',
  'dns-central': 'DNS Central',
  'domain-manager': 'Domínios',
  'cp-dns-nameserver': 'Nameservers',
  'registrar-domains': 'Registar domínio',
  'transferir-dominio': 'Transferir domínio',
  'domains-registados': 'Domínios registados',
  'wp-sites': 'Sites WordPress',
  'wordpress-install': 'Criar Website',
  'wp-plugins': 'Plugins',
  'wp-backup': 'Backups',
  webmail: 'Webmail',
  mailmarketing: 'Mailmarketing',
  tickets: 'Suporte',
  faturas: 'Faturas',
  conta: 'Conta',
  'emails-new': 'E-mail',
};

export function clientSectionLabel(sectionId: string): string {
  const resolved = resolveSectionId(sectionId);
  return CLIENT_SECTION_LABELS[sectionId] || CLIENT_SECTION_LABELS[resolved] || 'Painel de Gestão';
}
