import {
  NEW_MENU_ITEM_DEFS,
  PANEL_EXTERNAL_PATHS,
  NEW_SECTION_TO_PARENT,
  adminMenuParentForSection,
  resolveSectionId,
} from './panel-admin-menu';

export type DashboardMenuToolDef = {
  id: string;
  name: string;
  panelPath?: string;
  highlight?: boolean;
};

export type DashboardMenuSectionDef = {
  id: string;
  name: string;
  menuItemId: string;
  tools: DashboardMenuToolDef[];
};

/** Secção E-mail no dashboard mantém cards próprios — não espelha o submenu lateral. */
export const DASHBOARD_EMAIL_MENU_ID = 'nov-email';

export const DASHBOARD_EMAIL_SECTION_ID = 'email';

export const DASHBOARD_TOOL_PANEL_PATHS = PANEL_EXTERNAL_PATHS;

export const DASHBOARD_MENU_SECTION_STYLES: Record<string, { color: string; bgColor: string; toolAccent: string }> = {
  utilizadores: { color: 'text-green-700', bgColor: 'bg-green-50', toolAccent: 'text-green-500' },
  'nov-hospedagem': { color: 'text-teal-700', bgColor: 'bg-teal-50', toolAccent: 'text-teal-500' },
  'nov-dominios': { color: 'text-blue-700', bgColor: 'bg-blue-50', toolAccent: 'text-blue-500' },
  'nov-notificacoes': { color: 'text-amber-700', bgColor: 'bg-amber-50', toolAccent: 'text-amber-600' },
  'nov-wordpress': { color: 'text-indigo-700', bgColor: 'bg-indigo-50', toolAccent: 'text-indigo-500' },
  'nov-sistema': { color: 'text-slate-700', bgColor: 'bg-slate-50', toolAccent: 'text-slate-500' },
};

/** Ordem das secções no dashboard (inclui secção E-mails dedicada). */
export const DASHBOARD_SECTION_ORDER: string[] = [
  'menu-nov-hospedagem',
  DASHBOARD_EMAIL_SECTION_ID,
  'menu-nov-dominios',
  'menu-utilizadores',
  'menu-nov-notificacoes',
  'menu-nov-wordpress',
  'menu-nov-sistema',
];

/**
 * Cards que estavam no slide — aparecem na secção do dashboard correspondente (não na sidebar).
 */
export const DASHBOARD_EXTRA_TOOLS_BY_MENU: Record<string, DashboardMenuToolDef[]> = {
  'nov-hospedagem': [
    { id: 'packages-new', name: 'Criar pacote' },
    { id: 'cp-reseller', name: 'Centro de revenda' },
  ],
  'nov-dominios': [
    { id: 'registrar-domains', name: 'Registar domínio', highlight: true },
    { id: 'domains-registados', name: 'Domínios registados' },
    { id: 'cp-subdomains', name: 'Adicionar domínio' },
    { id: 'cp-list-subdomains', name: 'Listar Sub/Addon' },
  ],
  'nov-wordpress': [
    { id: 'cp-modify-website', name: 'Modificar website' },
    { id: 'cp-suspend-website', name: 'Suspender/Activar' },
    { id: 'website-preview', name: 'Pré-visualização' },
    { id: 'cp-delete-website', name: 'Apagar website' },
    { id: 'phpmyadmin', name: 'phpMyAdmin' },
    { id: 'backup-manager', name: 'Gestão de backups' },
    { id: 'cp-wp-restore-backup', name: 'Restaurar backup' },
  ],
  'nov-sistema': [
    { id: 'file-manager', name: 'Gestor de ficheiros' },
    { id: 'cp-ftp', name: 'Contas FTP' },
    { id: 'cp-audit-sync', name: 'Auditoria & Sync' },
  ],
};

/** Lista plana dos cards que saíram do slide (para filtrar o carrossel). */
export function getDashboardRelocatedCarouselTools(): DashboardMenuToolDef[] {
  return Object.values(DASHBOARD_EXTRA_TOOLS_BY_MENU).flat();
}

export function getDashboardMenuSectionDefs(): DashboardMenuSectionDef[] {
  return NEW_MENU_ITEM_DEFS.filter(
    (item) => item.id !== 'dashboard' && item.id !== DASHBOARD_EMAIL_MENU_ID && item.subItems?.length,
  ).map((item) => {
    const fromMenu = item.subItems!.map((sub) => ({
      id: sub.id,
      name: sub.label,
      panelPath: DASHBOARD_TOOL_PANEL_PATHS[sub.id],
    }));
    const seen = new Set(fromMenu.map((t) => t.id));
    const extras = (DASHBOARD_EXTRA_TOOLS_BY_MENU[item.id] ?? []).filter((t) => !seen.has(t.id));
    return {
      id: `menu-${item.id}`,
      name: item.label,
      menuItemId: item.id,
      tools: [...fromMenu, ...extras],
    };
  });
}

/** Cards extra do carrossel → menu principal exposto no dashboard. */
const EXTRA_CAROUSEL_TOOL_PARENT: Record<string, string> = {
  'packages-new': 'nov-hospedagem',
  'cp-reseller': 'nov-hospedagem',
  'cp-modify-website': 'nov-wordpress',
  'cp-suspend-website': 'nov-wordpress',
  'cp-delete-website': 'nov-wordpress',
  'website-preview': 'nov-wordpress',
  phpmyadmin: 'nov-wordpress',
  'backup-manager': 'nov-wordpress',
  'cp-wp-restore-backup': 'nov-wordpress',
  'file-manager': 'nov-sistema',
  'cp-ftp': 'nov-sistema',
  'cp-audit-sync': 'nov-sistema',
};

/** Menus principais com secção visível no dashboard. */
export function getExposedDashboardMenuParents(): Set<string> {
  const parents = new Set<string>();
  for (const sectionId of DASHBOARD_SECTION_ORDER) {
    if (sectionId === DASHBOARD_EMAIL_SECTION_ID) parents.add(DASHBOARD_EMAIL_MENU_ID);
    else if (sectionId.startsWith('menu-')) parents.add(sectionId.slice('menu-'.length));
  }
  return parents;
}

export function menuParentForDashboardTool(toolId: string): string | null {
  const resolved = resolveSectionId(toolId);
  return (
    EXTRA_CAROUSEL_TOOL_PARENT[toolId] ??
    EXTRA_CAROUSEL_TOOL_PARENT[resolved] ??
    adminMenuParentForSection(resolved) ??
    NEW_SECTION_TO_PARENT[resolved] ??
    null
  );
}

/** Ocultar do carrossel se o card já está numa secção exposta (mesmo id ou mesma secção). */
export function isToolInExposedDashboardSection(
  toolId: string,
  exposedToolIds: Set<string>,
  exposedMenuParents: Set<string>,
): boolean {
  const resolved = resolveSectionId(toolId);
  if (exposedToolIds.has(toolId) || exposedToolIds.has(resolved)) return true;
  const parent = menuParentForDashboardTool(toolId);
  return parent != null && exposedMenuParents.has(parent);
}
