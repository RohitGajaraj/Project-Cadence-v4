# architecture/security.md — Auth, tenancy & governance

> Where authentication, multi-tenancy, secrets, and agent governance live. Rules: [`AGENTS.md`](../AGENTS.md). Data: [`data.md`](./data.md). Orchestration: [`orchestration.md`](./orchestration.md). Runtime: [`runtime.md`](./runtime.md).

## Authentication
- **Supabase Auth** — email/password + Google OAuth (more providers via the same path). Email verification on by default; never auto-confirm without explicit ask.
- **Sessions** — bearer token carried automatically on every server-fn RPC via the global `attachSupabaseAuth` middleware. SSE streams resume with `Last-Event-ID`.
- **Logout** — sign-out everywhere; token revocation.
- **Future:** SSO/SAML + SCIM for enterprise; roles/teams membership. Designed for now (the tenancy keys exist) so it is an addition, not a rewrite.

## Tenancy (the isolation spine)
Three nested scopes, enforced at every layer:
- **User** (`auth.uid()`), **Workspace** (`workspace_id`), **Product** (`product_id`).
- **Data layer:** RLS policy on every user table — `auth.uid() = user_id` plus workspace/product scoping. No client-trusted role checks. See [`data.md`](./data.md).
- **Execution layer:** the orchestrator scopes every mission/session/sub-agent/budget to user+workspace+product; a session cannot read another product's context or spend its budget. See [`orchestration.md`](./orchestration.md).
- **Server boundary:** the service-role client (bypasses RLS) is server-only and is the only path that decrypts secrets. Never imported from client code.

## Secrets
- **BYO model keys** encrypted with pgsodium `crypto_secretbox`; decrypted server-side on use only; masked in UI (`sk-***…last4`).
- No provider key required for the default gateway path.
- Connector OAuth tokens handled by the managed connector layer (refresh/revoke solved).

## Agent governance (security as a product feature)
This is the trust layer that makes autonomy sellable to enterprises — and a core part of the moat ([`README.md`](../README.md)):
- **Approval gates** — `auto | confirm | review` per agent and per side-effecting tool; the Decision Queue holds runs awaiting human approval.
- **Guardrails** — input + output: PII, prompt-injection, secret-leak, custom rules; `block | warn | redact`. External/MCP/A2A results are treated as untrusted input and re-guarded. See [`runtime.md`](./runtime.md).
- **Audit trail** — every AI call (`ai_events`), tool call (`tool_calls`), mission node, guardrail hit, and protocol action (`protocol_audit`) is logged and traceable.
- **Budgets** — per-user/workspace/product daily + monthly token + USD caps, enforced server-side before spend.
- **Capability scopes** — per MCP token / A2A peer; per-tool rate limits. See [`integrations.md`](./integrations.md).
- **Reversibility** — checkpoints + cancellation + replay; side effects gated so they can be reviewed before they happen.

## Compliance posture (future, designed-for-now)
RLS multi-tenancy, audit logs, encrypted secrets, and approval trails are the substrate for SOC 2 / ISO-class controls. Self-host/data-residency options are a stack property (Supabase is self-hostable — see [`docs/decisions/tech-stack.md`](../docs/decisions/tech-stack.md)). Build these controls in from day one so enterprise sales is minor configuration, not a re-architecture.

## Invariants
- RLS on every user table; service-role client server-only.
- Every scope check uses user + workspace + product, never client-trusted role.
- Secrets never leave the DB in plaintext.
- Every side-effecting agent action is gated, logged, and reversible.

Auth/tenancy/governance change → update this file + [`data.md`](./data.md) + [`plan.md`](../plan.md).
