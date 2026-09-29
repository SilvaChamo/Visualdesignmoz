import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { applySharedAuthCookieOptions } from "@/lib/panel-origin";

export async function createClient() {
    const cookieStore = await cookies();
    const headerStore = await headers();
    const hostname = headerStore.get("host") ?? undefined;

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(
                                name,
                                value,
                                applySharedAuthCookieOptions(options, hostname),
                            )
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
}

/**
 * Sessão só depois de validada pelo servidor de auth. O `getSession()` lê o cookie tal
 * como veio do browser, sem verificar a assinatura — um cookie forjado com o email de
 * outra pessoa passava. Aqui o `getUser()` confirma o token primeiro e é esse utilizador
 * (e não o que vinha no cookie) que fica em `session.user`.
 */
export async function getVerifiedSession(supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    return { ...session, user };
}
