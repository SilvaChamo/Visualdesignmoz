-- Checkout Sessions (Stripe) — carrinho fica "pending" até o webhook confirmar o pagamento.
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  total_mt DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'usd',
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'expired'
  stripe_session_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255),
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_user_id ON checkout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_stripe_session_id ON checkout_sessions(stripe_session_id);

ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY checkout_sessions_own ON checkout_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY checkout_sessions_admin ON checkout_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Escrita feita apenas pelo servidor (service role), nunca directamente pelo browser.
