import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveCheckoutActor } from '@/lib/checkout-actor';

export const dynamic = 'force-dynamic';

/**
 * Diz ao checkout quem é, de facto, o comprador. Se um admin estiver a
 * "entrar como" um revendedor/cliente, devolve os dados de faturação DESSA
 * conta — para o cartão "Faturado Para" não mostrar os dados do admin.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ impersonating: false });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ impersonating: false });

  const actor = await resolveCheckoutActor(admin, user);
  if (!actor.impersonating) return NextResponse.json({ impersonating: false });

  const { data: profile } = await admin
    .from('profiles')
    .select('name, telefone, morada, cidade')
    .eq('user_id', actor.buyerUserId)
    .maybeSingle();

  return NextResponse.json({
    impersonating: true,
    label: actor.impersonatedLabel,
    email: actor.buyerEmail,
    billing: {
      nome: profile?.name ?? null,
      telefone: profile?.telefone ?? null,
      morada: profile?.morada ?? null,
      cidade: profile?.cidade ?? null,
    },
  });
}
