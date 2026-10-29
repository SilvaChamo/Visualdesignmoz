import type { SupabaseClient } from '@supabase/supabase-js';

const MIGRATION_SQL = `
ALTER TABLE checkout_sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS cadastro JSONB;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS token_acesso TEXT;
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_token_acesso ON checkout_sessions(token_acesso) WHERE token_acesso IS NOT NULL;
`;

let pronto = false;
let ultimaTentativa = 0;

/**
 * Garante que a tabela dos pedidos tem o que a compra de quem ainda não tem conta precisa (`cadastro`, `token_acesso` e dono
 * opcional). Aplica-se sozinha, como as outras tabelas do painel (ver panel-auth-accounts.ts), pela função `exec_sql` da base de
 * dados — ninguém tem de correr SQL à mão. Só acrescenta; nunca apaga nem muda dados. Devolve false se não foi possível.
 * (O mesmo SQL está em supabase-checkout-sessions-sem-conta.sql e corre também no deploy.)
 */
export async function garantirPedidosSemConta(admin: SupabaseClient): Promise<boolean> {
  if (pronto) return true;
  const sondar = async () => {
    const { error } = await admin.from('checkout_sessions').select('cadastro, token_acesso').limit(1);
    return !error;
  };
  if (await sondar()) {
    pronto = true;
    return true;
  }
  // não insiste a cada pedido se a base de dados não tem como aplicar
  if (Date.now() - ultimaTentativa < 60_000) return false;
  ultimaTentativa = Date.now();
  try {
    const { error } = await admin.rpc('exec_sql', { sql: MIGRATION_SQL });
    if (error) console.warn('[checkout-schema] exec_sql falhou:', error.message);
  } catch (e) {
    console.warn('[checkout-schema] exec_sql indisponível:', e instanceof Error ? e.message : e);
  }
  if (await sondar()) {
    pronto = true;
    return true;
  }
  return false;
}
