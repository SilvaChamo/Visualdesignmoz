import { createClient } from '@/utils/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { userBelongsToCurrentPanel } from '@/lib/panel-tenant';
import { resolveRoleForAuthUser } from '@/lib/server-auth-role';
import { readImpersonateClientUserId } from '@/lib/client-impersonation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ImpersonationBanner } from '@/components/encomendas/ImpersonationBanner';

// Painel próprio das encomendas de design (marca VisualDesign) — separado dos
// painéis de hospedagem (dashboard/client/guest/revendedor). Qualquer conta
// autenticada pode entrar: não depende do papel de hospedagem (admin,
// reseller, client, guest), só de ter feito login.
export default async function EncomendasLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!userBelongsToCurrentPanel(user)) notFound();

  // Banner "a ver como cliente X" — só para um admin real que tenha entrado
  // via src/app/api/admin/cotacoes/clientes/entrar (ver client-impersonation.ts).
  // A sessão aqui é sempre a do próprio admin, nunca a do cliente.
  const role = await resolveRoleForAuthUser(supabase, user);
  const impersonatedUserId = role === 'admin' ? await readImpersonateClientUserId() : null;
  let impersonatedLabel: string | null = null;
  if (impersonatedUserId) {
    const admin = getSupabaseAdmin();
    const { data: target } = (await admin?.auth.admin.getUserById(impersonatedUserId)) || {};
    impersonatedLabel =
      (target?.user?.user_metadata?.name as string) ||
      (target?.user?.user_metadata?.nome as string) ||
      target?.user?.email ||
      'cliente';
  }

  return (
    <div className="flex h-screen flex-col">
      {impersonatedLabel && (
        <ImpersonationBanner
          label={impersonatedLabel}
          exitEndpoint="/api/admin/cotacoes/clientes/entrar"
          exitRedirect="/vhost:2026"
        />
      )}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
