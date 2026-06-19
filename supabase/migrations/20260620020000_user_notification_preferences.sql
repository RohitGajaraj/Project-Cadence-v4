-- R3-PREFS: user notification preferences
-- Create a table for per-user preferences with in-app, email, and digest options for approval, health, budget, and drift categories.

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_approvals BOOLEAN NOT null DEFAULT true,
  email_health BOOLEAN NOT null DEFAULT true,
  email_budget BOOLEAN NOT null DEFAULT true,
  email_drift BOOLEAN NOT null DEFAULT true,
  in_app_approvals BOOLEAN NOT null DEFAULT true,
  in_app_health BOOLEAN NOT null DEFAULT true,
  in_app_budget BOOLEAN NOT null DEFAULT true,
  in_app_drift BOOLEAN NOT null DEFAULT true,
  digest_approvals BOOLEAN NOT null DEFAULT true,
  digest_health BOOLEAN NOT null DEFAULT true,
  digest_budget BOOLEAN NOT null DEFAULT true,
  digest_drift BOOLEAN NOT null DEFAULT true,
  digest_frequency TEXT NOT null DEFAULT 'daily' CHECK (digest_frequency = any (array['daily', 'weekly'])),
  updated_at TIMESTAMPTZ NOT null DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can view their own preferences" ON public.user_notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can update their own preferences" ON public.user_notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
