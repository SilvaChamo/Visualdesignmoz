-- Migration: isolate newsletter contacts by panel scope
-- Goal:
-- 1) Keep existing contacts
-- 2) Remove global UNIQUE(email)
-- 3) Enforce UNIQUE(lower(email), metadata->>'panel')
-- 4) Mark legacy rows as panel=admin|client

BEGIN;

-- 1) Normalize legacy rows with missing panel scope.
--    Heuristic:
--    - rows with domain in metadata => client
--    - rows without domain => admin
UPDATE newsletter_subscribers
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{panel}',
  to_jsonb(
    CASE
      WHEN COALESCE(NULLIF(metadata->>'domain', ''), '') <> '' THEN 'client'
      ELSE 'admin'
    END
  ),
  true
)
WHERE COALESCE(metadata->>'panel', '') = '';

-- 2) Drop old unique constraints that enforce global unique email.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'newsletter_subscribers'::regclass
      AND contype = 'u'
      AND conname ILIKE '%email%'
  LOOP
    EXECUTE format('ALTER TABLE newsletter_subscribers DROP CONSTRAINT IF EXISTS %I;', c.conname);
  END LOOP;
END $$;

-- 3) Add a guard for valid panel values.
ALTER TABLE newsletter_subscribers
  DROP CONSTRAINT IF EXISTS newsletter_subscribers_panel_check;

ALTER TABLE newsletter_subscribers
  ADD CONSTRAINT newsletter_subscribers_panel_check
  CHECK (
    COALESCE(metadata->>'panel', '') IN ('admin', 'client')
  );

-- 4) New unique index by scope.
DROP INDEX IF EXISTS idx_subscribers_email_unique_by_panel;
CREATE UNIQUE INDEX idx_subscribers_email_unique_by_panel
  ON newsletter_subscribers (lower(email), (metadata->>'panel'));

-- 5) Helpful secondary index for panel filters.
DROP INDEX IF EXISTS idx_subscribers_panel;
CREATE INDEX idx_subscribers_panel
  ON newsletter_subscribers ((metadata->>'panel'));

COMMIT;
