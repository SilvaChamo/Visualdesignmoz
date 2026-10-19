import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ensureResellerProvisioned } from "@/lib/reseller-auto-provision";
import { userBelongsToCurrentPanel } from "@/lib/panel-tenant";
import { ResellerAutoProvision } from "@/components/revendedor/ResellerAutoProvision";

export const metadata: Metadata = {
    title: "Painel Profissional — VisualDesign",
    robots: 'noindex, nofollow',
};

const adminEmails = [
    'admin@your-domain.com',
    'geral@your-domain.com',
    'silva.chamo@gmail.com',
    'silva.chamo@your-domain.com'
];

/** Mesmo padrão de src/app/revendedor/layout.tsx — só troca 'reseller' por
 * 'profissional' (quem compra a si próprio no checkout). */
export default async function ProfissionalLayout({
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

    const userRole = user.user_metadata?.role || user.app_metadata?.role;
    const isExplicitAdmin = adminEmails.includes((user.email || '').toLowerCase());

    const isProfissional = userRole === 'profissional';
    const isAdminAccess = userRole === 'admin' || isExplicitAdmin;

    if (!isProfissional && !isAdminAccess) {
        notFound();
    }

    if (isProfissional && user.email) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('da_username')
            .eq('user_id', user.id)
            .maybeSingle();

        if (!profile?.da_username?.trim()) {
            void ensureResellerProvisioned({
                userId: user.id,
                email: user.email,
                nome: (user.user_metadata?.nome as string) || undefined,
            }).catch((e) => {
                console.error('[profissional/layout] auto-provision:', e);
            });
        }
    }

    return (
        <>
            {isProfissional ? <ResellerAutoProvision /> : null}
            {children}
        </>
    );
}
