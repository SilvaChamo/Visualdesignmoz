// Códigos de recuperação da autenticação em 2 passos (Silva, 21/10/2026): códigos de uso único para entrar quando a pessoa
// não tem a aplicação (telemóvel perdido). Guardam-se só os "hashes" (nunca os códigos) em app_metadata, que só o servidor
// escreve — o user_metadata seria editável pela própria pessoa, e quem só tivesse a palavra-passe podia pôr lá um código seu.
// O app_metadata, porém, vai dentro do token da sessão: quem só tem a palavra-passe consegue lê-lo. Por isso o hash é uma
// HMAC com um segredo que só o servidor conhece (nunca um SHA simples, que se descobria offline) e os códigos têm 16 caracteres.
// Usar um código desliga os 2 passos da conta (a pessoa volta a ligá-los com a aplicação nova).
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const CHAVE_CODIGOS = 'vh_codigos_2p';
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
export const NUM_CODIGOS = 8;

const normalizar = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Segredo só do servidor para a HMAC: VH_2P_SEGREDO, ou (já existe no servidor, nunca vai para o navegador) a chave de serviço do Supabase */
const segredo = () => process.env.VH_2P_SEGREDO || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const temSegredo = () => segredo().length >= 16;
/** O prefixo v2: marca os hashes novos (HMAC); os antigos (SHA simples, descobríveis offline) já não valem e são apagados */
export const hashCodigo = (uid: string, codigo: string) => 'v2:' + createHmac('sha256', segredo()).update('2p:' + uid + ':' + normalizar(codigo)).digest('hex');

/** Códigos novos no formato xxxx-xxxx-xxxx-xxxx (16 caracteres de 31 ≈ 79 bits cada) */
export function novosCodigos(n = NUM_CODIGOS): string[] {
  const parte = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
  return Array.from({ length: n }, () => [parte(), parte(), parte(), parte()].join('-'));
}

const brutosDe = (app: Record<string, unknown> | undefined): string[] => (Array.isArray(app?.[CHAVE_CODIGOS]) ? (app![CHAVE_CODIGOS] as unknown[]).filter((x): x is string => typeof x === 'string') : []);
export const hashesDe = (app: Record<string, unknown> | undefined): string[] => brutosDe(app).filter((h) => h.startsWith('v2:'));
/** Há hashes antigos (sem v2:) guardados? */
export const temHashesAntigos = (app: Record<string, unknown> | undefined) => brutosDe(app).length !== hashesDe(app).length;

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
