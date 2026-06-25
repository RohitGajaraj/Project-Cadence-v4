# architecture/data.md — Data layer contract

> _Created: 2026-06-03 · Last updated: 2026-06-19_

> Supabase Postgres + RLS + pgvector + pg_cron. Rules: [`AGENTS.md`](../AGENTS.md). Runtime: [`runtime.md`](./runtime.md).

> **This database is provisioned and managed by Lovable.** Cadence is built on, hosted on, and published through Lovable; the Supabase Postgres instance, its schema, and its config come from there. Read live schema, migration state, and data from the connected Supabase MCP (`mcp__supabase__*`) or the Lovable MCP (`mcp__lovable__*`), never from assumption. Canonical rule: [`AGENTS.md`](../AGENTS.md) §0.

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

`rag_chunks`: 1536-d embeddings, `vector_cosine_ops` HNSW index. Chunker: ~512-token chunks, 64-token overlap, headings preserved (256/none dropped groundedness ~12%). Retrieval is hybrid (vector cosine + keyword), top-k=8, MMR for diversity. See [`runtime.md`](./runtime.md) step 4.

### Why embeddings are locked to one model + dimension (read this before swapping the embedder)

Every stored vector is **1536-d** (~20 `vector(1536)` columns across `rag_chunks`, `agent_memory`, etc.), chosen to match **OpenAI `text-embedding-3-small`** (the Lovable gateway's default embedder — strong, cheap [~$0.02 / 1M tokens]).

This makes embeddings, unlike completions, **NOT model-agnostic**:
- **Completions** output text → any model works (Gemini/GPT/Claude are interchangeable; BYO routing in `runtime.server.ts` `byoConfig` covers them). This is why a BYO Gemini key drives chat with zero schema work.
- **Embeddings** output a fixed-length vector → similarity search (cosine) requires every vector (stored chunks AND the query) to come from the **same model**: same **dimension** (768 ≠ 1536 can't even be compared) AND same **semantic space** (a different model at 1536-d is still a different space → garbage matches). So the embedder is pinned to OpenAI `text-embedding-3-small` (or the gateway, which uses it).
- **Free embedders don't fit:** Gemini (`text-embedding-004` = 768) and Ollama (`nomic` = 768) mismatch the dimension; even Gemini's configurable-1536 mode is a different space. Switching to any of them = re-embed EVERY stored vector + change the column dimension + rebuild the HNSW index (a full, destructive data migration), then locked to that embedder. Not worth it — a cheap OpenAI key matches the existing vectors with no migration.

**Dimension tradeoff:** more dims (1536) = more capacity for nuance (modestly better retrieval on large/subtle corpora) at the cost of storage (~6KB vs ~3KB/vector), slower similarity math, bigger indexes. Both 768 and 1536 work for most apps; 1536 is a reasonable, proven default, not a hard requirement.

**EMBED-CHOKEPOINT** (`src/lib/rag/embed.server.ts`) made embeddings swappable at the **provider** level (gateway / OpenAI BYO) but NOT the **dimension** level (1536 is baked into the schema). True model-agnosticism would need per-vector `model`/`dims` columns so different-dim vectors coexist + namespaced retrieval — deferred groundwork noted on the EMBED-CHOKEPOINT row.

**Practical rule for testing/dev:** use any model for completions; for embeddings you need a **1536-d OpenAI source** (a BYO OpenAI key in Settings → Models, or a funded Lovable gateway). A Gemini key does NOT enable embeddings.

## Scheduling

`pg_cron + pg_net` poke `/api/public/hooks/*` every minute. Long ticks are deduped with a Postgres advisory lock keyed on `agent_id` (fix for double fan-out). Day-scoped jobs are idempotent on a natural unique key (e.g. daily brief `(user_id, brief_date)`).

## Secrets

BYO AI keys + connector OAuth secrets are encrypted **app-layer with WebCrypto AES-256-GCM** (`src/lib/connectors/crypto.server.ts`), keyed by the **`CONNECTOR_SECRETS_KEY`** server secret (base64 for exactly 32 bytes; generate via `openssl rand -base64 32`). Server-fns decrypt on use only. Stored in `user_api_keys` as cipher columns: `api_key_cipher` / `api_key_iv` / `key_version` (+ a non-secret `api_key_prefix` for display). The legacy plaintext `api_key` column was dropped (migration `20260620211507`); `byokeys-vault.server.ts` reads/writes only the cipher columns. If `CONNECTOR_SECRETS_KEY` is unset, saving any BYO key fails with "connector secret vault is setup pending."

> **Live-DB schema drift gotcha (2026-06-21):** the live Lovable DB had **not** applied every repo migration — saving a BYO key failed first on the dropped `api_key` column, then on the missing cipher columns (the `20260612080000` f_conn migration that defines them was absent while later migrations were present). Fix was a one-off idempotent `ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS api_key_cipher/api_key_iv/key_version` + `NOTIFY pgrst, 'reload schema'` run in the Supabase SQL editor (also captured as migration `20260621180000`). Treat the live DB as potentially behind the repo migrations; a full migration-sync is owed.

## Migrations

Source of truth is `supabase/migrations/`. Author via the migration tool; **never edit an existing migration in place.** Schema change → update this file + [`plan.md`](../plan.md) + ship the migration.

## Known limits

Clustering degrades past ~1000 signals/run (incremental clustering deferred); `model_pricing` hand-maintained; `ai_events` retention currently unbounded (90-day tier + cold export planned).

## Planned observability tables (AFD, founder-gated)

The [AFD initiative](../docs/planning/analytics-and-failure-detection-plan.md) adds three Postgres surfaces (BUILD side of the BBI split — the moat-adjacent receipts layer stays on-DB):

- `job_runs(id, job_name, started_at, finished_at, status, error, workspace_id?)` — every cron hook wrap (AFD-07).
- `agent_runs.failure_kind` (typed enum) — taxonomy of AI-runtime failures (AFD-06).
- Materialized views: `mv_decision_velocity`, `mv_supersession_rate`, `mv_agent_cost_per_decision`, `mv_signals_to_outcomes` — the moat analytics (AFD-09..12), refreshed nightly via `pg_cron`.

All vendor data (PostHog, Sentry, Better Stack) stays off-Postgres; only join keys (`workspace_id`, `agent_run_id`, `decision_id`) cross the boundary. See [`../docs/features/observability-facade.md`](../docs/features/observability-facade.md).
