import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Painel Admin",
    robots: 'noindex, nofollow',
};

const adminEmails = ['admin@visualdesigne.com', 'silva.chamo@gmail.com'];

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        notFound();
    }

    const userRole = user.user_metadata?.role;
    const isExplicitAdmin = adminEmails.includes(user.email || '');

    if (userRole !== 'admin' && !isExplicitAdmin) {
        notFound();
    }

    return <>{children}</>;
}
