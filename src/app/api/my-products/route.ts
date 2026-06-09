import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { fetchUserProductsSummary } from '@/lib/user-products';
import { resolveUserRole } from '@/lib/user-roles';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const products = await fetchUserProductsSummary(supabase, user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
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
