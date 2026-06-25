-- SEN-01: add external_id to signals for idempotent connector ingestion.
-- Nullable so existing rows (DEMO_FEED, manual) are unaffected.
-- Partial unique index enforces dedup only when external_id is set.
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS signals_user_workspace_external_id_idx
  ON public.signals (user_id, workspace_id, external_id)
  WHERE external_id IS NOT NULL;
