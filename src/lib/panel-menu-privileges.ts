import {
  NEW_MENU_ITEM_DEFS,
  isMenuHeaderSubItem,
  type PanelMenuItemDef,
} from '@/lib/panel-admin-menu';

/** Menu admin (sem Dashboard) — opções dos painéis Revendedor e Profissional. */
export const RESELLER_PRIVILEGE_MENU_DEFS: PanelMenuItemDef[] = NEW_MENU_ITEM_DEFS.filter(
  (item) => item.id !== 'dashboard',
);

export const RESELLER_PRIVILEGE_MENU_LABELS: Record<string, string> = Object.fromEntries(
  RESELLER_PRIVILEGE_MENU_DEFS.map((item) => [item.id, item.label]),
);

/** Grupos do menu revendedor que usam privilégios de outro grupo do menu admin. */
const RESELLER_SIDEBAR_PRIVILEGE_PARENT: Record<string, string> = {
  'nov-definicoes': 'nov-sistema',
};

function sidebarPrivilegeParent(menuParentId: string): string {
  return RESELLER_SIDEBAR_PRIVILEGE_PARENT[menuParentId] ?? menuParentId;
}

export type ResellerMenuKey = string;

export type ResellerMenuPrivilegesConfig = {
  reseller?: Partial<Record<ResellerMenuKey, boolean>>;
  resellerSub?: Partial<Record<string, boolean>>;
};

export function menuSubPrivilegeKey(parent: string, childKey: string): string {
  return `${parent}:${childKey}`;
}

function defaultSubPrivileges(items: PanelMenuItemDef[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const parent of items) {
    if (!parent.subItems?.length) continue;
    for (const child of parent.subItems) {
      if (isMenuHeaderSubItem(child.id)) continue;
      out[menuSubPrivilegeKey(parent.id, child.id)] = true;
    }
  }
  return out;
}

export function defaultResellerMenuPrivileges(): ResellerMenuPrivilegesConfig {
  const reseller = Object.fromEntries(
    RESELLER_PRIVILEGE_MENU_DEFS.map((item) => [item.id, true]),
  ) as Record<ResellerMenuKey, boolean>;

  return {
    reseller,
    resellerSub: defaultSubPrivileges(RESELLER_PRIVILEGE_MENU_DEFS),
  };
}

const MANAGER_DEFAULT_DENIED_PARENTS = new Set(['utilizadores', 'nov-hospedagem', 'nov-sistema']);

/** Perfil profissional (manager) — espelha restrições actuais do painel. */
export function defaultManagerMenuPrivileges(): ResellerMenuPrivilegesConfig {
  const base = defaultResellerMenuPrivileges();
  const reseller = { ...base.reseller };
  const resellerSub = { ...base.resellerSub };

  for (const parentId of MANAGER_DEFAULT_DENIED_PARENTS) {
    reseller[parentId] = false;
    const parent = RESELLER_PRIVILEGE_MENU_DEFS.find((item) => item.id === parentId);
    for (const child of parent?.subItems ?? []) {
      if (isMenuHeaderSubItem(child.id)) continue;
      resellerSub[menuSubPrivilegeKey(parentId, child.id)] = false;
    }
  }

  return { reseller, resellerSub };
}

function resolvePanelMenuPrivileges(
  raw: ResellerMenuPrivilegesConfig | null | undefined,
  defaults: () => ResellerMenuPrivilegesConfig,
): ResellerMenuPrivilegesConfig {
  const defaultConfig = defaults();
  if (!raw) return defaultConfig;

  const mergedReseller = { ...defaultConfig.reseller, ...raw.reseller };
  const mergedSub = { ...defaultConfig.resellerSub, ...raw.resellerSub };

  // Migração: menu pai renomeado de clientes → utilizadores
  if (raw.reseller?.clientes !== undefined) {
    mergedReseller.utilizadores = raw.reseller.clientes;
  }
  if (raw.reseller?.['nov-definicoes'] !== undefined) {
    mergedReseller['nov-sistema'] = raw.reseller['nov-definicoes'];
  }
  if (raw.reseller?.newsletter !== undefined) {
    mergedReseller.newsletter = raw.reseller.newsletter;
  }
  for (const [key, value] of Object.entries(raw.resellerSub || {})) {
    if (key.startsWith('clientes:')) {
      const migrated = key.replace('clientes:', 'utilizadores:');
      if (mergedSub[migrated] === undefined) mergedSub[migrated] = value;
    }
    if (key.startsWith('nov-definicoes:')) {
      const migrated = key.replace('nov-definicoes:', 'nov-sistema:');
      if (mergedSub[migrated] === undefined) mergedSub[migrated] = value;
    }
    if (key.startsWith('nov-email:newsletter-')) {
      const migrated = key.replace('nov-email:', 'newsletter:');
      if (mergedSub[migrated] === undefined) mergedSub[migrated] = value;
    }
  }

  const reseller = Object.fromEntries(
    RESELLER_PRIVILEGE_MENU_DEFS.map((item) => [
      item.id,
      mergedReseller[item.id] !== false,
    ]),
  ) as Record<ResellerMenuKey, boolean>;
  reseller.dashboard = true;

  const resellerSub: Record<string, boolean> = {};
  for (const parent of RESELLER_PRIVILEGE_MENU_DEFS) {
    if (!parent.subItems?.length) continue;
    for (const child of parent.subItems) {
      if (isMenuHeaderSubItem(child.id)) continue;
      const key = menuSubPrivilegeKey(parent.id, child.id);
      resellerSub[key] = mergedSub[key] !== false;
    }
  }

  return { reseller, resellerSub };
}

