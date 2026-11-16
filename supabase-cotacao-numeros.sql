-- Numeração sequencial das cotações da calculadora — o mesmo modelo da factura (supabase-quotation-invoices.sql): um contador por ano civil,
-- incrementado de forma atómica, sem falhas e imutável. Uma cotação (chave) recebe o seu número uma única vez; pedir de novo devolve o mesmo.
-- A chave é o batch_id da encomenda do site, ou um identificador gerado para uma cotação livre. Só o servidor (service role) lê e escreve.
CREATE TABLE IF NOT EXISTS cotacao_counters (
  year INTEGER PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cotacoes_emitidas (
  chave TEXT PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  series_year INTEGER NOT NULL,
  sequence_number INTEGER NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cotacao_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotacoes_emitidas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION assign_cotacao_number(p_chave TEXT)
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
  SELECT numero INTO v_existing FROM cotacoes_emitidas WHERE chave = p_chave;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO cotacao_counters (year, last_sequence) VALUES (v_year, 0) ON CONFLICT (year) DO NOTHING;

  UPDATE cotacao_counters SET last_sequence = last_sequence + 1 WHERE year = v_year RETURNING last_sequence INTO v_seq;

  v_number := 'COT ' || v_year || '/' || LPAD(v_seq::TEXT, 4, '0');

  INSERT INTO cotacoes_emitidas (chave, numero, series_year, sequence_number) VALUES (p_chave, v_number, v_year, v_seq);

  RETURN v_number;
END;
$$;
