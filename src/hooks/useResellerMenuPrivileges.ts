'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  defaultResellerMenuPrivileges,
  resolveResellerMenuPrivileges,
  type ResellerMenuPrivilegesConfig,
} from '@/lib/panel-menu-privileges';

export const RESELLER_MENU_PRIVILEGES_EVENT = 'reseller-menu-privileges-updated';

export function useResellerMenuPrivileges() {
  const [privileges, setPrivileges] = useState<ResellerMenuPrivilegesConfig>(
    defaultResellerMenuPrivileges,
  );
  const [loading, setLoading] = useState(true);

  const loadPrivileges = useCallback(() => {
    setLoading(true);
    return fetch('/api/admin/permissions?role=reseller', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const raw = data?.permissions?.menuPrivileges as ResellerMenuPrivilegesConfig | undefined;
        setPrivileges(resolveResellerMenuPrivileges(raw));
      })
      .catch(() => {
        setPrivileges(defaultResellerMenuPrivileges());
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadPrivileges().then(() => {
      if (cancelled) return;
    });

    const onUpdate = () => {
      void loadPrivileges();
    };

    window.addEventListener(RESELLER_MENU_PRIVILEGES_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(RESELLER_MENU_PRIVILEGES_EVENT, onUpdate);
    };
  }, [loadPrivileges]);

  return { privileges, loading, reload: loadPrivileges };
}
