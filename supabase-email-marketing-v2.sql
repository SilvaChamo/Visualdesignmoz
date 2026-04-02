-- Update Email Marketing Schema to match Baseagrodata advanced features

-- 1. Update email_campaigns for baseagrodata features
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS target_audiences JSONB DEFAULT '[]'::jsonb;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS sender_email TEXT;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}'::text[];

-- 2. Create messages table (for internal logging and notification reference)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    sender_email TEXT,
    target_roles TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create notifications table for in-app alerts
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for new tables
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Admin Policies for messages/notifications
CREATE POLICY "Admins can manage messages" ON messages
    FOR ALL USING (auth.jwt() ->> 'email' IN ('admin@visualdesigne.com', 'geral@visualdesigne.com', 'silva.chamo@gmail.com', 'silva.chamo@visualdesigne.com'));

CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications" ON notifications
    FOR ALL USING (auth.jwt() ->> 'email' IN ('admin@visualdesigne.com', 'geral@visualdesigne.com', 'silva.chamo@gmail.com', 'silva.chamo@visualdesigne.com'));
