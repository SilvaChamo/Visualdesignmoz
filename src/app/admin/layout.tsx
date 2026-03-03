import { createClient } from "@supabase/supabase-js";
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
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        notFound();
    }

    const userRole = session.user?.user_metadata?.role;
    const isExplicitAdmin = adminEmails.includes(session.user?.email || '');

    if (userRole !== 'admin' && !isExplicitAdmin) {
        notFound();
    }

    return <>{children}</>;
}
