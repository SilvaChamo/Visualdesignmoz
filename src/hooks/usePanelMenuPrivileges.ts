'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  defaultManagerMenuPrivileges,
  defaultResellerMenuPrivileges,
  resolveManagerMenuPrivileges,
  resolveResellerMenuPrivileges,
  type ResellerMenuPrivilegesConfig,
} from '@/lib/panel-menu-privileges';
import {
  readPanelMenuPrivilegesCache,
  writePanelMenuPrivilegesCache,
  type PanelMenuPrivilegesRole,
} from '@/lib/panel-menu-privileges-cache';

export const PANEL_MENU_PRIVILEGES_EVENT = 'panel-menu-privileges-updated';

/** @deprecated usar PANEL_MENU_PRIVILEGES_EVENT */
export const RESELLER_MENU_PRIVILEGES_EVENT = PANEL_MENU_PRIVILEGES_EVENT;

function defaultsForRole(role: PanelMenuPrivilegesRole): ResellerMenuPrivilegesConfig {
  return role === 'manager' ? defaultManagerMenuPrivileges() : defaultResellerMenuPrivileges();
}

function resolveForRole(
  role: PanelMenuPrivilegesRole,
  raw: ResellerMenuPrivilegesConfig | null | undefined,
): ResellerMenuPrivilegesConfig {
  return role === 'manager'
    ? resolveManagerMenuPrivileges(raw)
    : resolveResellerMenuPrivileges(raw);
}

export function dispatchPanelMenuPrivilegesUpdated(role: PanelMenuPrivilegesRole) {
  window.dispatchEvent(new CustomEvent(PANEL_MENU_PRIVILEGES_EVENT, { detail: { role } }));
}

export function usePanelMenuPrivileges(role: PanelMenuPrivilegesRole) {
  const [privileges, setPrivileges] = useState<ResellerMenuPrivilegesConfig>(() => {
    const cached = readPanelMenuPrivilegesCache(role);
    return cached ?? defaultsForRole(role);
  });
  const [loading, setLoading] = useState(() => readPanelMenuPrivilegesCache(role) === null);

  const loadPrivileges = useCallback(() => {
    const hadCache = readPanelMenuPrivilegesCache(role) !== null;
    if (!hadCache) setLoading(true);

    return fetch(`/api/admin/permissions?role=${role}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const raw = data?.permissions?.menuPrivileges as ResellerMenuPrivilegesConfig | undefined;
        const merged = resolveForRole(role, raw);
        setPrivileges(merged);
        writePanelMenuPrivilegesCache(role, merged);
      })
      .catch(() => {
        const cached = readPanelMenuPrivilegesCache(role);
        setPrivileges(cached ?? defaultsForRole(role));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [role]);

  useEffect(() => {
    let cancelled = false;

    loadPrivileges().then(() => {
      if (cancelled) return;
    });

    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ role?: PanelMenuPrivilegesRole }>).detail;
      if (detail?.role && detail.role !== role) return;
      void loadPrivileges();
    };

    window.addEventListener(PANEL_MENU_PRIVILEGES_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(PANEL_MENU_PRIVILEGES_EVENT, onUpdate);
    };
  }, [loadPrivileges, role]);

  return { privileges, loading, reload: loadPrivileges };
}
