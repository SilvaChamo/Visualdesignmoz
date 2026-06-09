import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import { resolveUserRole, getRedirectPathForRole } from "@/lib/user-roles";
import { fetchUserProductsSummary } from "@/lib/user-products";

export default async function ClientLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        notFound();
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

    if (role !== 'client') {
        redirect(getRedirectPathForRole(role));
    }

    return <>{children}</>;
}
