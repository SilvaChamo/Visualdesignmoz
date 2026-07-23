import { createClient } from '@/utils/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { userBelongsToCurrentPanel } from '@/lib/panel-tenant';

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

  return <>{children}</>;
}
