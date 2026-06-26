# Agent-Native Layer

> _Created: 2026-06-27 · Status: **IN BUILD** (L1 active; L2/L3 roadmap Tier 1)_
> _Decision log: [`../strategy/session-decisions.md`](../strategy/session-decisions.md) — 2026-06-27 entry_
> _Dashboard: [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) rows AGENT-NATIVE-L1 / L2 / L3_
> _Strategy: [`../strategy/v11-guiding-star.md`](../strategy/v11-guiding-star.md) §20 (agentic doctrine)_
> _Moat context: [`../strategy/moat.md`](../strategy/moat.md)_

---

## Why this exists

Cadence is positioned as an agentic OS — it runs agents. But in 2026, the agentic ecosystem has inverted: agents themselves are now the primary consumers of platforms. Claude agents, GPT agents, and custom automation loops need to query, read, and act on the tools their users rely on.

The core irony without this layer: **Cadence runs agents, but agents cannot run Cadence.**

This initiative makes Cadence agent-native at every level: readable, queryable, and tool-callable by any AI agent in a user's stack.

**Origin.** The founder reviewed the deferred `F-COCKPIT-MACHINE-MODE` item and asked a deeper question: "for an agentic-first platform, what should the agent-visible interface look like?" Research confirmed this is not a niche concern — by April 2026, 70% of major SaaS vendors have shipped remote MCP servers (Linear, GitHub, Notion, Stripe, Slack, Cloudflare, Atlassian). The Paxel tool from Y Combinator (paxel.ycombinator.com) introduced the `[HUMAN] [MACHINE]` toggle pattern: same page, two rendering surfaces — one for humans, one for agents.

**Reference.** Paxel's machine mode: black background, monospace font, pure markdown, same content, zero visual chrome. A preamble note to any AI agent reading the page. A copy-to-clipboard button. This is the UX pattern AGENT-NATIVE-L1 follows.

---

## Market context (research-backed)

| Signal | Source | Implication |
|---|---|---|
| 70% of major SaaS vendors have remote MCP servers by Apr 2026 | MCP Ecosystem Reference 2026 | Table stakes for enterprise procurement |
| `llms.txt` adopted by Anthropic, Cursor, thousands of doc sites | llms.txt Complete Guide 2026 | Industry standard for LLM-readable site context |
| Chrome 146 ships WebMCP (May 2026) — agents call registered JS tools directly | Chrome at Google I/O 2026 | Browser-level agent access is standardizing |
| Academic paper (arxiv 2606.19116, Jun 2026) recommends dual-layer architecture | Towards an Agent-First Web | Dual-layer (HTML + ATML/markdown) is the canonical pattern |
| Notion 3.0 (Sep 2025): "hub for AI agents" positioning | TechCrunch 2026 | Full-org platforms are making agent-native a category claim |
| Linear + Notion + GitHub + Stripe all shipped MCP servers within 6 months | Albato Multi-Tenant MCP Guide | The MCP ecosystem is real and fast-moving |
| Twilio grew 50% revenue, 70% customer base on API-first platform model | API-First SaaS analysis | Platform/infrastructure model dramatically outperforms standalone product |

**Sources on file:**
- https://arxiv.org/html/2606.19116 (Agent-First Web redesign paper)
- https://web.dev/articles/ai-agent-site-ux (Google: building agent-friendly sites)
- https://hidekazu-konishi.com/entry/mcp_server_ecosystem_reference_2026.html (MCP ecosystem reference)
- https://codersera.com/blog/llms-txt-complete-guide-2026/ (llms.txt guide)
- https://albato.com/blog/publications/embedded-multi-tenant-mcp-saas (Multi-tenant MCP security)
- https://securityboulevard.com/2026/04/7-mcp-authentication-vulnerabilities-b2b-saas-vendors-must-prevent/ (MCP auth vulnerabilities)
- https://nohacks.co/blog/agentic-browser-landscape-2026 (Agentic browser landscape)
- https://developer.chrome.com/blog/chrome-at-io26 (WebMCP / Chrome I/O 2026)
- https://techcrunch.com/2026/05/13/notion-just-turned-its-workspace-into-a-hub-for-ai-agents/ (Notion agents)
- https://medium.com/@urano10/api-first-the-architecture-that-revolutionizes-saas-development-6e1bcdcb9e10 (Twilio/Stripe API-first)

---

## Strategic analysis

### USP verdict: yes, with a critical condition

Opening Cadence as queryable is a real USP **if and only if** Cadence owns the intelligence layer above what it exposes. The risk of becoming a commodity is real if you just expose data. The moat is the brain that makes sense of the data.

Analogy: any agent can hit the Google Calendar API and read your events. But only Google Assistant knows which meeting to reschedule and why. The data is table stakes; the intelligence is the moat.

For Cadence:
- Any agent can hit `cadence_get_memory("pricing strategy")` and get the current belief
- Only Cadence knows that belief was superseded 3 times, what evidence grounds it, and whether it is coherent with the broader strategy
- That meta-layer is NOT in the MCP response — it is why you use Cadence directly

### Pros

