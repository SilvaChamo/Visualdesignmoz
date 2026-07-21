-- Campos institucionais adicionais para quotation_requests (NIF já existia).
ALTER TABLE quotation_requests
  ADD COLUMN IF NOT EXISTS endereco VARCHAR(255),
  ADD COLUMN IF NOT EXISTS telefone_institucional VARCHAR(50),
  ADD COLUMN IF NOT EXISTS email_institucional VARCHAR(255),
  ADD COLUMN IF NOT EXISTS website VARCHAR(255);
