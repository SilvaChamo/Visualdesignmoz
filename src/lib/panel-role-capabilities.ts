import type { UserRole } from '@/lib/user-roles';
import {
  ADMIN_MENU_ITEM_DEFS,
  NEW_MENU_ITEM_DEFS,
  type PanelMenuItemDef,
} from '@/lib/panel-admin-menu';

/** Níveis de revenda — Essencial (limitado) · Expandido (mais contas e espaço). */
export type ResellerTier = 'essencial' | 'expandido';

export const RESELLER_TIER_LABELS: Record<ResellerTier, string> = {
  essencial: 'Revendedor Essencial',
  expandido: 'Revendedor Expandido',
};

export const RESELLER_TIER_LIMITS: Record<
  ResellerTier,
  { maxChildAccounts: number; maxDiskGb: number; label: string }
> = {
  essencial: { maxChildAccounts: 15, maxDiskGb: 50, label: RESELLER_TIER_LABELS.essencial },
  expandido: { maxChildAccounts: 150, maxDiskGb: 500, label: RESELLER_TIER_LABELS.expandido },
};

export type PanelCapabilities = {
  role: UserRole;
  readOnly: boolean;
  canCreateUsers: boolean;
  canManageHostingAccounts: boolean;
  canManagePackages: boolean;
  canProvisionHosting: boolean;
  canCreateWordPress: boolean;
  canConfigureSites: boolean;
  canManageResellerChildren: boolean;
  resellerTier: ResellerTier | null;
};

const MANAGER_ALLOWED_SECTIONS = new Set([
  'dashboard',
  'domains',
  'nov-wordpress',
  'wp-sites',
  'wordpress-install',
  'wp-plugins',
  'wp-backup',
  'cp-wp-list',
  'cp-wp-plugins',
  'cp-databases',
  'file-manager',
  'cp-file-manager',
  'cp-ssl',
  'cp-php',
  'dns-central',
  'domain-manager',
  'cp-dns',
  'backup-manager',
  'meus-produtos',
]);

const MANAGER_DENIED_MENU_IDS = new Set([
  'utilizadores',
  'nov-hospedagem',
  'nov-sistema',
  'menu-anterior',
]);

const MANAGER_DENIED_SUB_IDS = new Set([
  'cp-users',
  'clientes',
  'hospedagem-contas',
  'packages-list',
  'provision-client',
  'cp-reseller',
  'cp-reseller-permissions',
  'panel-permissions',
]);

export function normalizeResellerTier(value: unknown): ResellerTier {
  return String(value || '').toLowerCase() === 'expandido' ? 'expandido' : 'essencial';
}

export function resolvePanelCapabilities(input: {
  role: UserRole;
  resellerTier?: ResellerTier | string | null;
}): PanelCapabilities {
  const role = input.role;
  const resellerTier = role === 'reseller' ? normalizeResellerTier(input.resellerTier) : null;

  if (role === 'admin') {
    return {
      role,
      readOnly: false,
      canCreateUsers: true,
      canManageHostingAccounts: true,
      canManagePackages: true,
      canProvisionHosting: true,
      canCreateWordPress: true,
      canConfigureSites: true,
      canManageResellerChildren: true,
      resellerTier: null,
    };
  }

  if (role === 'manager') {
    return {
      role,
      readOnly: false,
      canCreateUsers: false,
      canManageHostingAccounts: false,
      canManagePackages: false,
      canProvisionHosting: false,
      canCreateWordPress: true,
      canConfigureSites: true,
      canManageResellerChildren: false,
      resellerTier: null,
    };
  }

  if (role === 'reseller') {
    return {
      role,
      readOnly: false,
      canCreateUsers: false,
      canManageHostingAccounts: true,
      canManagePackages: false,
      canProvisionHosting: true,
      canCreateWordPress: true,
      canConfigureSites: true,
      canManageResellerChildren: true,
      resellerTier,
    };
  }

  return {
    role,
    readOnly: true,
    canCreateUsers: false,
    canManageHostingAccounts: false,
    canManagePackages: false,
    canProvisionHosting: false,
    canCreateWordPress: false,
    canConfigureSites: false,
    canManageResellerChildren: false,
    resellerTier: null,
  };
}

export function isManagerSectionAllowed(sectionId: string): boolean {
  return MANAGER_ALLOWED_SECTIONS.has(sectionId);
}

export function filterAdminMenuForCapabilities(
  items: PanelMenuItemDef[],
  capabilities: PanelCapabilities,
): PanelMenuItemDef[] {
  if (capabilities.role === 'admin') return items;

  if (capabilities.role !== 'manager') return items;

  return items
    .filter((item) => !MANAGER_DENIED_MENU_IDS.has(item.id))
    .map((item) => {
      if (!item.subItems?.length) return item;
      const subItems = item.subItems.filter((sub) => !MANAGER_DENIED_SUB_IDS.has(sub.id));
      if (!subItems.length) return null;
      return { ...item, subItems };
    })
    .filter(Boolean) as PanelMenuItemDef[];
}

export function getStaffAdminMenu(capabilities: PanelCapabilities): PanelMenuItemDef[] {
  const base = ADMIN_MENU_ITEM_DEFS.filter((item) => item.isNewMenu !== false);
  return filterAdminMenuForCapabilities(base.length ? base : NEW_MENU_ITEM_DEFS, capabilities);
}

/** Menu do cliente — só visualização de produtos e informação (sem criação). */
export const CLIENT_READONLY_MENU_DEFS: PanelMenuItemDef[] = [
  { id: 'meus-produtos', label: 'Os meus produtos' },
  { id: 'domains', label: 'Os meus sites' },
];

export function assertResellerCanCreateChildAccount(params: {
  tier: ResellerTier;
  currentChildCount: number;
}): { ok: true } | { ok: false; error: string } {
  const limits = RESELLER_TIER_LIMITS[params.tier];
  if (params.currentChildCount >= limits.maxChildAccounts) {
    return {
      ok: false,
      error: `Limite de contas do plano ${limits.label} (${limits.maxChildAccounts}). Actualize para Expandido.`,
    };
  }
  return { ok: true };
}
