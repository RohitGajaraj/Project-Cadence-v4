# Web access for agents

> _Created: 2026-06-04 · Last updated: 2026-06-14_

> Agents reach the public internet through a small, governed set of tools backed by Firecrawl. Every call goes through the same loop, logging, and trust arc as any other tool. No second runtime, no bypass.

## Why this exists

Cadence agents reason over workspace data by default. The moment a mission needs the outside world ("scout how Linear's AI triage is positioned and give me a non-reactive one-pager"), an agent with no web tool either hallucinates or stops short. That breaks the "agents _do_, humans govern" promise. Web access closes the loop.

## The four tools

All four are registered in `src/lib/ai/tools/registry.server.ts` and call the helper in `src/lib/ai/tools/firecrawl.server.ts`.

| Tool         | Category | Default approval | What it does                                                                                                                   |
| ------------ | -------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `web.search` | read     | `auto`           | Ranked search results (url, title, snippet). Optional `scrape: true` includes markdown. Caps: `limit ≤ 10`, query ≤ 300 chars. |
| `web.fetch`  | read     | `auto`           | Fetches a single URL → markdown + metadata. Output is clipped (default 8 KB, max 20 KB).                                       |
| `web.map`    | read     | `auto`           | Lists URLs on a domain. Cheap discovery before a `web.crawl`.                                                                  |
| `web.crawl`  | read     | `confirm`        | Bounded crawl (max 25 pages, depth 2). Spends real Firecrawl credits, which is why it asks for approval.                        |

Approval mode is the user's per-tool setting in `agent_tools.mode` and is modulated by the agent's trust arc (see [`trust-and-autonomy.md`](./trust-and-autonomy.md)). Operators can flip any of them to `confirm` / `review` / `off` in the agent edit panel.

## How a multi-step mission uses them

Example mission: **"Scout how Linear's AI triage is positioned and draft a one-pager + positioning angle that does NOT sound reactive."**

1. Orchestrator → Discovery (handoff).
2. Discovery: `web.search "Linear AI triage"` → `web.fetch` on the top 2-3 URLs → `signals.log` with key claims and source URLs.
3. Discovery → Strategist (handoff payload includes the signal IDs as `artifacts[]`).
4. Strategist: `workspace.search` for our own product context → drafts the PRD / one-pager and cites the URLs from step 2.

Pass criteria: `tool_calls` shows real Firecrawl calls, the final artifact cites at least 2 real URLs from the fetch step, no invented quotes.

## Safety model

- **Untrusted input.** Returned markdown is treated as untrusted text. The _next_ `callModel()` in the loop runs it through the same pre-guardrails (PII / prompt-injection / secret / keyword) as any user input. See [`architecture/runtime.md`](../../architecture/runtime.md). Do not strip that step when extending these tools.
- **Cost containment.** `web.search` is cheapest; `web.map` next; `web.fetch` per URL; `web.crawl` is the only one that defaults to `confirm`. Per-mission spend cap on `agent_runs.spend_used_usd` still applies.
- **Citations.** Every result includes the source URL. Agents are nudged in their system prompt to cite source URLs for any external claim.
- **Kill-switch.** All four are gated by `current_kill_state(workspaceId)` like every other tool: pause the workspace and outbound traffic stops too.
- **Secret hygiene.** `FIRECRAWL_API_KEY` is read from `process.env` only inside `firecrawl.server.ts`, never bundled to the client.

## Setup

1. Connect the **Firecrawl** connector (workspace owner). The key injects as `FIRECRAWL_API_KEY` at runtime.
2. New users: the four tools are seeded automatically (`seed_default_agent_tools`).
3. Existing users: backfilled by the same migration that introduced this doc.
4. If the key is missing, the tool throws a typed error ("web tools are not configured…") that surfaces cleanly in the trace.

## Extending

- **Swap provider.** Add a new helper module next to `firecrawl.server.ts`, keep the same exported function signatures, and the registry tools don't need to change.
- **Domain allow/deny.** Wrap `webFetch` / `webCrawl` with a URL check before the outbound call. Surface the rule in `/governance`. (Out of scope for v1.)
- **`web.research`.** A higher-level tool that chains search → fetch → synthesize → cite. Build only if the basic primitives prove insufficient.

## Failure modes

- `Firecrawl 402` → insufficient credits. Top up the connected Firecrawl account.
- `Firecrawl 401/403` → key revoked or scopes changed. Reconnect the connector.
- `web tools are not configured` → key missing entirely. Connect Firecrawl.
- Result-injection (page tries to override the agent) → caught by pre-guardrails on the next model call, logged to `guardrail_hits`.

## Related

- [`trust-and-autonomy.md`](./trust-and-autonomy.md): how approval modes are modulated by the agent's trust arc.
- [`a2a-handoff.md`](./a2a-handoff.md): handoff payloads can carry web sources as `artifacts[]` so the receiver doesn't re-fetch.
- [`../../architecture/runtime.md`](../../architecture/runtime.md): chokepoint contract; web results re-enter as untrusted input.
- [`../../architecture/integrations.md`](../../architecture/integrations.md): connector catalogue, including Firecrawl.
- [`../../architecture/security.md`](../../architecture/security.md): kill-switch and approval gates.
- [`feature-backlog.md`](../planning/archive/feature-backlog.md): live status of this feature.
- [`README.md`](./README.md): docs index.
