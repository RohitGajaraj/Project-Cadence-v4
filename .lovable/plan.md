
## Problem

Agents today only reason over workspace data. When a goal needs the outside world ("scout how Linear's AI triage is positioned, then give me a non-reactive one-pager"), the agent has no tool to reach for, so it either hallucinates or stops short. That breaks the "agents *do*, humans govern" promise — agents are siloed.

## Approach

Add a small, governed **web I/O capability bundle** to the agent tool registry, gated by the same trust/approval arc as every other side-effect tool. No new runtime, no second path — they plug into `runtime.server.ts` + `loop.server.ts` like existing tools.

Use **Firecrawl** as the default provider (already the documented "default web data connector" in our knowledge base; covers search + scrape + map + crawl in one API; respects robots; returns LLM-ready markdown). Single new secret: `FIRECRAWL_API_KEY` via the Firecrawl connector. Lovable AI gateway handles any synthesis on the results — no second model path.

## Scope (what ships in this bundle)

### 1. New tools in `src/lib/ai/tools/registry.server.ts`

| Tool | Category | What it does | Default approval |
|---|---|---|---|
| `web.search` | `read` | Firecrawl `/search` → ranked results (title, url, snippet). Optional `scrape: true` returns markdown for each. Hard caps: `limit ≤ 10`, query ≤ 300 chars. | `auto` |
| `web.fetch` | `read` | Firecrawl `/scrape` on a single URL → markdown + metadata. Domain allow-list optional; otherwise open with per-run cap. | `auto` |
| `web.crawl` | `read` | Firecrawl `/crawl` async — bounded (`limit ≤ 25`, `maxDepth ≤ 2`). Returns job summary + pages. | `confirm` (it spends real credits and time) |
| `web.map` | `read` | Firecrawl `/map` → URL list for a domain. Cheap discovery before a crawl. | `auto` |

All four:
- Route through one `firecrawl.server.ts` helper that reads `FIRECRAWL_API_KEY` from `process.env`, never exposes it to the client.
- Log every call to `tool_calls` like any other tool (already automatic via the loop).
- Truncate returned content to a safe cap (e.g. 8 KB per page in `web.fetch`, 2 KB per result in `web.search`) before handing back to the model — keeps token spend predictable.
- Treat the result as **untrusted input** and run it through the existing pre-guardrails on the *next* model call (this is already how `runtime.server.ts` works — see `architecture/integrations.md` "Interop safety: prompt-injection guard on external server results"). No new code needed for that.

### 2. Agent allow-list seeding (migration)

Add `web.search`, `web.fetch`, `web.map` to the default `tool_allowlist` of:
- **Discovery** (so "scout features X on the web" works)
- **Strategist** (so positioning/PRD work can cite real competitor pages)
- **Growth** (so launch notes can verify what competitors actually say)
- **Orchestrator** (so it can route to whichever specialist needs the web)

`web.crawl` goes on Discovery + Orchestrator only (heavier).

Builder/Analyst stay web-less by default (can be added per user from the agent edit page later).

### 3. Secret + connector

- Use the **Firecrawl connector** (`standard_connectors--connect firecrawl`) so the key injects as `FIRECRAWL_API_KEY` at runtime. No manual secret prompt unless the user prefers it.
- Helper throws a clean, typed error if the key is missing — the agent surfaces "web tools not configured" in the trace, no silent failure.

### 4. UI touches (minimal — this is mostly backend)

