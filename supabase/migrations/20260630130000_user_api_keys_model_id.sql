-- MA-2-MODEL-ID: persist the exact model the user wants to use with each BYO key.
-- Additive + idempotent (IF NOT EXISTS); zero behavior change on apply.
-- Unlocks the "Custom / OpenAI-compatible" provider: a user can store base_url +
-- model_id = "my-model" and Cadence surfaces it as a selectable model in the picker.
ALTER TABLE public.user_api_keys
  ADD COLUMN IF NOT EXISTS model_id text;
