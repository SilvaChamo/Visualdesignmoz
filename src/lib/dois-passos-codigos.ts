// Códigos de recuperação da autenticação em 2 passos (Silva, 21/10/2026): códigos de uso único para entrar quando a pessoa
// não tem a aplicação (telemóvel perdido). Guardam-se só os "hashes" (nunca os códigos) em app_metadata, que só o servidor
// escreve — o user_metadata seria editável pela própria pessoa, e quem só tivesse a palavra-passe podia pôr lá um código seu.
// Usar um código desliga os 2 passos da conta (a pessoa volta a ligá-los com a aplicação nova).
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const CHAVE_CODIGOS = 'vh_codigos_2p';
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
export const NUM_CODIGOS = 8;

const normalizar = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '');
export const hashCodigo = (uid: string, codigo: string) => createHash('sha256').update(uid + ':' + normalizar(codigo)).digest('hex');

/** Códigos novos no formato xxxxx-xxxxx (≈ 50 bits cada) */
export function novosCodigos(n = NUM_CODIGOS): string[] {
  const parte = () => Array.from({ length: 5 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
  return Array.from({ length: n }, () => parte() + '-' + parte());
}

export const hashesDe = (app: Record<string, unknown> | undefined): string[] => (Array.isArray(app?.[CHAVE_CODIGOS]) ? (app![CHAVE_CODIGOS] as string[]) : []);

export const igual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Guarda os hashes (junta aos outros campos de app_metadata, que não se perdem) */
export async function guardarHashes(sb: SupabaseClient, uid: string, hashes: string[]) {
  const { data } = await sb.auth.admin.getUserById(uid);
  return sb.auth.admin.updateUserById(uid, { app_metadata: { ...(data?.user?.app_metadata || {}), [CHAVE_CODIGOS]: hashes } });
}

/** Desliga os 2 passos da conta: apaga os factores TOTP e os códigos */
export async function desligarDoisPassos(sb: SupabaseClient, uid: string) {
  const { data } = await sb.auth.admin.mfa.listFactors({ userId: uid });
  for (const f of data?.factors || []) await sb.auth.admin.mfa.deleteFactor({ id: f.id, userId: uid });
  await guardarHashes(sb, uid, []);
}

/** Quantas tentativas com códigos de recuperação por pessoa (em memória; o servidor é um só) */
const tentativas = new Map<string, { n: number; desde: number }>();
export function tentativaPermitida(uid: string, max = 5, janelaMs = 15 * 60_000): boolean {
  const agora = Date.now();
  const t = tentativas.get(uid);
  if (!t || agora - t.desde > janelaMs) {
    tentativas.set(uid, { n: 1, desde: agora });
    return true;
  }
  t.n += 1;
  return t.n <= max;
}
