import type { SupabaseClient } from '@supabase/supabase-js';

/** Mesmo SQL de supabase-checkout-receipts-factura.sql: a série «FR AAAA/NNNN», com o ano em hora de Maputo. */
const FUNCAO_SQL = `
CREATE OR REPLACE FUNCTION assign_checkout_receipt_number(p_session_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
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
`;

let pronta = false;
let ultimaTentativa = 0;

/**
 * Garante que a base de dados numera as compras novas como «Factura-Recibo» («FR 2026/0001»; o ano segue a data, em hora de Maputo).
 * Aplica-se sozinha pela função `exec_sql`, uma vez por arranque do site, e é segura de repetir (CREATE OR REPLACE). Se não for possível,
 * o documento sai com a série antiga («RC») e abre como «Recibo» — nada falha. Os números já emitidos nunca mudam.
 */
export async function garantirSerieFactura(admin: SupabaseClient): Promise<void> {
  if (pronta || Date.now() - ultimaTentativa < 60_000) return;
  ultimaTentativa = Date.now();
  try {
    const { error } = await admin.rpc('exec_sql', { sql: FUNCAO_SQL });
    if (error) console.warn('[serie-factura] exec_sql falhou:', error.message);
    else pronta = true;
  } catch (e) {
    console.warn('[serie-factura] exec_sql indisponível:', e instanceof Error ? e.message : e);
  }
}
