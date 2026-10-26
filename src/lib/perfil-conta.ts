import type { SupabaseClient } from '@supabase/supabase-js';
import { profileAuthOrFilter } from '@/lib/profile-db';

/**
 * O perfil é o centro de dados da conta (Silva, 26/10/2026): tudo o que precisa
 * do nome, telefone, e-mail ou empresa de uma conta (e-mails, avisos…) consulta
 * isto, em vez de usar texto escrito noutro sítio. Junta a tabela `profiles` (o
 * que o painel grava) e os dados da conta (user_metadata), para nenhum campo ficar
 * por preencher; o que não existir vem vazio.
 */
export type PerfilConta = {
  nome: string;
  email: string;
  telefone: string;
  empresa: string;
};

export async function carregarPerfilConta(admin: SupabaseClient, userId: string): Promise<PerfilConta | null> {
  if (!userId) return null;
  try {
    const [{ data: perfil }, { data: conta }] = await Promise.all([
      admin.from('profiles').select('name, email, telefone, empresa').or(profileAuthOrFilter(userId)).limit(1).maybeSingle(),
      admin.auth.admin.getUserById(userId),
    ]);
    const p = (perfil || {}) as { name?: string | null; email?: string | null; telefone?: string | null; empresa?: string | null };
    const meta = (conta?.user?.user_metadata || {}) as Record<string, unknown>;
    const texto = (...valores: unknown[]) => {
      for (const v of valores) if (typeof v === 'string' && v.trim()) return v.trim();
      return '';
    };
    const resultado: PerfilConta = {
      nome: texto(p.name, meta.nome, meta.full_name),
      email: texto(p.email, conta?.user?.email),
      telefone: texto(p.telefone, meta.telefone),
      empresa: texto(p.empresa, meta.empresa),
    };
    return resultado.nome || resultado.email || resultado.telefone || resultado.empresa ? resultado : null;
  } catch (err) {
    console.error('[perfil-conta] falha ao ler o perfil:', err);
    return null;
  }
}

/** Nome para tratar a pessoa num e-mail: o do perfil (ou a empresa) e, só sem perfil, o que o chamador tiver. */
export async function nomeDoPerfil(admin: SupabaseClient | null, userId: string | null | undefined, reserva: string): Promise<string> {
  if (!admin || !userId) return reserva;
  const perfil = await carregarPerfilConta(admin, userId);
  return perfil?.nome || perfil?.empresa || reserva;
}
