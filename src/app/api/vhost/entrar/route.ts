import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAndRegisterLoginAttempt, clearLoginAttempts, loginRateLimitKey } from '@/lib/login-rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vhost/entrar  { utilizador, senha } — entrada no painel com o nome de utilizador (o mesmo do DA/Hestia,
 * guardado em profiles.da_username; pedido do Silva a 11/10: "entrar com o nome de utilizador ou e-mail").
 * Procura o e-mail desse perfil e confirma a palavra-passe; só então devolve o e-mail, para a página de entrada
 * entrar com ele (auth.signIn). Sem a palavra-passe certa responde sempre o mesmo: não dá para descobrir e-mails.
 */
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = String(b.utilizador || '').trim().toLowerCase();
  const senha = String(b.senha || '');
  const falha = () => NextResponse.json({ erro: 'Utilizador ou palavra-passe errados.' }, { status: 401 });
  if (!senha || !/^[a-z0-9._-]{1,64}$/.test(nome)) return falha();

  const chave = loginRateLimitKey(req, 'utilizador:' + nome);
  const limite = await checkAndRegisterLoginAttempt(chave);
  if (!limite.allowed) {
    return NextResponse.json({ erro: 'Demasiadas tentativas. Tente novamente daqui a alguns minutos.' }, { status: 429, headers: { 'Retry-After': String(limite.retryAfterSeconds) } });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  if (!url || !servico || !anon) return NextResponse.json({ erro: 'Serviço indisponível.' }, { status: 500 });
  const sem = { auth: { persistSession: false, autoRefreshToken: false } };

  // o "_" é um coringa no ilike: escapado (o nome só tem letras, números, ".", "_" e "-")
  const { data: perfis } = await createClient(url, servico, sem).from('profiles').select('email').ilike('da_username', nome.replace(/_/g, '\\_')).limit(2);
  if (!perfis || perfis.length !== 1 || !perfis[0].email) return falha();
  const email = String(perfis[0].email).trim().toLowerCase();

  // confirma a palavra-passe sem criar sessão aqui (a sessão do navegador é criada pela página, com o e-mail)
  const cliente = createClient(url, anon, sem);
  const { data, error } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (error || !data.session) return falha();
  await cliente.auth.signOut({ scope: 'local' }).catch(() => {});
  await clearLoginAttempts(chave);
  return NextResponse.json({ email });
}
