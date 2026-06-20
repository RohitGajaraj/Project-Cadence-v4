# architecture/security.md — Auth, tenancy & governance

> _Created: 2026-06-03 · Last updated: 2026-06-20_

> Where authentication, multi-tenancy, secrets, and agent governance live. Rules: [`AGENTS.md`](../AGENTS.md). Data: [`data.md`](./data.md). Orchestration: [`orchestration.md`](./orchestration.md). Runtime: [`runtime.md`](./runtime.md).

> **Auth and OAuth are provisioned and managed by Lovable; query it first.** Cadence is built on, hosted on, and published through Lovable; Supabase Auth, the OAuth providers, and redirect URIs come from there. Read live provider config, redirect URIs, and whether a secret is set from the connected Lovable MCP (`mcp__lovable__*`), and the Supabase MCP (`mcp__supabase__*`) for auth tables, never from assumption. The one local-first exception: actual secret values live in this project's git-ignored `.env` and as wrangler secrets (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, `CONNECTOR_SECRETS_KEY`, ...), so check local for those. Canonical rule: [`AGENTS.md`](../AGENTS.md) §0.

## Authentication

- **Supabase Auth** — email/password + Google OAuth (more providers via the same path). Email verification on by default; never auto-confirm without explicit ask.
- **Password reset** — self-service via `/forgot-password` (request link) → `/reset-password` (set new password). Documented in [`../docs/features/auth-flows.md`](../docs/features/auth-flows.md).
- **Sessions** — bearer token carried automatically on every server-fn RPC via the global `attachSupabaseAuth` middleware. SSE streams resume with `Last-Event-ID`.
- **Realtime broadcasts** — user data tables are not published unless channel access is scoped to workspace membership. `messages` stays out of the realtime publication; chat history is read through authenticated queries / streams instead of raw row-change broadcasts.
- **Logout** — sign-out everywhere; token revocation.
- **Future:** SSO/SAML + SCIM for enterprise; roles/teams membership. Designed for now (the tenancy keys exist) so it is an addition, not a rewrite. **The account layer, RBAC (owner/admin/member/viewer) enforcement, invites, ownership transfer, and workspace-scoped/account-pooled memory are specced in the WM initiative ([`../docs/planning/workspace-tenancy-and-monetization-plan.md`](../docs/planning/workspace-tenancy-and-monetization-plan.md), §3 + WM-F1/F3/F4/F5).**

## Tenancy (the isolation spine)

Three nested scopes, enforced at every layer:

- **User** (`auth.uid()`), **Workspace** (`workspace_id`), **Product** (`product_id`).
- **Data layer:** RLS policy on every user table — `auth.uid() = user_id` plus workspace/product scoping. No client-trusted role checks. See [`data.md`](./data.md).
- **Execution layer:** the orchestrator scopes every mission/session/sub-agent/budget to user+workspace+product; a session cannot read another product's context or spend its budget. See [`orchestration.md`](./orchestration.md).
- **Server boundary:** the service-role client (bypasses RLS) is server-only and is the only path that decrypts secrets. Never imported from client code.

## Secrets

- **BYO model keys & connector secrets** encrypted app-layer with AES-256-GCM under `CONNECTOR_SECRETS_KEY` (base64 32-byte wrangler secret; ciphertext + IV stored in `user_api_keys` / `connection_secrets` — the latter has RLS enabled with no policies, service-role-only); decrypted server-side on use only; masked in UI (`sk-***…last4`).
- No provider key required for the default gateway path.
- Connector OAuth tokens handled by the managed connector layer (refresh/revoke solved).
- **Cross-member binding attribution** — workspace `connection_bindings` carry `created_by`; GitHub side effects run as the installed GitHub App (and are labeled "acting as …" in previews), not as any individual member's identity.
- **Scheduled hook secret:** privileged `/api/public/hooks/*` routes never trust the browser-visible app key. `requireHookCaller` accepts only `x-cron-key` or bearer credentials that match a private backend secret (`CRON_SECRET` / `HOOK_CRON_SECRET` when set, or the locked `app_private.hook_secrets` value used by scheduled jobs). The secret store is unavailable to anonymous and signed-in Data API callers.

## Agent governance (security as a product feature)

This is the trust layer that makes autonomy sellable to enterprises — and a core part of the moat ([`README.md`](../README.md)):

