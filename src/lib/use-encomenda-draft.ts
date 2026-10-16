'use client';

import { useEffect, useState } from 'react';
import { ENCOMENDA_DRAFT_EVENT, loadEncomendaDraft, type EncomendaDraft } from '@/lib/encomenda-checkout';

/**
 * Rascunho da encomenda VisualDesign em curso (ver encomenda-checkout.ts),
 * sempre actualizado — muda na hora quando é gravado/apagado nesta página
 * ou noutro separador. Usado pelo balão do carrinho para a encomenda nunca
 * se perder a meio do pagamento.
 */
export function useEncomendaDraft(): EncomendaDraft | null {
  const [draft, setDraft] = useState<EncomendaDraft | null>(null);

  useEffect(() => {
    const refresh = () => setDraft(loadEncomendaDraft());
    refresh();
    window.addEventListener(ENCOMENDA_DRAFT_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(ENCOMENDA_DRAFT_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return draft;
}
