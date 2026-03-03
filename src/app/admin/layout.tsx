import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
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
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
            },
        }
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
