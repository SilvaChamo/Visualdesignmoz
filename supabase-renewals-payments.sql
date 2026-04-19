-- Tabela de Métodos de Pagamento do Cliente
CREATE TABLE IF NOT EXISTS user_payment_methods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'mpesa', 'cartao', 'transferencia', 'paypal'
  provider VARCHAR(100), -- 'Vodacom', 'Standard Bank', etc
  account_number VARCHAR(255), -- Número M-Pesa ou últimos 4 dígitos do cartão
  account_name VARCHAR(255),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}', -- Dados extras específicos do método
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Pagamentos de Renovação
CREATE TABLE IF NOT EXISTS renewal_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  renewal_id UUID NOT NULL, -- Pode referenciar domain_renewals ou hosting_renewals
  renewal_type VARCHAR(20) NOT NULL, -- 'domain' ou 'hosting'
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'MZN',
  payment_method_id UUID REFERENCES user_payment_methods(id),
  payment_method_type VARCHAR(50), -- 'mpesa', 'cartao', etc
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'refunded'
  transaction_id VARCHAR(255), -- ID da transação no gateway de pagamento
  gateway_response JSONB DEFAULT '{}', -- Resposta completa do gateway
  paid_at TIMESTAMP WITH TIME ZONE,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Configurações de Pagamento
CREATE TABLE IF NOT EXISTS payment_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  provider VARCHAR(100) NOT NULL, -- 'mpesa', 'stripe', 'paypal'
  is_active BOOLEAN DEFAULT false,
  test_mode BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}', -- API keys, secrets, etc
  fees_percentage DECIMAL(5,2) DEFAULT 0,
  fees_fixed DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user_id ON user_payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_renewal_payments_user_id ON renewal_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_renewal_payments_status ON renewal_payments(status);
CREATE INDEX IF NOT EXISTS idx_renewal_payments_renewal ON renewal_payments(renewal_id, renewal_type);

-- RLS Policies
ALTER TABLE user_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

-- Usuário só vê seus próprios métodos de pagamento
CREATE POLICY user_payment_methods_own ON user_payment_methods
  FOR ALL USING (user_id = auth.uid());

-- Usuário só vê seus próprios pagamentos
CREATE POLICY renewal_payments_own ON renewal_payments
  FOR ALL USING (user_id = auth.uid());

-- Admins veem todos os pagamentos
CREATE POLICY renewal_payments_admin ON renewal_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Função para atualizar timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_user_payment_methods_updated_at 
  BEFORE UPDATE ON user_payment_methods 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_renewal_payments_updated_at 
  BEFORE UPDATE ON renewal_payments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir configurações padrão
INSERT INTO payment_settings (provider, is_active, test_mode, config, fees_percentage, fees_fixed)
VALUES 
  ('mpesa', false, true, '{"api_key": "", "public_key": "", "service_provider_code": ""}', 0, 0),
  ('stripe', false, true, '{"public_key": "", "secret_key": ""}', 2.9, 0.30),
  ('paypal', false, true, '{"client_id": "", "client_secret": ""}', 2.9, 0.30)
ON CONFLICT DO NOTHING;
