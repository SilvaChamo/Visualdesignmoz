-- Tabela de Notificações para Clientes
-- Execute no SQL Editor do Supabase

-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('general', 'email', 'domain', 'payment', 'support', 'system')),
    read BOOLEAN DEFAULT false,
    email_sent BOOLEAN DEFAULT false,
    link VARCHAR(500),
    link_text VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notifications ON notifications;
CREATE TRIGGER trigger_update_notifications
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- Função para marcar como lida
CREATE OR REPLACE FUNCTION mark_notification_as_read(notification_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications 
    SET read = true, read_at = NOW()
    WHERE id = notification_id AND user_id = user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar notificação para todos os usuários (admin)
CREATE OR REPLACE FUNCTION create_notification_for_all(
    p_title VARCHAR,
    p_message TEXT,
    p_type VARCHAR DEFAULT 'info',
    p_category VARCHAR DEFAULT 'general',
    p_link VARCHAR DEFAULT NULL,
    p_link_text VARCHAR DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER := 0;
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM auth.users LOOP
        INSERT INTO notifications (user_id, title, message, type, category, link, link_text)
        VALUES (user_record.id, p_title, p_message, p_type, p_category, p_link, p_link_text);
        affected_rows := affected_rows + 1;
    END LOOP;
    
    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS (Row Level Security)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications (mark as read)"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert notifications for any user"
    ON notifications FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can delete any notification"
    ON notifications FOR DELETE
    USING (auth.uid() IN (
        SELECT id FROM auth.users 
        WHERE email IN ('admin@visualdesignmoz.com', 'silva.chamo@gmail.com')
    ));

-- Comentários
COMMENT ON TABLE notifications IS 'Sistema de notificações para clientes';
COMMENT ON COLUMN notifications.type IS 'Tipo: info, success, warning, error';
COMMENT ON COLUMN notifications.category IS 'Categoria: general, email, domain, payment, support, system';
COMMENT ON COLUMN notifications.read IS 'Se a notificação foi lida pelo usuário';
COMMENT ON COLUMN notifications.email_sent IS 'Se um email foi enviado sobre esta notificação';
