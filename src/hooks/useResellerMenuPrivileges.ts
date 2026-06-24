'use client';

export {
  PANEL_MENU_PRIVILEGES_EVENT,
  RESELLER_MENU_PRIVILEGES_EVENT,
  usePanelMenuPrivileges,
} from '@/hooks/usePanelMenuPrivileges';

import { usePanelMenuPrivileges } from '@/hooks/usePanelMenuPrivileges';

/** @deprecated usar usePanelMenuPrivileges('reseller') */
export function useResellerMenuPrivileges() {
  return usePanelMenuPrivileges('reseller');
}
