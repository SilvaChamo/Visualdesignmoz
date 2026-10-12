/**
 * Rate limiting do login (panel-login) com estado em Postgres — substitui o
 * Map em memória do middleware, que perdia tudo a cada restart e não servia
 * para nada num cenário com mais do que um processo. O contador é
 * incrementado de forma atómica (UPSERT dentro da função SQL), para não
 * perder tentativas em concorrência.
 */

import { createClient } from '@supabase/supabase-js';

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 5 * 60;
const BLOCK_SECONDS = 15 * 60;

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

export function loginRateLimitKey(request: Request, email: string): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  return `${ip}:${email.toLowerCase().trim()}`;
}

/**
 * Regista uma tentativa e diz se está bloqueada. Falha aberta (permite o
 * pedido) se a base de dados estiver indisponível — nunca deve impedir
 * logins legítimos por causa de uma falha de infra-estrutura.
 */
export async function checkAndRegisterLoginAttempt(
  key: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
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
