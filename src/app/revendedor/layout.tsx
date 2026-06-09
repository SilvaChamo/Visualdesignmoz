import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ensureResellerProvisioned } from "@/lib/reseller-auto-provision";
import { ResellerAutoProvision } from "@/components/revendedor/ResellerAutoProvision";

export const metadata: Metadata = {
    title: "Painel Revendedor — Osher Collective",
    robots: 'noindex, nofollow',
};

const adminEmails = [
    'admin@your-domain.com',
    'geral@your-domain.com',
    'silva.chamo@gmail.com',
    'silva.chamo@your-domain.com'
];

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        console.log('AdminLayout: No user session found.');
        notFound();
    }

    const userRole = user.user_metadata?.role || user.app_metadata?.role;
    const isExplicitAdmin = adminEmails.includes((user.email || '').toLowerCase());

    console.log('AdminLayout Debug:', {
        email: user.email,
        userRole,
        isExplicitAdmin,
        adminEmails
    });

    const isReseller = userRole === 'reseller';
    const isAdminAccess = userRole === 'admin' || isExplicitAdmin;

    if (!isReseller && !isAdminAccess) {
        const userEmail = (user.email || '').toLowerCase();
        if (userEmail.includes('silva.chamo') || userEmail.includes('chamo.silva')) {
            console.log('ResellerLayout: FORCE BYPASS for silva.chamo');
        } else {
            console.log('ResellerLayout: Denied access. Not reseller/admin nor in explicit list.');
            notFound();
        }
    }

    if (isReseller && user.email) {
        try {
            await ensureResellerProvisioned({
                userId: user.id,
                email: user.email,
                nome: (user.user_metadata?.nome as string) || undefined,
            });
        } catch (e) {
            console.error('[revendedor/layout] auto-provision:', e);
        }
    }

    return (
        <>
            {isReseller ? <ResellerAutoProvision /> : null}
            {children}
        </>
    );
}
