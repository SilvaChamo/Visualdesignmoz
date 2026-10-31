-- Factura-Recibo (Silva, 31/10/2026): os documentos novos das compras do carrinho passam a chamar-se «Factura-Recibo» e a série passa
-- de «RC AAAA/NNNN» a «FR AAAA/NNNN». O ano é o ano corrente em hora de Maputo (não é fixo: em 2027 a série recomeça em 0001 sozinha,
-- porque cada ano tem o seu contador em checkout_receipt_counters). Os documentos já emitidos (RC) ficam como estão. O mesmo SQL
-- aplica-se sozinho pela função exec_sql (src/lib/serie-factura.ts) na primeira vez que se abre um documento; ninguém corre SQL à mão.

CREATE OR REPLACE FUNCTION assign_checkout_receipt_number(p_session_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing TEXT;
  v_year INTEGER := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Africa/Maputo'))::INTEGER;
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

  v_number := 'FR ' || v_year || '/' || LPAD(v_seq::TEXT, 4, '0');

  INSERT INTO checkout_receipts (session_id, user_id, receipt_number, series_year, sequence_number)
  VALUES (p_session_id, p_user_id, v_number, v_year, v_seq);

  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION assign_checkout_receipt_number(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION assign_checkout_receipt_number(UUID, UUID) TO service_role;
