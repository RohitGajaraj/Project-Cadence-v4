-- Billing-secret vault grant lockdown (security hardening; completes 20260622020000).
--
-- Found by a live prod grant audit (2026-06-22, lane 2): account_billing_secrets and
-- workspace_billing_secrets (the per-account / per-workspace Stripe customer + subscription
-- vaults) are RLS-locked with ZERO policies (deny-all => service-role-only), and migration
-- 20260622020000 already revoked the default anon/authenticated SELECT. But they still carried
-- the default anon/authenticated DELETE, INSERT, UPDATE, REFERENCES, TRIGGER, and TRUNCATE
-- grants. RLS does NOT gate TRUNCATE (nor REFERENCES/TRIGGER) -- Postgres applies row security
-- only to SELECT/INSERT/UPDATE/DELETE -- so the residual TRUNCATE grant was an RLS-INDEPENDENT
-- integrity/availability vector on billing-linkage data, and these vaults did not match the
-- hardened connection_secrets pattern (service_role-only).
--
-- Zero-impact: the tables are deny-all (no policy), so the app provably does NOT reach them as
-- anon/authenticated -- it uses the service-role client server-side (the Stripe webhook + billing
-- functions). They are empty today (billing pre-go-live), so this lands clean. Forward-only and
-- idempotent. Applied to prod the same session via the Lovable DB (migration-security cycle);
-- this migration keeps the repo source in lockstep so a fresh apply lands in the same state.

revoke all privileges on table public.account_billing_secrets   from anon, authenticated;
revoke all privileges on table public.workspace_billing_secrets from anon, authenticated;

-- Re-affirm the backend's access (service_role already holds these; explicit for a clean apply).
grant all privileges on table public.account_billing_secrets   to service_role;
grant all privileges on table public.workspace_billing_secrets to service_role;

-- The vaults stay deny-all (RLS enabled, 0 policies). Re-affirm enablement for a clean apply.
alter table public.account_billing_secrets   enable row level security;
alter table public.workspace_billing_secrets enable row level security;

-- FOLLOW-UP (SEC-TRUNCATE-HARDENING, noted in architecture/security.md): the same
-- RLS-independent TRUNCATE/REFERENCES/TRIGGER default grants still sit on the RLS-POLICIED
-- credential/token tables (user_api_keys, mcp_tokens, ingest_tokens). They are not reachable
-- via PostgREST (which exposes no TRUNCATE verb), so the practical risk is low, but a targeted
-- `revoke truncate, references, trigger ... from anon, authenticated` there would close the
-- class without touching the RLS-gated owner read/write paths. Left scoped out of this fix.
