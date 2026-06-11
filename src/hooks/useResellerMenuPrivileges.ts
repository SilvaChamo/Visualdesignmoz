'use client';

import { useEffect, useState } from 'react';
import {
  defaultResellerMenuPrivileges,
  resolveResellerMenuPrivileges,
  type ResellerMenuPrivilegesConfig,
} from '@/lib/panel-menu-privileges';

export function useResellerMenuPrivileges() {
  const [privileges, setPrivileges] = useState<ResellerMenuPrivilegesConfig>(
    defaultResellerMenuPrivileges,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/admin/permissions?role=reseller', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const raw = data?.permissions?.menuPrivileges as ResellerMenuPrivilegesConfig | undefined;
        setPrivileges(resolveResellerMenuPrivileges(raw));
      })
      .catch(() => {
        if (!cancelled) setPrivileges(defaultResellerMenuPrivileges());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { privileges, loading };
}
