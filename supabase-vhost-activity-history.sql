CREATE TABLE IF NOT EXISTS public.vhost_activity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  user_role TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  viewing_account TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL CHECK (event_type IN ('section', 'click')),
  section TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vhost_activity_history_user_created_idx
  ON public.vhost_activity_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS vhost_activity_history_created_idx
  ON public.vhost_activity_history (created_at DESC);

ALTER TABLE public.vhost_activity_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vhost_activity_history FROM anon, authenticated;
GRANT ALL ON public.vhost_activity_history TO service_role;
