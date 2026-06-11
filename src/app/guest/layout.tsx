import { createClient } from '@/utils/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { resolveUserRole } from '@/lib/user-roles';
import { profileAuthOrFilter } from '@/lib/profile-db';
import { userBelongsToCurrentPanel } from '@/lib/panel-tenant';
import { fetchUserProductsSummary } from '@/lib/user-products';
import { getRedirectPathForRole } from '@/lib/user-roles';

export default async function GuestLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  if (!userBelongsToCurrentPanel(user)) notFound();

  const products = await fetchUserProductsSummary(supabase, user.id);
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

  if (role !== 'guest') {
    redirect(getRedirectPathForRole(role));
  }

  return <>{children}</>;
}
