'use client';

import { useEffect } from 'react';

/** Garante provisionamento DA ao abrir o painel revendedor (fallback client-side). */
export function ResellerAutoProvision() {
  useEffect(() => {
    fetch('/api/reseller/ensure-provision', { method: 'POST' }).catch(() => {
      /* silencioso — layout servidor já tentou */
    });
  }, []);

  return null;
}
