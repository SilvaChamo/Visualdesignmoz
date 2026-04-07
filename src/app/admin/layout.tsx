import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Painel Admin",
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

    if (userRole !== 'admin' && !isExplicitAdmin) {
        const userEmail = (user.email || '').toLowerCase();
        if (userEmail.includes('silva.chamo') || userEmail.includes('chamo.silva')) {
            console.log('AdminLayout: FORCE BYPASS for silva.chamo');
        } else {
            console.log('AdminLayout: Denied access. Not admin nor in explicit list.');
            notFound();
        }
    }

    return <>{children}</>;
}
