-- Pedidos de Cotação (VisualDesign) — gerados a partir da tabela de preços em /precos.
CREATE TABLE IF NOT EXISTS quotation_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa VARCHAR(255) NOT NULL,
  nif VARCHAR(50),
  responsavel VARCHAR(255) NOT NULL,
  cargo VARCHAR(100),
  telefone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  categoria_id VARCHAR(50) NOT NULL,
  categoria_label VARCHAR(255) NOT NULL,
  produto VARCHAR(255) NOT NULL,
  preco_unitario_mt DECIMAL(10,2) NOT NULL,
  quantidade DECIMAL(10,2) NOT NULL,
  data_limite_entrega DATE NOT NULL,
  total_mt DECIMAL(10,2) NOT NULL,
  metodo_pagamento VARCHAR(20), -- 'mpesa', 'transferencia'
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'payment_selected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotation_requests_user_id ON quotation_requests(user_id);

ALTER TABLE quotation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotation_requests_own ON quotation_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY quotation_requests_admin ON quotation_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Escrita feita apenas pelo servidor (service role), nunca directamente pelo browser.
