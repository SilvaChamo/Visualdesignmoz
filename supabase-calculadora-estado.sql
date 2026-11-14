-- Calculadora de custo de importação (Admin › Contabilidade › Calculadora): guarda no servidor o que o Silva deixa na calculadora (os produtos da lista)
-- e a cotação ao cliente (tabela editada, campos do cliente), para não se perderem nem voltarem ao exemplo. Uma linha por `chave` ('calculadora', 'cotacao').
-- Só o servidor (service role) lê e escreve.
CREATE TABLE IF NOT EXISTS calculadora_estado (
  chave TEXT PRIMARY KEY CHECK (chave IN ('calculadora', 'cotacao')),
  estado JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);
ALTER TABLE calculadora_estado ENABLE ROW LEVEL SECURITY;
