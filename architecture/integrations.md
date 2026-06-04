# architecture/integrations.md — Connectors, BYO keys & agent interop

> External systems and the "built for agents" surface. Rules: [`AGENTS.md`](../AGENTS.md). Runtime: [`runtime.md`](./runtime.md). Data: [`data.md`](./data.md).

## Principle
Cadence is **agent-first**: built to be operated by agents over open protocols, not just by humans clicking. Connectors are tools agents call through the chokepoint; every tool call is allow-listed, approval-gated where it has side effects, and logged to `tool_calls`.

## Connectors (built)
- **Google Docs** — two-way sync (`docs_links`, latest-wins + diff preview; drops comments — known limit).
- **Notion** — import to prds/opportunities/signals; export PRD → page; DB-row linking.
- **Linear** — paginated GraphQL pull → `tasks` (`external_ref`, `external_source='linear'`); push via mutation; Sync Inbox resolves conflicts (keep-local / keep-remote / merge); PRD → Linear cycle.
- **Google Calendar** — read + write (create/edit/delete, optimistic upsert into `calendar_events`); Scheduler agent proposes slots within working hours.
- **Firecrawl (web access)** — powers `web.search` / `web.fetch` / `web.map` / `web.crawl` agent tools (see [`../docs/web-access.md`](../docs/web-access.md)). Single chokepoint in `src/lib/ai/tools/firecrawl.server.ts`; results re-enter the loop as untrusted input and run through pre-guardrails on the next `callModel`. `web.crawl` defaults to `confirm` (spends real credits).

## BYO keys
`user_api_keys`: provider, encrypted key (pgsodium `crypto_secretbox`), optional base_url, label, last-test result. UI masks the key (`sk-***…last4`), supports Test (1-token completion), Rotate, Delete. Service-role client is the only decrypt path. Adding a provider = adding a chokepoint adapter (see [`runtime.md`](./runtime.md)), not touching call sites.

## Why managed connectors over hand-rolled OAuth
Token refresh, encrypted storage, and revoke flows are already solved by the managed connector layer. Hand-rolled OAuth (e.g. Jira/Atlassian Connect) is deferred until a use case needs it.

## Agent interop (planned — Phase 7)
The differentiator: Cadence as a node other agents plug into, and a consumer of external agents.
- **MCP server** — expose tasks, PRDs, agents, calendar, discovery, copilot as MCP tools at `src/routes/api/mcp.ts`; per-user scoped `mcp_tokens`; config snippets for Claude Desktop / Cursor / ChatGPT. Every invocation logs `surface='mcp_server'`.
- **MCP client** — register external servers (`mcp_servers`), cache catalogs (`mcp_server_tools`), per-agent allow-listed tools; destructive calls reuse the approval gates.
- **A2A** — Agent Cards at `/.well-known/agent.json`; A2A server (`message/send`, `message/stream`, `tasks/*`) with `a2a_tasks`/`a2a_messages`; A2A client with `delegate_to_agent`, `a2a_peers` registry; multi-agent DAG stitched into `ai_traces`.
- **Unified protocol gateway** (`src/lib/protocols/`) reuses the Phase 6 auth/tracing/guardrails substrate — no second runtime.

## Interop safety (Phase 7)
Capability scopes per token/peer; per-tool rate limits; **prompt-injection guard on external server results** (treat external output as untrusted input through the pre-guardrails); PII egress check; `protocol_audit` log.

## Invariants
- Every external tool call routes through the chokepoint and logs to `tool_calls`.
- Destructive external actions require approval.
- External results are untrusted input — guard them.
- Model providers are connectors too: model-agnostic by contract.

Integration/protocol change → update this file + [`plan.md`](../plan.md).
