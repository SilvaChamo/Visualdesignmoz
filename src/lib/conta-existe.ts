import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

/** Mensagem quando o e-mail já tem conta (registo e verificação do 1.º passo do registo) */
export const EXISTING_ACCOUNT_MESSAGE = 'Já existe uma conta com este email. Use «Entrar» em vez de «Criar conta».';

/** De que e-mail se fala (a compra tem dois: o da pessoa responsável e o da empresa) */
export type PapelEmail = 'responsavel' | 'empresa';

/** Diz qual é o e-mail e de quem é (Silva, 30/10/2026: «não especifica que email, pois tem dois»). */
export function mensagemContaExiste(email: string, papel: PapelEmail = 'responsavel'): string {
  const de = papel === 'empresa' ? 'da empresa' : 'da pessoa responsável';
  return `Já existe uma conta com o e-mail ${email} (e-mail ${de}). Escreva a palavra-passe dessa conta ou use «Entrar».`;
}

/** O utilizador do login (Supabase Auth) com este e-mail, se existir. `email` já em minúsculas e sem espaços. */
export async function utilizadorPorEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const achado = data.users.find((u) => u.email?.toLowerCase() === email);
    if (achado) return achado;
    if (data.users.length < 1000) return null;
  }
  return null;
}

/** Há já um login (Supabase Auth) com este e-mail? `email` já em minúsculas e sem espaços. */
export async function authUserExists(admin: SupabaseClient, email: string): Promise<boolean> {
  return Boolean(await utilizadorPorEmail(admin, email));
}

const PAPEIS_DA_EQUIPA = ['admin', 'manager', 'reseller'];

/**
 * Este login tem uma conta a sério? (Silva, 30/10/2026: «o e-mail existe na base de dados mas não existe uma conta criada com ele;
 * se não existe uma conta real não pode impedir criar conta».) Um login sozinho — de uma compra que ficou a meio, de um teste —
 * não é uma conta: não tem hospedagem no servidor, nenhuma compra paga, nem é da equipa. Esse e-mail pode voltar a ser usado.
 * Em dúvida (falha ao ler), diz que TEM conta: nunca se entrega um login que possa ser de alguém.
 */
export async function temContaReal(admin: SupabaseClient, user: User): Promise<boolean> {
  const papeis = [user.user_metadata?.role, user.app_metadata?.role].map((r) => String(r || ''));
  if (papeis.some((r) => PAPEIS_DA_EQUIPA.includes(r))) return true;
  // entrou por Google ou outro fornecedor: o login é de quem o abriu, não se reaproveita
  if ((user.identities || []).some((i) => i.provider !== 'email')) return true;

  const id = user.id;
  const ler = async (consulta: PromiseLike<{ data: unknown[] | null; error: unknown }>) => {
    const { data, error } = await consulta;
    if (error) throw error;
    return (data || []).length > 0;
  };
  try {
    const sinais = await Promise.all([
      ler(admin.from('profiles').select('id, role, da_username').or(`user_id.eq.${id},id.eq.${id}`).limit(5).then((r) => ({
        data: (r.data || []).filter((p: { role?: string | null; da_username?: string | null }) => String(p.da_username || '').trim() || PAPEIS_DA_EQUIPA.includes(String(p.role || ''))),
        error: r.error,
      }))),
      ler(admin.from('panel_auth_accounts').select('user_id').eq('user_id', id).eq('server_linked', true).limit(1)),
      ler(admin.from('panel_users').select('username').eq('auth_user_id', id).limit(1)),
      ler(admin.from('checkout_sessions').select('id').eq('user_id', id).eq('status', 'paid').limit(1)),
      ler(admin.from('quotation_requests').select('id').eq('user_id', id).limit(1)),
    ]);
    return sinais.some(Boolean);
  } catch (e) {
    console.error('[conta-existe] não foi possível ver se o login tem conta a sério:', e);
    return true;
  }
}

/**
 * O e-mail está mesmo ocupado? Só se tiver um login que seja uma conta a sério. Um login vazio não ocupa o e-mail.
 * (O mesmo e-mail pode ter várias contas de hospedagem: o login é um só, as contas são as do servidor.)
 */
export async function emailOcupadoPorContaReal(admin: SupabaseClient, email: string): Promise<boolean> {
  const user = await utilizadorPorEmail(admin, email);
  return user ? temContaReal(admin, user) : false;
}

/** A palavra-passe é a do login deste e-mail? (verifica sem abrir sessão nenhuma neste pedido) */
export async function senhaConfere(email: string, senha: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || !senha) return false;
  const cliente = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
  return !error;
}
