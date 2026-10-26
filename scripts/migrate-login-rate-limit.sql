-- Rate limiting do login (panel-login) com estado em Postgres.
-- Ver src/lib/login-rate-limit.ts — a app tenta aplicar isto sozinha via
-- RPC exec_sql, mas essa função não existe neste servidor (confirmado
-- 2026-08-03), por isso precisa de ser corrido manualmente aqui (psql /
-- Supabase Studio SQL editor), tal como scripts/migrate-da-sync-mirror.sql.

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

-- Segurança: só o servidor (service_role) mexe nisto. Sem isto, qualquer pessoa com a chave pública do Supabase podia
-- ler as tentativas (IP + e-mail) ou chamar clear_login_attempts para apagar o seu próprio contador e anular o bloqueio.
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE login_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION register_login_attempt(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION clear_login_attempts(TEXT) FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE login_attempts TO service_role;
GRANT EXECUTE ON FUNCTION register_login_attempt(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION clear_login_attempts(TEXT) TO service_role;
