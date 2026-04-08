-- Fix: Add metadata column to email_campaigns table
-- This column is needed for storing domain information

-- Check if column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'email_campaigns' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE email_campaigns ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
        
        -- Create index for better performance
        CREATE INDEX idx_email_campaigns_metadata_domain ON email_campaigns USING gin ((metadata->>'domain'));
        
        RAISE NOTICE 'Column metadata added to email_campaigns table';
    ELSE
        RAISE NOTICE 'Column metadata already exists in email_campaigns table';
    END IF;
END $$;

-- Update existing campaigns to have metadata with domain
UPDATE email_campaigns 
SET metadata = COALESCE(metadata, '{}'::jsonb) || 
    CASE 
        WHEN metadata->>'domain' IS NULL OR metadata->>'domain' = '' 
        THEN '{"domain": "visualdesign.pt"}'::jsonb
        ELSE '{}'::jsonb
    END
WHERE metadata->>'domain' IS NULL OR metadata->>'domain' = '';

-- Show table structure
\d email_campaigns;
