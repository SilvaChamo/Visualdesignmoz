-- Cópia da cotação da calculadora para o painel do cliente: quando uma encomenda do site está carregada na calculadora (Admin › Contabilidade › Calculadora),
-- a folha da cotação grava-se aqui (HTML pronto a mostrar). O cliente vê só esta cópia em Encomendas › Cotação; qualquer alteração na calculadora actualiza-a.
-- Escrita e leitura só pelo servidor (service role); sem políticas, o navegador não lê nem escreve.
CREATE TABLE IF NOT EXISTS cotacao_site_copia (
  batch_id UUID PRIMARY KEY,
  html TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);
ALTER TABLE cotacao_site_copia ENABLE ROW LEVEL SECURITY;
