-- O valor dos brindes (/brindes) vem da calculadora (Admin › Contabilidade › Calculadora): ela grava aqui, sozinha, a configuração (custos da remessa,
-- margens, direitos, imposto) sempre que se altera um valor. Uma só linha (id = 1), na coluna `calculo`. Só o servidor (service role) lê e escreve.
CREATE TABLE IF NOT EXISTS brindes_custos_remessa (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  calculo JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);
-- a primeira versão da tabela tinha uma coluna por custo; a configuração completa fica toda em `calculo`
ALTER TABLE brindes_custos_remessa ADD COLUMN IF NOT EXISTS calculo JSONB;

ALTER TABLE brindes_custos_remessa ENABLE ROW LEVEL SECURITY;
