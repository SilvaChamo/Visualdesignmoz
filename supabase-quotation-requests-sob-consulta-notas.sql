-- Regista no repositório colunas que já existem em produção (Hetzner) mas não
-- tinham migração associada: sob_consulta (serviços com preço "Sob Consulta")
-- e notas (detalhes/serviços adicionais indicados pelo cliente no formulário).
ALTER TABLE quotation_requests
  ADD COLUMN IF NOT EXISTS sob_consulta BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notas TEXT;
