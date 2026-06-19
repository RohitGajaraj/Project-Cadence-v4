# architecture/data.md — Data layer contract

> _Created: 2026-06-03 · Last updated: 2026-06-19_

> Supabase Postgres + RLS + pgvector + pg_cron. Rules: [`AGENTS.md`](../AGENTS.md). Runtime: [`runtime.md`](./runtime.md).

## The one rule

**RLS on every user table.** Policy form: `auth.uid() = user_id` (own-row read/write). No client-trusted role checks. New tables ship with RLS in the same migration. Audited via the Supabase linter pass.

## Server boundary

- Browser client (`integrations/supabase/client.ts`) acts **as the user** — RLS applies.
- Service-role client (`client.server.ts`) bypasses RLS and is **server-only** — never imported from client code. The only path allowed to decrypt BYO keys.
- `attachSupabaseAuth` is a global server-fn middleware so RPCs auto-carry the bearer token.

## Scoping

Every server function that touches user data scopes by **both** `user_id` and `workspace_id`. Workspace is a first-class boundary, not a label.

Every signed-in profile must have at least one workspace membership. `current_user_default_workspace()` is the durable fallback: it creates/returns a default workspace + owner membership when none exists, and new-user setup calls the same helper. UI code may pass an explicit workspace, but server functions that can operate on the user's default workspace must resolve it server-side instead of trusting browser hydration.

## Core tables (by domain)

- **Identity/workspace:** `profiles`, `workspaces`, `workspace_members`, `workspace_briefs`, `projects` (vision, problem, target_users, metrics_json, stage, workspace_id).
- **Conversations:** `conversations`, `messages` (tokens, cost_usd, event_id).
- **Discovery:** `signals`, `themes` (evidence_ids[]), `opportunities` (ICE: impact·confidence·ease).
- **Reasoning/planning:** `prds`, `prd_versions`, `roadmap_items`, `tasks`, `meetings`, `decisions` (supersedes), `experiments`.
- **Studio:** `studio_projects`, `studio_files`, `studio_revisions`.
- **Integrations:** `docs_links`, `calendar_events`, `user_api_keys` (pgsodium-encrypted), agent `schedule_cron`.
- **AI trust stack:** `ai_events`, `ai_traces`, `ai_evals`, `ai_feedback`, `tool_calls`, `guardrail_rules`, `guardrail_hits`, `eval_suites`/`eval_cases`/`eval_runs`/`eval_case_results`, `prompt_templates`/`prompt_versions`, `agent_memory`, `rag_chunks`, `ai_budgets`, `model_pricing`.
- **Planned (Ph7-9):** `mcp_tokens`, `mcp_servers`, `mcp_server_tools`, `a2a_tasks`, `a2a_messages`, `a2a_peers`, `protocol_audit`; `graph_nodes`/`graph_edges`, `skill_packs`, `policies`; `hypotheses`.
- **Planned (WM initiative, 2026-06-19):** `accounts`, `account_members`, `account_credits`, `credit_ledger`, `workspace_invitations`, `workspace_audit_log`; `workspace_id` added to `agent_memory`/`agent_runs`/`agents` (+ `agent_tools`/`agent_approvals`); `workspaces.account_id`. Billing/plan/credits move from `workspaces` to `accounts`; decision memory scopes to the workspace and pools across the account for paid tiers. Spec: [`../docs/planning/workspace-tenancy-and-monetization-plan.md`](../docs/planning/workspace-tenancy-and-monetization-plan.md) §3.

## Vectors (pgvector)

`rag_chunks`: 1536-d embeddings, `ivfflat (vector_cosine_ops)` index (lists=100). Chunker: ~512-token chunks, 64-token overlap, headings preserved (256/none dropped groundedness ~12%). Retrieval is hybrid (vector cosine + keyword), top-k=8, MMR for diversity. See [`runtime.md`](./runtime.md) step 4.

## Scheduling

`pg_cron + pg_net` poke `/api/public/hooks/*` every minute. Long ticks are deduped with a Postgres advisory lock keyed on `agent_id` (fix for double fan-out). Day-scoped jobs are idempotent on a natural unique key (e.g. daily brief `(user_id, brief_date)`).

## Secrets

BYO keys encrypted with pgsodium `crypto_secretbox`; server-fns decrypt on use only; the service-role client is the only reader.

## Migrations

Source of truth is `supabase/migrations/`. Author via the migration tool; **never edit an existing migration in place.** Schema change → update this file + [`plan.md`](../plan.md) + ship the migration.

## Known limits

Clustering degrades past ~1000 signals/run (incremental clustering deferred); `model_pricing` hand-maintained; `ai_events` retention currently unbounded (90-day tier + cold export planned).
