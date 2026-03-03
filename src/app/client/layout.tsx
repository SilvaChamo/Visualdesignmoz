import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export default async function ClientLayout({
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

    return <>{children}</>;
}
