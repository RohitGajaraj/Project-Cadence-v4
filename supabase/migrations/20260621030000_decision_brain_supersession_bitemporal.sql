-- DBR-1.5 Decision Brain supersession engine: bi-temporal columns on artifact_lineage.
--
-- Additive only: three nullable columns, no default, no NOT NULL, no index/lock change,
-- idempotent (IF NOT EXISTS). The existing RLS policy ("own artifact_lineage all",
-- FOR ALL USING auth.uid() = user_id) is column-agnostic, so it already covers these.
-- The read-side explorer (knowledge-graph-view.functions.ts) probes for valid_to and
-- selects it once live (bi-temporal legibility on the canvas); pre-migration it falls
-- back to the base column list, so the read surface stays byte-identical until the
-- column exists. invalidated_by/inference stay unread by the explorer.
--
-- These power invalidate-don't-delete: when a later recorded outcome supersedes or
-- contradicts a prior decision, the retired belief edge keeps its row and gets stamped
-- with valid_to (the time it stopped being true) instead of being deleted, so the graph
-- remembers what it used to believe and when that changed. That history is what makes
-- outcome-labeled judgment structurally un-backfillable (the moat).

ALTER TABLE public.artifact_lineage
  ADD COLUMN IF NOT EXISTS valid_to timestamptz,
  ADD COLUMN IF NOT EXISTS invalidated_by uuid,
  ADD COLUMN IF NOT EXISTS inference jsonb;

COMMENT ON COLUMN public.artifact_lineage.valid_to IS
  'Bi-temporal: when this edge''s belief stopped being true. NULL = currently valid. Stamped (never deleted) when a later outcome supersedes/contradicts it.';
COMMENT ON COLUMN public.artifact_lineage.invalidated_by IS
  'The learnings/lineage row whose recorded outcome retired this edge (set alongside valid_to). NULL while the edge is current.';
COMMENT ON COLUMN public.artifact_lineage.inference IS
  'Provenance for an engine-inferred edge: {verdict, score, source, ai_event_id}. NULL for human/promoted edges.';
