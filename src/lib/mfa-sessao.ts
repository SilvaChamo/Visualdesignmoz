// Autenticação em 2 passos (opcional, Silva, 21/10/2026): quem a ligou (um factor TOTP confirmado no Supabase) só abre o
// painel com a sessão no nível aal2, ou seja, depois de escrever o código da aplicação além da palavra-passe. Uma sessão
// só com a palavra-passe (aal1) fica barrada em todas as rotas do painel com o código 428.
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/** Nível da sessão (aal1 só palavra-passe, aal2 com o código) lido do token — o token já foi validado pelo getUser() */
function nivelDoToken(token?: string | null): string {
  try {
    const corpo = JSON.parse(Buffer.from(String(token).split('.')[1] || '', 'base64url').toString('utf8')) as { aal?: string };
    return corpo.aal || 'aal1';
  } catch {
    return 'aal1';
  }
}

/** A conta tem 2 passos ligados? (os factores vêm do getUser, sempre fresco: desligar tem efeito logo) */
export const temDoisPassos = (user: User | null | undefined) => !!user?.factors?.some((f) => f.factor_type === 'totp' && f.status === 'verified');

/** true quando a conta tem 2 passos ligados e esta sessão ainda não escreveu o código */
export async function faltaCodigoDoisPassos(supabase: SupabaseClient, user: User | null | undefined): Promise<boolean> {
  if (!temDoisPassos(user)) return false;
  const { data } = await supabase.auth.getSession();
  return nivelDoToken(data.session?.access_token) !== 'aal2';
}

/** A resposta das rotas do painel a uma sessão a que falta o código (o painel mostra o ecrã do código) */
export const respostaFaltaCodigo = () =>
  NextResponse.json({ erro: 'Escreva o código da aplicação de autenticação para continuar.', codigo: 428, doisPassos: true }, { status: 428 });
