-- Signal Fabric Phase 0: add the source_kind discriminator to signals.
-- Every writer now funnels through writeSignals() (src/lib/sources/sink.server.ts),
-- which stamps WHICH KIND of source a signal came from. Nullable so existing rows
-- and any not-yet-refactored writer are unaffected; backfilled from the legacy
-- `source` token. New rows are stamped by the sink.
--   pull_connector  - registry-backed provider (github, intercom, stripe, posthog…)
--   web_scout       - the Scout/watchtower: diffed web targets (researcher-tick v0)
--   mcp_source      - an external MCP server ingested as a source (Phase 3)
--   webhook         - inbound push via ingest_tokens
--   manual          - human-entered / DEMO_FEED
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS source_kind text;

-- Backfill existing rows by mapping their `source` token to a kind (best-effort).
UPDATE public.signals
SET source_kind = CASE
  WHEN source IN ('github', 'posthog_analytics') THEN 'pull_connector'
  WHEN source = 'competitive_research' THEN 'web_scout'
  WHEN source = 'mcp' THEN 'mcp_source'
  WHEN source = 'webhook' THEN 'webhook'
  ELSE 'manual'
END
WHERE source_kind IS NULL;

-- Constrain to the known set, but keep NULL legal so an un-refactored writer that
-- omits source_kind still inserts (it just lands un-discriminated until refactored).
ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS signals_source_kind_check;
ALTER TABLE public.signals ADD CONSTRAINT signals_source_kind_check
  CHECK (source_kind IS NULL OR source_kind IN
    ('pull_connector', 'web_scout', 'mcp_source', 'webhook', 'manual'));
