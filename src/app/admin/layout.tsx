import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { userBelongsToCurrentPanel } from "@/lib/panel-tenant";
import { resolveRoleForAuthUser } from "@/lib/server-auth-role";

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

    if (!userBelongsToCurrentPanel(user)) {
        notFound();
    }

    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const roleDb =
      serviceUrl && serviceKey
        ? createServiceClient(serviceUrl, serviceKey)
        : supabase;
    const effectiveRole = await resolveRoleForAuthUser(roleDb, user);
    const isExplicitAdmin = adminEmails.includes((user.email || '').toLowerCase());

    if (effectiveRole !== 'admin' && !isExplicitAdmin) {
        notFound();
    }

    return <>{children}</>;
}
