-- Numeração sequencial de Recibo para as compras do carrinho (checkout_sessions)
-- — distinta de quotation_invoices (encomendas) e de renewal_invoices
-- (renovações). Um recibo por compra paga: emitido uma única vez, na primeira
-- vez que o recibo é aberto depois de o pagamento estar confirmado (ver
-- src/app/recibo/[id]/page.tsx), e o mesmo número aparece sempre a seguir.
-- Sem certificação AT/SAF-T — tal como as outras séries, só garante uma série
-- sequencial, sem falhas e imutável (ver supabase-quotation-invoices.sql).

-- Contador por ano civil — uma linha por ano, incrementada atomicamente.
CREATE TABLE IF NOT EXISTS checkout_receipt_counters (
  year INTEGER PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0
);

-- Sem FK/CASCADE para checkout_sessions: um recibo já emitido tem de
-- sobreviver mesmo que a compra venha a ser apagada mais tarde.
CREATE TABLE IF NOT EXISTS checkout_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE,
  user_id UUID,
  receipt_number TEXT NOT NULL UNIQUE,
  series_year INTEGER NOT NULL,
  sequence_number INTEGER NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_receipts_user_id ON checkout_receipts(user_id);

ALTER TABLE checkout_receipt_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_receipts ENABLE ROW LEVEL SECURITY;

-- Só o servidor (service role) lê/escreve o contador — nunca exposto ao browser.
CREATE POLICY checkout_receipt_counters_admin ON checkout_receipt_counters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY checkout_receipts_own ON checkout_receipts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY checkout_receipts_admin ON checkout_receipts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Escrita feita apenas pelo servidor (service role) via esta função, nunca
-- directamente pelo browser.

-- Idempotente: se a compra já tiver recibo emitido, devolve o número
-- existente em vez de criar outro. Incremento atómico do contador do ano
-- corrente (o UPDATE bloqueia a linha até ao commit, o que já serializa
-- chamadas concorrentes no Postgres).
CREATE OR REPLACE FUNCTION assign_checkout_receipt_number(p_session_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing TEXT;
  v_year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  v_seq INTEGER;
  v_number TEXT;
BEGIN
  SELECT receipt_number INTO v_existing
  FROM checkout_receipts
  WHERE session_id = p_session_id;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO checkout_receipt_counters (year, last_sequence)
  VALUES (v_year, 0)
  ON CONFLICT (year) DO NOTHING;

  UPDATE checkout_receipt_counters
  SET last_sequence = last_sequence + 1
  WHERE year = v_year
  RETURNING last_sequence INTO v_seq;

  v_number := 'RC ' || v_year || '/' || LPAD(v_seq::TEXT, 4, '0');

  INSERT INTO checkout_receipts (session_id, user_id, receipt_number, series_year, sequence_number)
  VALUES (p_session_id, p_user_id, v_number, v_year, v_seq);

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION assign_checkout_receipt_number(UUID, UUID) FROM PUBLIC, anon, authenticated;
