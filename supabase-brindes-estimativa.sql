-- Percentagens do valor estimado por unidade dos brindes (/brindes), editáveis em Admin › Contabilidade › Calculadora.
-- Uma só linha (id = 1). Sem ela, o site usa os valores de partida de src/lib/preco-brindes.ts.
-- Lida e escrita só pelo servidor (service role); sem políticas, a chave pública não acede.
CREATE TABLE IF NOT EXISTS brindes_estimativa (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  erro_pct NUMERIC(6,2) NOT NULL,
  transporte_pct NUMERIC(6,2) NOT NULL,
  direitos_pct NUMERIC(6,2) NOT NULL,
  margem_pct NUMERIC(6,2) NOT NULL CHECK (margem_pct < 100),
  iva_pct NUMERIC(6,2) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE brindes_estimativa ENABLE ROW LEVEL SECURITY;
