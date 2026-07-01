-- BYO-P5 (Managed end-to-end runtime): the hosted_apps schema.
--
-- An empty, isolated namespace for the future hosted-app tenancy layer
-- (docs/planning/byo-p5-managed-runtime-plan.md), kept structurally separate
-- from public (Cadence's own product/workspace/billing tables) so that when
-- tenant tables land here, a bug in one hosted app's AI-generated code can
-- never reach Cadence's own control-plane data by construction.
--
-- This migration creates the schema only, no tables yet. P5a is scaffold-only
-- (see src/lib/hosting/provider.ts, the AppRuntimeProvider interface + the
-- dormant nullAppRuntimeProvider floor). The real tenant tables, RLS/
-- tenant_id scoping, the RLS-audit gate, and the automated cross-tenant
-- isolation test are P5c, a separate, larger increment, gated on the
-- founder's directly-owned Cloudflare + Supabase account (plan Section 1.1).
--
-- Revoking default PUBLIC usage keeps this schema invisible to anon/
-- authenticated roles until P5c explicitly grants access to whatever tables
-- it creates inside it.
--
-- Idempotent (CREATE SCHEMA IF NOT EXISTS); no data, no existing table
-- touched, fully reversible (DROP SCHEMA hosted_apps).

CREATE SCHEMA IF NOT EXISTS hosted_apps;

REVOKE ALL ON SCHEMA hosted_apps FROM PUBLIC;
GRANT ALL ON SCHEMA hosted_apps TO service_role;
