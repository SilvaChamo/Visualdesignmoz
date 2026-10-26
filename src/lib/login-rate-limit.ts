/**
 * Rate limiting do login (panel-login) com estado em Postgres — substitui o
 * Map em memória do middleware, que perdia tudo a cada restart e não servia
 * para nada num cenário com mais do que um processo. O contador é
 * incrementado de forma atómica (UPSERT dentro da função SQL), para não
 * perder tentativas em concorrência.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/** Ligado outra vez a 26/10/2026 (esteve desligado desde 13/10, quando o bloqueio de 15 min impedia o Silva de entrar
 *  enquanto se corrigia o login). Só funciona com a tabela e as funções criadas na base de dados
 *  (`scripts/migrate-login-rate-limit.sql`): sem elas falha "aberto" e deixa entrar. */
export const BLOQUEIO_POR_TENTATIVAS_ATIVO = true;

// A função SQL bloqueia na tentativa de ordem MAX_ATTEMPTS: com 6, as 5 primeiras falhadas passam e a 6.ª já fica bloqueada
const MAX_ATTEMPTS = 6;
const WINDOW_SECONDS = 5 * 60;
const BLOCK_SECONDS = 15 * 60;

/** Aviso de bloqueio, numa linha, igual em todos os logins (`segundos` vem do `Retry-After`). */
export function mensagemBloqueio(segundos: number): string {
  const minutos = Math.max(1, Math.ceil((segundos || BLOCK_SECONDS) / 60));
  return `Bloqueado por tentativas falhadas. Volte a tentar daqui a ${minutos} min.`;
}

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_key TEXT PRIMARY KEY,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION register_login_attempt(
  p_key TEXT,
  p_window_seconds INTEGER,
  p_max_attempts INTEGER,
  p_block_seconds INTEGER
) RETURNS TABLE(allowed BOOLEAN, retry_after_seconds INTEGER) AS $$
DECLARE
  v_row login_attempts%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_next_count INTEGER;
BEGIN
  INSERT INTO login_attempts (attempt_key, attempt_count, window_start)
  VALUES (p_key, 1, v_now)
  ON CONFLICT (attempt_key) DO UPDATE SET
    attempt_count = CASE
      WHEN login_attempts.blocked_until IS NOT NULL AND login_attempts.blocked_until > v_now
        THEN login_attempts.attempt_count
      WHEN login_attempts.window_start < v_now - (p_window_seconds || ' seconds')::interval
        THEN 1
      ELSE login_attempts.attempt_count + 1
    END,
    window_start = CASE
      WHEN login_attempts.blocked_until IS NOT NULL AND login_attempts.blocked_until > v_now
        THEN login_attempts.window_start
      WHEN login_attempts.window_start < v_now - (p_window_seconds || ' seconds')::interval
        THEN v_now
      ELSE login_attempts.window_start
    END,
    blocked_until = CASE
      WHEN login_attempts.blocked_until IS NOT NULL AND login_attempts.blocked_until > v_now
        THEN login_attempts.blocked_until
      WHEN (
        CASE
          WHEN login_attempts.window_start < v_now - (p_window_seconds || ' seconds')::interval THEN 1
          ELSE login_attempts.attempt_count + 1
        END
      ) >= p_max_attempts
        THEN v_now + (p_block_seconds || ' seconds')::interval
      ELSE NULL
    END
  RETURNING * INTO v_row;

  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
    RETURN QUERY SELECT FALSE, CEIL(EXTRACT(EPOCH FROM (v_row.blocked_until - v_now)))::INTEGER;
  ELSE
    RETURN QUERY SELECT TRUE, 0;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION clear_login_attempts(p_key TEXT) RETURNS VOID AS $$
  DELETE FROM login_attempts WHERE attempt_key = p_key;
