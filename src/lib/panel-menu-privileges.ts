import {
  ADMIN_MENU_ITEM_DEFS,
  RESELLER_ADMIN_MENU_DEFS,
  isMenuHeaderSubItem,
  type PanelMenuItemDef,
} from '@/lib/panel-admin-menu';

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
    RESELLER_ADMIN_MENU_DEFS.map((item) => [item.id, true]),
  ) as Record<ResellerMenuKey, boolean>;

  return {
    reseller,
    resellerSub: defaultSubPrivileges(RESELLER_ADMIN_MENU_DEFS),
  };
}

export function resolveResellerMenuPrivileges(
  raw: ResellerMenuPrivilegesConfig | null | undefined,
): ResellerMenuPrivilegesConfig {
  const defaults = defaultResellerMenuPrivileges();
  if (!raw) return defaults;

  const reseller = { ...defaults.reseller, ...raw.reseller };
  const resellerSub = { ...defaults.resellerSub, ...raw.resellerSub };

  // Migração: menu pai renomeado de clientes → utilizadores
  if (raw.reseller?.clientes !== undefined) {
    reseller.utilizadores = raw.reseller.clientes;
  }
  for (const [key, value] of Object.entries(raw.resellerSub || {})) {
    if (key.startsWith('clientes:')) {
      const migrated = key.replace('clientes:', 'utilizadores:');
      if (resellerSub[migrated] === undefined) resellerSub[migrated] = value;
    }
  }

  return { reseller, resellerSub };
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
  menuDefs: PanelMenuItemDef[] = RESELLER_ADMIN_MENU_DEFS,
): ResellerMenuPrivilegesConfig {
  const reseller = { ...privileges.reseller, [key]: enabled };
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
  menuDefs: PanelMenuItemDef[] = RESELLER_ADMIN_MENU_DEFS,
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
    .filter((item) => isResellerMenuEnabled(privileges, item.id))
    .map((item) => {
      if (!item.subItems?.length) return item;

      const subItems = item.subItems.filter((sub) => {
        if (isMenuHeaderSubItem(sub.id)) return true;
        return isResellerSubmenuEnabled(privileges, item.id, sub.id);
      });

      const hasNavigable = subItems.some((sub) => !isMenuHeaderSubItem(sub.id));
      if (!hasNavigable) return null;

      return { ...item, subItems };
    })
    .filter(Boolean) as PanelMenuItemDef[];
}

/** Chaves e etiquetas para o painel de privilégios (admin) */
export const RESELLER_PRIVILEGE_MENU_DEFS = RESELLER_ADMIN_MENU_DEFS;

export const RESELLER_PRIVILEGE_MENU_LABELS: Record<string, string> = Object.fromEntries(
  ADMIN_MENU_ITEM_DEFS.map((item) => [item.id, item.label]),
);
