import type { SupabaseClient } from '@supabase/supabase-js';

/** Mensagem quando o e-mail já tem conta (registo e verificação do 1.º passo do registo) */
export const EXISTING_ACCOUNT_MESSAGE = 'Já existe uma conta com este email. Use «Entrar» em vez de «Criar conta».';

/** Há já uma conta (Supabase Auth) com este e-mail? `email` já em minúsculas e sem espaços. */
export async function authUserExists(admin: SupabaseClient, email: string): Promise<boolean> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    if (data.users.some((u) => u.email?.toLowerCase() === email)) return true;
    if (data.users.length < 1000) return false;
  }
  return false;
}
