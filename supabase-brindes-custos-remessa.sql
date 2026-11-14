-- Custos fixos da remessa (Calculadora › «Custos da remessa») que se somam ao valor estimado de cada brinde do catálogo (/brindes):
-- o total dos custos ÷ as unidades da remessa = valor somado a cada unidade, antes da margem. Sem valores (tudo a 0) não se soma nada.
-- Uma só linha (id = 1), gravada sozinha pela calculadora sempre que se altera um valor. Só o servidor (service role) lê e escreve.
CREATE TABLE IF NOT EXISTS brindes_custos_remessa (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  frete NUMERIC(14,2) NOT NULL DEFAULT 0,
  seguro NUMERIC(14,2) NOT NULL DEFAULT 0,
  corretor NUMERIC(14,2) NOT NULL DEFAULT 0,
  porto NUMERIC(14,2) NOT NULL DEFAULT 0,
  entrega NUMERIC(14,2) NOT NULL DEFAULT 0,
  entrega_dom NUMERIC(14,2) NOT NULL DEFAULT 0,
  outros NUMERIC(14,2) NOT NULL DEFAULT 0,
  unidades NUMERIC(14,0) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE brindes_custos_remessa ENABLE ROW LEVEL SECURITY;
