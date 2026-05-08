-- Email Marketing System Schema

-- 1. Newsletter Subscribers Table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed', 'bounced')),
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ,
    tags TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Email Campaigns Table
CREATE TABLE IF NOT EXISTS email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    content_html TEXT NOT NULL,
    content_text TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    successful_sends INTEGER DEFAULT 0,
    failed_sends INTEGER DEFAULT 0,
    template_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Email Campaign Logs Table
CREATE TABLE IF NOT EXISTS email_campaign_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
    subscriber_id UUID NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('delivered', 'failed', 'opened', 'clicked')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_logs ENABLE ROW LEVEL SECURITY;

-- Policies for Admin Access (assuming admin email pattern from supabase-client.ts)
-- We'll use a broad policy for now that checks if the user is an admin
-- Note: In a production environment, you should use a more robust way to check for admin status

CREATE POLICY "Admins can manage subscribers" ON newsletter_subscribers
    FOR ALL USING (auth.jwt() ->> 'email' IN ('admin@visualdesignmoz.com', 'geral@visualdesignmoz.com', 'silva.chamo@gmail.com', 'silva.chamo@visualdesignmoz.com'));

CREATE POLICY "Admins can manage campaigns" ON email_campaigns
    FOR ALL USING (auth.jwt() ->> 'email' IN ('admin@visualdesignmoz.com', 'geral@visualdesignmoz.com', 'silva.chamo@gmail.com', 'silva.chamo@visualdesignmoz.com'));

CREATE POLICY "Admins can view logs" ON email_campaign_logs
    FOR ALL USING (auth.jwt() ->> 'email' IN ('admin@visualdesignmoz.com', 'geral@visualdesignmoz.com', 'silva.chamo@gmail.com', 'silva.chamo@visualdesignmoz.com'));

-- Public policy for subscribing (INSERT only)
CREATE POLICY "Public can subscribe" ON newsletter_subscribers
    FOR INSERT WITH CHECK (true);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign_id ON email_campaign_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_subscriber_id ON email_campaign_logs(subscriber_id);