export function resolveResellerMenuPrivileges(
  raw: ResellerMenuPrivilegesConfig | null | undefined,
): ResellerMenuPrivilegesConfig {
  return resolvePanelMenuPrivileges(raw, defaultResellerMenuPrivileges);
}

export function resolveManagerMenuPrivileges(
  raw: ResellerMenuPrivilegesConfig | null | undefined,
): ResellerMenuPrivilegesConfig {
  return resolvePanelMenuPrivileges(raw, defaultManagerMenuPrivileges);
}

export function isResellerMenuEnabled(
  privileges: ResellerMenuPrivilegesConfig,
  key: ResellerMenuKey,
): boolean {
  return privileges.reseller?.[key] !== false;
}

export function isResellerSubmenuEnabled(
  privileges: ResellerMenuPrivilegesConfig,
  parent: ResellerMenuKey,
  childKey: string,
): boolean {
  if (!isResellerMenuEnabled(privileges, parent)) return false;
  return privileges.resellerSub?.[menuSubPrivilegeKey(parent, childKey)] !== false;
}

/** Activa/desactiva menu e sincroniza todos os submenus do mesmo grupo. */
export function patchResellerMenuToggle(
  privileges: ResellerMenuPrivilegesConfig,
  key: ResellerMenuKey,
  enabled: boolean,
  menuDefs: PanelMenuItemDef[] = RESELLER_PRIVILEGE_MENU_DEFS,
): ResellerMenuPrivilegesConfig {
  const reseller = { ...privileges.reseller, [key]: enabled };
  if (key === 'dashboard') {
    reseller.dashboard = true;
  }
  const resellerSub = { ...privileges.resellerSub };
  const parent = menuDefs.find((item) => item.id === key);
  const children = parent?.subItems ?? [];

  for (const child of children) {
    if (isMenuHeaderSubItem(child.id)) continue;
    resellerSub[menuSubPrivilegeKey(key, child.id)] = enabled;
  }

  return { ...privileges, reseller, resellerSub };
}

/** Activa/desactiva submenu; activar filho liga o pai; desactivar o último filho desliga o pai. */
export function patchResellerSubToggle(
  privileges: ResellerMenuPrivilegesConfig,
  parent: ResellerMenuKey,
  childKey: string,
  enabled: boolean,
  menuDefs: PanelMenuItemDef[] = RESELLER_PRIVILEGE_MENU_DEFS,
): ResellerMenuPrivilegesConfig {
  const subKey = menuSubPrivilegeKey(parent, childKey);
  const resellerSub = { ...privileges.resellerSub, [subKey]: enabled };
  const reseller = { ...privileges.reseller };

  if (enabled) {
    reseller[parent] = true;
  } else {
    const parentDef = menuDefs.find((item) => item.id === parent);
    const siblings = (parentDef?.subItems ?? []).filter((item) => !isMenuHeaderSubItem(item.id));
    const anySiblingEnabled = siblings.some(
      (item) =>
        item.id !== childKey &&
        resellerSub[menuSubPrivilegeKey(parent, item.id)] !== false,
    );
    if (!anySiblingEnabled) {
      reseller[parent] = false;
    }
  }

  return { ...privileges, reseller, resellerSub };
}

export function filterMenuByPrivileges(
  items: PanelMenuItemDef[],
  privileges: ResellerMenuPrivilegesConfig,
): PanelMenuItemDef[] {
  return items
    .filter((item) => isResellerMenuEnabled(privileges, sidebarPrivilegeParent(item.id)))
    .map((item) => {
      if (!item.subItems?.length) return item;

      const privilegeParent = sidebarPrivilegeParent(item.id);
      const subItems = item.subItems.filter((sub) => {
        if (isMenuHeaderSubItem(sub.id)) return true;
        return isResellerSubmenuEnabled(privileges, privilegeParent, sub.id);
      });

      const hasNavigable = subItems.some((sub) => !isMenuHeaderSubItem(sub.id));
      if (!hasNavigable) return null;

      return { ...item, subItems };
    })
    .filter(Boolean) as PanelMenuItemDef[];
}