- **Approval gates** — `auto | confirm | review` per agent and per side-effecting tool; the Decision Queue holds runs awaiting human approval. Approvals carry a TTL (`agent_approvals.expires_at`, default 24h) and `escalation_state`; a per-minute cron (`/api/public/hooks/approvals-tick`) auto-expires stale ones so missions cannot stall forever. Per-agent autonomy arcs (Observing → Proving → Trusted → Ambient) modulate the effective approval mode at the gate — operator-facing explanation in [`../docs/features/trust-and-autonomy.md`](../docs/features/trust-and-autonomy.md). Multi-agent handoffs respect the receiver's arc; see [`../docs/features/a2a-handoff.md`](../docs/features/a2a-handoff.md).
- **Guardrails** — input + output: PII, prompt-injection, secret-leak, custom rules; `block | warn | redact`. External/MCP/A2A results are treated as untrusted input and re-guarded. See [`runtime.md`](./runtime.md).
- **Audit trail** — every AI call (`ai_events`), tool call (`tool_calls`), mission node, guardrail hit, and protocol action (`protocol_audit`) is logged and traceable.
- **Budgets** — per-user/workspace/product daily + monthly token + USD caps, enforced server-side before spend.
- **Kill-switch (`kill_switches`)** — one row per scope (`system` or `workspace`). System row is service-role-only; workspace row is writable by workspace `owner` / `admin` (RLS-enforced). `current_kill_state(workspace_id)` `SECURITY DEFINER` RPC is read by the chokepoint before every AI call; when paused, `callModel()` / `callModelStream()` throw `GovernanceHaltError` _before any spend_ and log `ai_events.status='blocked'` with `error_message='governance_halt:kill_switch'`. The governance UI (`/_authenticated/governance`) toggles workspace pause with a required reason; the `AppShell` shows a red banner when paused.
- **Per-mission caps (`agent_runs`)** — every mission can declare `mission_token_cap` + `mission_spend_cap_usd`; running totals (`tokens_used`, `spend_used_usd`) are atomically bumped via `record_mission_usage()` after each successful call. The next call in the mission sees the bump and is halted with `GovernanceHaltError('mission_token_cap' | 'mission_spend_cap')`; `halt_agent_run()` marks the run `status='halted'` with `halted_reason`.
- **Capability scopes** — per MCP token / A2A peer; per-tool rate limits. See [`integrations.md`](./integrations.md).
- **Reversibility** — checkpoints + cancellation + replay; side effects gated so they can be reviewed before they happen.

**Governance surface (operator UI).** The user-facing controls for everything above live at `/_authenticated/governance` (sidebar → AI Ops → Governance): kill-switch toggle (with paused-banner in `AppShell`), per-mission token/spend caps with live usage, and the stale-approvals panel (extend / approve / reject). Operator walkthrough + verification checklist: [`../docs/planning/feature-backlog.md`](../docs/planning/feature-backlog.md) §0.6 "How to use / verify".

## Compliance posture (future, designed-for-now)

RLS multi-tenancy, audit logs, encrypted secrets, and approval trails are the substrate for SOC 2 / ISO-class controls. Self-host/data-residency options are a stack property (Supabase is self-hostable — see [`docs/decisions/tech-stack.md`](../docs/decisions/tech-stack.md)). Build these controls in from day one so enterprise sales is minor configuration, not a re-architecture.

## Invariants

- RLS on every user table; service-role client server-only.
- Privileged scheduled hooks must use a private hook secret, never the public app key.
- Every scope check uses user + workspace + product, never client-trusted role.
- Secrets never leave the DB in plaintext.
- Every side-effecting agent action is gated, logged, and reversible.
- Workspace + product mutation server fns are owner-gated server-side. `renameWorkspace` / `deleteWorkspace` / `leaveWorkspace` / `removeWorkspaceMember` in [`../src/lib/workspaces.functions.ts`](../src/lib/workspaces.functions.ts) and `updateProject` / `deleteProject` in [`../src/lib/projects.functions.ts`](../src/lib/projects.functions.ts) enforce via RLS on `workspaces` + `workspace_members` + `projects`. Owner cannot leave their own workspace (server-side guard). Client never trusts the role chip.

Auth/tenancy/governance change → update this file + [`data.md`](./data.md) + [`plan.md`](../plan.md).