$$ LANGUAGE sql;

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE login_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION register_login_attempt(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION clear_login_attempts(TEXT) FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE login_attempts TO service_role;
GRANT EXECUTE ON FUNCTION register_login_attempt(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION clear_login_attempts(TEXT) TO service_role;
`;

let schemaReady = false;

/** Sem isto, um RPC Supabase que não responde deixa o botão Entrar a girar para sempre. */
function comTempo<T>(p: PromiseLike<T>, ms: number): Promise<T | null> {
  return Promise.race([
    Promise.resolve(p).then((v) => v as T | null).catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), ms)),
  ]);
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function ensureLoginRateLimitSchema(): Promise<boolean> {
  if (schemaReady) return true;
  const admin = adminClient();
  if (!admin) return false;
  try {
    const res = await comTempo(admin.rpc('exec_sql', { sql: MIGRATION_SQL }), 3_000);
    if (res && !res.error) {
      schemaReady = true;
      return true;
    }
  } catch {
    /* RPC pode não existir neste momento */
  }
  console.warn('[login-rate-limit] Execute scripts/migrate-login-rate-limit.sql no Supabase.');
  return false;
}

/** IP do visitante. O `x-real-ip` é posto pelo nginx com o IP verdadeiro e substitui o que o visitante mandar (o painel só se alcança
 *  por ele: a porta 3002 não responde de fora). O `x-forwarded-for` não serve: o nginx acrescenta ao que o visitante escreveu, e
 *  ele podia fugir ao limite com um IP por tentativa, ou bloquear outra pessoa de propósito (Silva, 26/10/2026). Sem `x-real-ip`
 *  (ambiente local) cai para o `x-forwarded-for`. */
function ipDoPedido(request: Request): string {
  return request.headers.get('x-real-ip')?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/** IPs que nunca ficam bloqueados (o do Silva, "nunca bloquear o meu IP", 26/10/2026): as mesmas linhas de /etc/vd-banir.permitidos,
 *  que o vd-banir-ips respeita e onde se acrescenta o IP novo quando mudar. Lê-se do disco e guarda-se 60 s; sem o ficheiro (ambiente
 *  local) ninguém é isento. */
let ipsLivres: { ate: number; ips: Set<string> } | null = null;
function ipIsentoDeBloqueio(ip: string): boolean {
  if (!ipsLivres || ipsLivres.ate < Date.now()) {
    const ips = new Set<string>();
    try {
      for (const linha of readFileSync(process.env.VD_PERMITIDOS || '/etc/vd-banir.permitidos', 'utf8').split('\n')) {
        const v = linha.replace(/#.*/, '').trim();
        if (/^[0-9a-f:.]+$/i.test(v)) ips.add(v.toLowerCase());
      }
    } catch {
      /* sem ficheiro: ninguém é isento */
    }
    ipsLivres = { ate: Date.now() + 60_000, ips };
  }
  return ipsLivres.ips.has(ip.toLowerCase());
}

const PREFIXO_LIVRE = 'livre|';

export function loginRateLimitKey(request: Request, email: string): string {
  const ip = ipDoPedido(request);
  return `${ipIsentoDeBloqueio(ip) ? PREFIXO_LIVRE : ''}${ip}:${email.toLowerCase().trim()}`;
}

/**
 * Regista uma tentativa e diz se está bloqueada. Falha aberta (permite o
 * pedido) se a base de dados estiver indisponível — nunca deve impedir
 * logins legítimos por causa de uma falha de infra-estrutura.
 */
export async function checkAndRegisterLoginAttempt(
  key: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (!BLOQUEIO_POR_TENTATIVAS_ATIVO) return { allowed: true, retryAfterSeconds: 0 };
  if (key.startsWith(PREFIXO_LIVRE)) return { allowed: true, retryAfterSeconds: 0 }; // IP isento: nunca se conta nem bloqueia
  const admin = adminClient();
  if (!admin) return { allowed: true, retryAfterSeconds: 0 };

  await ensureLoginRateLimitSchema();

  try {
    const res = await comTempo(
      admin.rpc('register_login_attempt', {
        p_key: key,
        p_window_seconds: WINDOW_SECONDS,
        p_max_attempts: MAX_ATTEMPTS,
        p_block_seconds: BLOCK_SECONDS,
      }),
      3_000,
    );
    if (!res) return { allowed: true, retryAfterSeconds: 0 };
    const { data, error } = res;
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: Boolean(row.allowed), retryAfterSeconds: Number(row.retry_after_seconds) || 0 };
  } catch {
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export async function clearLoginAttempts(key: string): Promise<void> {
  const admin = adminClient();
  if (!admin) return;
  try {
    await comTempo(admin.rpc('clear_login_attempts', { p_key: key }), 2_000);
  } catch {
    /* limpeza é best-effort */
  }
}
