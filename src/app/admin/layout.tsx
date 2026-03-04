import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Painel Admin",
    robots: 'noindex, nofollow',
};

const adminEmails = [
    'admin@visualdesigne.com',
    'geral@visualdesigne.com',
    'silva.chamo@gmail.com',
    'silva.chamo@visualdesigne.com'
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
        if (user.email?.toLowerCase().includes('silva.chamo')) {
            console.log('AdminLayout: DEBUG BYPASS for silva.chamo');
        } else {
            console.log('AdminLayout: Denied access. Not admin nor in explicit list.');
            notFound();
        }
    }

    return <>{children}</>;
}
