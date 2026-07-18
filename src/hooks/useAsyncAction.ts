import { useCallback, useRef, useState } from 'react';

/**
 * Envolve uma acção assíncrona (clique num botão) para ignorar chamadas repetidas
 * enquanto a anterior ainda não terminou — evita duplo-clique a disparar a mesma
 * acção (pagamento, apagar, etc.) duas vezes.
 */
export function useAsyncAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<void>,
) {
  const [isPending, setIsPending] = useState(false);
  const pendingRef = useRef(false);

  const run = useCallback(
    async (...args: Args) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setIsPending(true);
      try {
        await action(...args);
      } finally {
        pendingRef.current = false;
        setIsPending(false);
      }
    },
    [action],
  );

  return [run, isPending] as const;
}
