import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchUserProductsSummary } from '@/lib/user-products';
import { resolveUserRole } from '@/lib/user-roles';
import { profileAuthOrFilter } from '@/lib/profile-db';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  // Mesma leitura do /api/panel/bootstrap (panel-client-context): service role
  // filtrado pelo user.id já autenticado acima. Com o cliente da sessão, o RLS
  // do servidor escondia as linhas criadas pela aprovação do comprovativo — o
  // menu lateral (bootstrap) via os produtos, mas o Dashboard dizia "Ainda não
  // encontrámos produtos".
  const products = await fetchUserProductsSummary(getSupabaseAdmin() ?? supabase, user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, da_username')
    .or(profileAuthOrFilter(user.id))
    .maybeSingle();

  const role = resolveUserRole({
    email: user.email,
    userMetadata: user.user_metadata,
    appMetadata: user.app_metadata,
    profileRole: profile?.role,
    hasPaidProducts: products.hasPaidProducts,
  });

  return NextResponse.json({
    role,
    products,
  });
}