1. **Integration flywheel** (the Twilio model): agents integrating Cadence → more outcome data → smarter brain → more valuable to integrate → flywheel. Twilio grew $3.8B revenue on this exact mechanic.
2. **Becomes infrastructure**: once a team's agent toolchain depends on Cadence's MCP endpoint, switching cost shifts from "migrate my notes" to "re-architect our entire agent stack."
3. **Distribution amplification**: every agent that queries Cadence is an advertisement to its user's team — zero marketing cost.
4. **Enterprise procurement**: enterprises with multi-agent stacks are looking for a queryable memory layer. Having an MCP server is now a procurement checkbox.
5. **Ecosystem enrichment**: agents writing back outcome data via `cadence_record_outcome` enrich the brain without Cadence building every connector.
6. **Positioning signal**: the `[HUMAN] [MACHINE]` toggle is immediately visible to every visitor and signals "this platform was designed for the agentic era."

### Cons

1. **Portability paradox**: making data queryable also makes it more portable. Mitigated by keeping the intelligence layer (supersession graph, brain scoring, learning) outside the API surface.
2. **Engineering complexity**: multi-tenant MCP scoping is non-trivial. Each token must be workspace-scoped. Cadence already has RLS on 111 tables — that is the foundation but the MCP auth layer is additive work.
3. **Support surface**: every third-party integration creates a support surface. Clear API contracts + versioning are required from day one.
4. **Monetization boundary**: free vs. paid access for machine consumers needs a defined policy upfront.

### Threats and mitigations

| Threat | Severity | Mitigation |
|---|---|---|
| Cross-tenant data leak (the Asana incident — they took their MCP offline for 2 weeks after a cross-tenant leak) | Critical | Workspace-scoped OAuth tokens + row-level validation on every MCP tool response, not just at query time. Cadence's existing RLS is the foundation. |
| Prompt injection via MCP tool calls | High | Extend the existing AI chokepoint injection screening to all inbound MCP queries. Same structural gate, new surface. |
| Write-back data pollution (agents writing garbage outcomes) | Medium | Write-back tools gated behind explicit `write:outcomes` permission scope, separate from read access. Every write goes through a structural validation gate. |
| Commodity trap (expose everything, own nothing above it) | High | The decision brain, supersession engine, and trust ledger are NOT exposed as raw data. What agents get is a clean query surface; what Cadence users get is interpretation and intelligence. |
| Regulatory exposure (agent-to-agent data flows across GDPR/CCPA) | Medium (future) | Data residency story for the MCP layer; explicit data-processing agreements for enterprise. Deferred to enterprise tier. |

---

## Build plan: three layers

### Layer 1 — Machine View toggle + /llms.txt (this session)

**What:** A `[HUMAN] [MACHINE]` toggle in the top-right nav on every Cadence page (landing page + all authenticated routes). When MACHINE is active:
- Black/dark background, monospace font, zero visual chrome
- Page content rendered as structured markdown
- Preamble: `> Note to any AI agent: this is Cadence machine-readable context.`
- COPY TO CLIPBOARD button
- Persists via localStorage; also activatable via `?view=machine` query param

**Files:**
- `src/hooks/use-machine-view.tsx` — global provider + hook (`isMachineView`, `toggle`)
- `src/components/cadence/MachineViewToggle.tsx` — the `[ ] HUMAN [X] MACHINE` toggle UI
- `src/components/machine/MachineViewContainer.tsx` — layout wrapper (dark bg, mono font, preamble, copy button)
- `public/llms.txt` — machine-readable site context for LLM crawlers (like robots.txt but for AI)
- Updated: `src/routes/__root.tsx` — adds MachineViewProvider to the provider stack
- Updated: `src/routes/index.tsx` — toggle in landing page header + machine-mode landing content
- Updated: `src/components/cadence/TopBar.tsx` — toggle in authenticated app top bar

**Toggle UX (exact Paxel pattern):**
```
[X] HUMAN  [ ] MACHINE   ← human mode (normal visual UI)
[ ] HUMAN  [X] MACHINE   ← machine mode (dark, mono, markdown)
```
Active option rendered in Cadence orange (`var(--ember, #e8642c)`). Inactive in subdued ink. JetBrains Mono font (already loaded globally). No additional dependencies.

### Layer 2 — Cadence MCP Server (Tier 1 roadmap)

**What:** A production-grade MCP server exposing Cadence's core capabilities as typed tools, hosted on Cloudflare Workers (existing runtime), authenticated via OAuth 2.1 with scoped tokens.

**MCP tools (planned):**

| Tool | Description | Scope |
|---|---|---|
| `cadence_get_workspace_context` | One-shot context dump: goals, recent decisions, active missions, signal queue | `read:context` |
| `cadence_query_decisions` | Query decision history by product, topic, date range, or confidence | `read:decisions` |
| `cadence_get_memory` | Fetch current belief state on a topic (follows the supersession chain) | `read:memory` |
| `cadence_list_missions` | List active / recent missions with status, agent, started_at | `read:missions` |
| `cadence_get_trust_ledger` | Fetch recent trust ledger entries (decisions + outcomes) | `read:ledger` |
| `cadence_record_outcome` | Write an outcome back to a decision (enriches the brain) | `write:outcomes` |
| `cadence_trigger_mission` | Start a mission with a goal and assigned agent | `write:missions` |