- `/agents` agent-edit panel: the new tools appear in the tool toggles automatically (they're sourced from `TOOL_REGISTRY`). Add a small "Web" group header + tooltip explaining what each does.
- `/inbox` (approval queue): no change — `web.crawl` will appear like any other `confirm` tool with its preview string ("Crawl up to 25 pages from competitor.com").
- Trace viewer: no change — calls already render with args + result.

### 5. Docs (closed loop, same commit)

- **New:** `docs/web-access.md` — what each tool does, default approvals, how to extend (allow-lists, swapping providers), failure modes, cost note.
- **Update:** `architecture/integrations.md` — Firecrawl listed as a connector under the "Connectors (built)" table; "Interop safety" already covers the untrusted-input guard.
- **Update:** `architecture/orchestration.md` — add `web.*` to the tool catalog list.
- **Update:** `docs/feature-backlog.md` — new entry "Web access for agents" with status + "How to use / verify" block (one example mission: "Scout Linear's AI triage positioning and draft a non-reactive one-pager").
- **Update:** `plan.md` §4 — one-liner log entry.
- **Update:** `docs/README.md` — register `web-access.md`.
- **Update:** `docs/trust-and-autonomy.md` — mention `web.crawl` as a `confirm`-default example.
- **Update:** `docs/a2a-handoff.md` — note that handoff payloads can now include `web_sources[]` citations.

### 6. Verification

Concrete mission to confirm end-to-end:

> "Scout how Linear's AI triage is positioned (linear.app, recent blog posts), then draft a one-pager + positioning angle that does NOT sound reactive."

Expected trace:
1. Orchestrator → Discovery
2. Discovery: `web.search "Linear AI triage"` → `web.fetch` on top 2-3 URLs → `signals.log` with key claims + source URLs
3. Discovery → Strategist (handoff with `artifacts: [signal_ids]`)
4. Strategist: `workspace.search` for own product context → drafts PRD/one-pager citing real URLs (not invented quotes)

Pass criteria: (a) `tool_calls` shows real Firecrawl calls, (b) final artifact cites at least 2 real URLs from the fetch step, (c) no hallucinated quotes.

## Out of scope (next bundle)

- Per-user domain allow/deny lists (UI on `/governance`)
- A `web.research` higher-level tool that chains search→fetch→synthesize in one call (do this only if the basic primitives prove insufficient)
- Browser-automation / form-fill tools (real "browser use") — different risk profile, different bundle
- Swapping Firecrawl for Perplexity/Tavily — keep it single-provider for v1

## Technical details

- **No new runtime path.** Tools live in the existing registry; calls go through `loop.server.ts` → `tool_calls` logging → `runtime.server.ts` for any follow-up model call. Existing kill-switch, mission caps, and trust arc apply unchanged.
- **Cost containment.** Firecrawl charges per page. `web.search` (no scrape) is cheapest, then `web.map`, then `web.fetch`, then `web.crawl`. The `confirm` default on `web.crawl` is the main guard; per-mission spend cap is already enforced in `agent_runs`.
- **Prompt-injection.** Already handled by pre-guardrails on the next `callModel`. No new code, but the new doc will name the threat explicitly so future contributors don't strip the safeguard.
- **Citations.** Tool returns include the source URL; the agent's existing system prompt will be nudged (one line append for Discovery/Strategist) to "cite source URLs for any external claim".

### Files touched

- New: `src/lib/ai/tools/firecrawl.server.ts`, `docs/web-access.md`
- Edit: `src/lib/ai/tools/registry.server.ts` (add 4 tools), `src/lib/ai/prompts.server.ts` (one-line citation nudge for Discovery/Strategist), `supabase/migrations/<new>.sql` (allow-list seeding), `architecture/integrations.md`, `architecture/orchestration.md`, `docs/feature-backlog.md`, `docs/README.md`, `docs/trust-and-autonomy.md`, `docs/a2a-handoff.md`, `plan.md`
- Connector: `standard_connectors--connect firecrawl` (one-time user step)

## Open questions before I build

1. **Provider:** OK to default to **Firecrawl** (single connector, no extra keys, covers all four verbs)? Or do you want Perplexity for search + Firecrawl for fetch (two keys, slightly better search quality)?
2. **`web.crawl` default approval:** `confirm` (my recommendation — it costs real money and time) or `auto` for `Trusted`/`Ambient` arcs?
3. **Domain allow-list:** ship v1 fully open (any domain), or block obvious risky categories (file shares, paste sites) from day one?
