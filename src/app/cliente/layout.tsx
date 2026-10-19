import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import { resolveUserRole, getRedirectPathForRole, RECENT_PENDING_SESSION_WINDOW_MS } from "@/lib/user-roles";
import { profileAuthOrFilter } from "@/lib/profile-db";
import { userBelongsToCurrentPanel } from "@/lib/panel-tenant";
import { fetchUserProductsSummary, hasRecentPendingSession } from "@/lib/user-products";
import { resolveEffectiveClientUser } from "@/lib/client-impersonation";
import { ImpersonationBanner } from "@/components/encomendas/ImpersonationBanner";

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

    if (!userBelongsToCurrentPanel(user)) {
        notFound();
    }

    // Admin a ver/gerir a conta de um cliente (ver /api/admin/impersonate-client):
    // o painel mostra os dados do cliente, com o aviso amarelo por cima.
    const effective = await resolveEffectiveClientUser();
    if (effective?.impersonating) {
        const target = effective.user;
        const label =
            (target.user_metadata?.name as string) ||
            (target.user_metadata?.nome as string) ||
            (target.user_metadata?.full_name as string) ||
            target.email ||
            'cliente';
        return (
            <div className="flex h-screen flex-col">
                <ImpersonationBanner label={label} exitEndpoint="/api/admin/impersonate-client?exit=1" />
                {/* A página do painel ocupa o ecrã todo (h-screen) — aqui só o espaço abaixo do aviso. */}
                <div className="min-h-0 flex-1 [&_.panel-shell]:h-full">{children}</div>
            </div>
        );
    }

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
        hasRecentPendingSession: hasRecentPendingSession(products.pendingSessions, RECENT_PENDING_SESSION_WINDOW_MS),
    });

    if (role !== 'client') {
        redirect(getRedirectPathForRole(role));
    }

    return <>{children}</>;
}