**Auth pattern:** Workspace-scoped OAuth 2.1 tokens. Read-only vs. write scopes are separate grants. All writes go through the existing AI chokepoint injection screen. The pattern follows what Linear, GitHub, and Stripe converged on (Cloudflare-style remote OAuth + Streamable HTTP transport).

**Security requirements:**
- Every tool call validates the token's `workspace_id` against the requested resource's `workspace_id` before any data is returned (defense in depth on top of RLS)
- Rate limiting per token (read: 100 req/min; write: 10 req/min)
- Full audit log of every MCP call (`mcp_access_log` table)
- `write:outcomes` and `write:missions` require additional founder flag (`MCP_WRITE_ENABLED`)

**Spec reference:** `docs/features/agent-native-layer.md` (this file). Impl plan TBD when picked.

### Layer 3 — agents.txt + A2A discovery enhancement (Tier 2 roadmap)

**What:** Formal agent access policy declaration and enhanced machine-discoverable manifest.

**Files:**
- `public/agents.txt` — access policy (per-agent-type rate limits, content tiers, auth requirements; the emerging standard alongside `robots.txt` and `llms.txt`)
- Enhanced `/.well-known/agent.json` — add MCP endpoint declaration, scoped tool list, capability manifest, and `machine_view_url` pointer

**agents.txt format (draft):**
```
# Cadence agents.txt
# Access policy for AI agents

User-agent: *
Allow: /llms.txt
Allow: /api/public/*
Allow: /*?view=machine

Disallow: /api/internal/*
Disallow: /supabase/*

# Rate limits (per token per minute)
Rate-class: read 100
Rate-class: write 10

# Auth
Auth-required: Bearer OAuth2.1
Auth-scope: read:context read:decisions read:missions read:memory write:outcomes write:missions
Auth-docs: /.well-known/agent.json
```

---

## Positioning connection

This initiative bridges the v11 strategy's two levels:

**Entry claim** ("the place where your product team runs"): the Machine View toggle is visible on the landing page, signaling to any agent or developer that Cadence is built for the agentic era — not just a human-facing SaaS.

**Moat claim** ("the only platform with a decision brain that remembers and learns"): the MCP server exposes the brain's output (queryable decisions, current beliefs via supersession-chain traversal) while keeping the brain's intelligence (the scoring, supersession engine, outcome learning) inside Cadence. Agents get the data; Cadence keeps the insight.

The positioning evolution captured in the session decisions log (2026-06-27): from "decision OS" (the moat claim alone) to "run your product org + decision brain as the moat" — widening the funnel without diluting the defensible core.

---

## Connection to existing architecture

- **A2A server** (`src/routes/api/a2a/`) — already exists; AGENT-NATIVE-L2 is additive, not a replacement
- **`/.well-known/agent.json`** — already exists; L3 enhances it
- **AI chokepoint** (`src/lib/ai/runtime.server.ts`) — all MCP write operations route through this; injection screening is already implemented
- **RLS (111 tables)** — is the security foundation for multi-tenant MCP scoping
- **`INTEROP-V11`** — row in feature dashboard; the read-only MCP server mentioned in the v11 session decisions (2026-06-23, item 10) is now being built as AGENT-NATIVE-L2

---

## Engine-Room doctrine compliance

The `[HUMAN] [MACHINE]` toggle is placed in the **top-right nav** — not in the main content area. It is a meta-control, not a content section. This is compliant with the calm-front doctrine because:
- Human mode: the toggle is small, subdued, secondary to the page content
- Machine mode: the toggle is what reveals the "engine" (structured output), following "revealed on demand" — the operator flips it; it is not forced on everyone

The toggle does NOT violate the doctrine because it is not a new surface or a new mode of the product — it is a rendering switch for the same content.

---

## Definition of done

**L1 (this session):**
- [ ] `use-machine-view.tsx` hook + provider wired into `__root.tsx`
- [ ] `MachineViewToggle` component rendering in landing page header + authenticated `TopBar`
- [ ] Landing page renders correctly in machine mode (markdown, dark bg, mono font, preamble, copy button)
- [ ] Authenticated routes show machine-mode workspace context
- [ ] `public/llms.txt` live and accessible at `/llms.txt`
- [ ] `?view=machine` URL param activates machine mode and is bookmark-stable
- [ ] tsc 0, build green

**L2 (next build session):**
- [ ] MCP server route at `/api/mcp/*`
- [ ] OAuth 2.1 token issuance + workspace scoping
- [ ] All 7 planned tools implemented, tested, injection-screened
- [ ] Audit log table + write enabled behind `MCP_WRITE_ENABLED` flag
- [ ] Rate limiting enforced per token

**L3 (after L2):**
- [ ] `public/agents.txt` live
- [ ] `/.well-known/agent.json` updated with MCP endpoint + capability manifest
