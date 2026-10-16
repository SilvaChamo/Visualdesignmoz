'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { Spinner } from '@/components/ui/spinner';
import { resolveUserRole, getRedirectPathForRole } from '@/lib/user-roles';

/**
 * Redirecciona para o painel real do utilizador — mantido só para sessões do
 * Stripe já criadas com este `success_url` antes desta mudança (podem
 * demorar até alguns minutos a expirar); o checkout novo já manda
 * directamente para o painel certo com o item pendente visível, sem passar
 * por aqui. Seguro remover este ficheiro por completo passadas umas semanas.
 */
function CheckoutSucessoContent() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.refreshSession();
      const role = resolveUserRole({
        email: data.session?.user?.email,
        userMetadata: data.session?.user?.user_metadata,
        appMetadata: data.session?.user?.app_metadata,
      });
      router.replace(getRedirectPathForRole(role));
    })();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
      <Spinner className="w-10 h-10" />
    </div>
  );
}

export default function CheckoutSucessoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
          <Spinner className="w-10 h-10" />
        </div>
      }
    >
      <CheckoutSucessoContent />
    </Suspense>
  );
}
