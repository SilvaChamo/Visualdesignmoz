'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/lib/supabase-client';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const POLL_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 20; // ~30 segundos

function CheckoutSucessoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { clearCart } = useCart();

  const [state, setState] = useState<'waiting' | 'paid' | 'timeout' | 'error'>('waiting');

  useEffect(() => {
    if (!sessionId) {
      setState('error');
      return;
    }

    let attempts = 0;
    let cancelled = false;

    async function poll() {
      attempts += 1;
      try {
        const res = await fetch(`/api/checkout/session-status?session_id=${sessionId}`);
        const data = await res.json();

        if (cancelled) return;

        if (data.session?.status === 'paid') {
          setState('paid');
          await supabase.auth.refreshSession();
          clearCart();
          router.refresh();
          setTimeout(() => router.replace('/client'), 1800);
          return;
        }

        if (data.session?.status === 'failed') {
          setState('error');
          return;
        }

        if (attempts >= MAX_ATTEMPTS) {
          setState('timeout');
          return;
        }

        setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled && attempts < MAX_ATTEMPTS) {
          setTimeout(poll, POLL_INTERVAL_MS);
        } else if (!cancelled) {
          setState('error');
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId, clearCart, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 px-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-10 text-center space-y-4 shadow-sm max-w-md w-full">
        {state === 'waiting' && (
          <>
            <Loader2 className="w-14 h-14 text-red-650 animate-spin mx-auto" />
            <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100 font-panel">
              A confirmar o seu pagamento...
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Isto pode demorar alguns segundos. Não feche esta página.
            </p>
          </>
        )}
        {state === 'paid' && (
          <>
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto animate-bounce" />
            <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100 font-panel">
              Pagamento confirmado!
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              A redireccionar para a sua área de cliente...
            </p>
          </>
        )}
        {(state === 'timeout' || state === 'error') && (
          <>
            <AlertCircle className="w-14 h-14 text-amber-500 mx-auto" />
            <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100 font-panel">
              Ainda a processar
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              O pagamento pode ainda estar a ser confirmado. Verifique a sua área de cliente daqui a
              pouco ou contacte o suporte se o problema persistir.
            </p>
            <button
              onClick={() => router.replace('/client')}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-md transition-colors"
            >
              Ir para a área de cliente
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutSucessoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
          <Loader2 className="w-10 h-10 animate-spin text-red-650" />
        </div>
      }
    >
      <CheckoutSucessoContent />
    </Suspense>
  );
}
