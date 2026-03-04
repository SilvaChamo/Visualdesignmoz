import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";

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

    return <>{children}</>;
}
