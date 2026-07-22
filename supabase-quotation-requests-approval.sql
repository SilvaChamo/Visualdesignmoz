-- Suporte a aprovação/rejeição de encomendas (quotation_requests) no dashboard.
-- Novos valores de status usados pela app (sem migração de coluna, é VARCHAR livre):
--   'approved'  — encomenda aprovada pela equipa, produção pode avançar
--   'rejected'  — encomenda rejeitada, motivo guardado em rejection_reason
ALTER TABLE quotation_requests
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
