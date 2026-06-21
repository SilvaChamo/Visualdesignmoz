import {
  ADMIN_MENU_ITEM_DEFS,
  NEW_SECTION_TO_PARENT,
  RESELLER_MENU_DEFS,
  RESELLER_SECTION_TO_PARENT,
  adminMenuParentForSection,
  resolveSectionId,
  type PanelMenuItemDef,
} from '@/lib/panel-admin-menu';
import { getPanelSectionMeta } from '@/lib/panel-section-meta';

export type PanelBreadcrumbItem = {
  sectionId: string;
  label: string;
  isCurrent: boolean;
};

/** Grupos do menu sem página própria → primeira secção filha. */
const MENU_GROUP_NAV: Record<string, string> = {
  utilizadores: 'cp-users',
  'nov-hospedagem': 'hospedagem-contas',
  'nov-email': 'emails-new',
  'nov-dominios': 'domain-manager',
  'nov-notificacoes': 'renewals',
  'nov-wordpress': 'wp-sites',
  'nov-sistema': 'infrastructure',
  'nov-definicoes': 'settings-profile',
  'menu-anterior': 'domains-list',
  newsletter: 'newsletter-subs',
};

function menuLabelFromDefs(defs: PanelMenuItemDef[], sectionId: string): string | null {
  for (const item of defs) {
    if (item.id === sectionId) return item.label;
    for (const sub of item.subItems ?? []) {
      if (sub.id === sectionId) return sub.label;
    }
  }
  return null;
}

function labelForSection(sectionId: string, scope: 'admin' | 'reseller'): string {
  const defs = scope === 'reseller' ? RESELLER_MENU_DEFS : ADMIN_MENU_ITEM_DEFS;
  return (
    menuLabelFromDefs(defs, sectionId) ||
    getPanelSectionMeta(sectionId).title
  );
}

function navigableSectionId(sectionId: string): string {
  return MENU_GROUP_NAV[sectionId] ?? sectionId;
}

function parentForSection(sectionId: string, scope: 'admin' | 'reseller'): string | null {
  const resolved = resolveSectionId(sectionId);
  if (scope === 'admin') {
    return adminMenuParentForSection(resolved) ?? NEW_SECTION_TO_PARENT[resolved] ?? null;
  }
  return RESELLER_SECTION_TO_PARENT[resolved] ?? null;
}

export function getPanelBreadcrumbTrail(
  sectionId: string,
  scope: 'admin' | 'reseller' = 'admin',
): PanelBreadcrumbItem[] {
  const resolved = resolveSectionId(sectionId);
  if (!resolved || resolved === 'dashboard') return [];

  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | null = resolved;

  while (current && !seen.has(current)) {
    seen.add(current);
    chain.unshift(current);
    const parent = parentForSection(current, scope);
    if (!parent || parent === current || parent === 'dashboard') {
      if (parent === 'dashboard' && !chain.includes('dashboard')) {
        chain.unshift('dashboard');
      }
      break;
    }
    current = parent;
  }

  if (chain[0] !== 'dashboard') {
    chain.unshift('dashboard');
  }

  const unique = chain.filter((id, index) => chain.indexOf(id) === index);

  return unique.map((id, index) => ({
    sectionId: navigableSectionId(id),
    label: labelForSection(id, scope),
    isCurrent: index === unique.length - 1,
  }));
}
