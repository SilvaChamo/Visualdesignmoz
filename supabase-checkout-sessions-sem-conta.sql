-- Compras por M-Pesa/Transferência de quem ainda não tem conta (Silva, 29/10/2026): o login do site só se cria quando a equipa
-- aprova o comprovativo. Até lá o pedido não tem dono (user_id vazio), guarda os dados digitados no checkout (`cadastro`, com a
-- palavra-passe cifrada) e uma chave (`token_acesso`) com que o próprio navegador envia o comprovativo. Pode correr várias vezes.
ALTER TABLE checkout_sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS cadastro JSONB;
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS token_acesso TEXT;
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_token_acesso ON checkout_sessions(token_acesso) WHERE token_acesso IS NOT NULL;
