# docs/feature-backlog.md — The granular feature backlog (build-ready)

> **What this is.** The exhaustive, sub-feature-level enumeration of *everything Cadence is built to ship* — the dev-ready expansion of [`../plan.md`](../plan.md) §2 (granular catalog). Every feature has a **stable ID** (e.g. `F2.3`) so it can become an issue/PR/spec and be referenced by traces, decisions, and the build log without re-describing scope.
>
> **Relationship to other docs (no duplication of rules).** Product thesis + USP/MOAT: [`../README.md`](../README.md). Build *order*: [`../plan.md`](../plan.md) §3. Cross-cutting non-functional rationale + P0/P1/P2 priorities: [`../docs/considerations.md`](./considerations.md). UI/IA/screen + AI-message contract: [`../design.md`](../design.md). Architecture contracts: [`../architecture/`](../architecture/). Operating rules: [`../AGENTS.md`](../AGENTS.md).
>
> **This file adds detail; it does not replace `plan.md`.** `plan.md` stays the narrative + build order; this is the flat, addressable scope list. Keep both true (closed doc loop, [`../AGENTS.md`](../AGENTS.md) §5).
>
> **Looking for the next task to pick up?** Jump to the [Build-order rollup](#build-order-rollup-status--build-sequence) at the bottom — it is the canonical task queue. The strategic P0–P3 view is [`../TASKS.md`](../TASKS.md), which points back here.

---

## ▶ Live status board — the single "where are we right now?" (keep current)

> **Every tool updates this, every session, in the same unit of work as the change** — Claude Code · Antigravity · Gemini · Lovable. This is the live *cursor*; the full append-only history is [`../plan.md`](../plan.md) §4. Update contract: [`../AGENTS.md`](../AGENTS.md) §5. Resolution of "Next up" is mechanical — see the [Build-order rollup](#build-order-rollup-status--build-sequence).


| Field | Current |
|---|---|
| 🔨 **Now building** | **— idle —** Bundle 3 (C6 Trust Score + Autonomy Dial) shipped this turn; ready to start Bundle 4 once operator picks it up. Open from Bundle 6 still: operator-driven end-to-end mission run + forced-restart integration test for FND-RUNTIME 0.9. |
| ⏭️ **Next up** | Bundle 4 (E1–E5 A2A handoff) → Bundle 5 (E6 Mission Graph) → Bundle 6 lifecycle close (9+10+11+12). Full sequence in [§ Agentic Proof Platform (v1.1)](#-agentic-proof-platform-v11--full-product-lifecycle-end-to-end-on-real-systems). |
| 🚧 **Blocked / stuck** | — none. |
| 📊 **Progress** | Step **3 of 12** ✅ Trust Score + Autonomy Dial (C6) shipped — `agent_autonomy` table + dial UI on `/agents` + dial composed with `agent_tools.mode` in the loop's approval-gate decision. Step 1 lifecycle-slice verification + forced-restart test still ◑. **Proof-platform v1.1 overlay:** bundle 1 ◑ · bundles 2–3 ✅ · bundles 4–12 ☐. |

**Recent log** (newest first; trim to ~5 — full history lives in [`../plan.md`](../plan.md) §4):
- `2026-06-04` — **Bundle 3 Agent Trust Score + Autonomy Dial (C6) shipped.** New `agent_autonomy` table (one row per user+agent, arc ∈ observing/proving/trusted/ambient, owner-only RLS). Trust score computed on read from real signals (mission completion rate, approval acceptance rate, eval mean — Bayesian-shrunk toward 0.5 when sample <10). New `src/lib/ai/trust.server.ts` exports `computeAllAgentTrust`, `resolveApprovalMode`, `suggestArc`, `loadAgentArc`. New server fns `getAllAgentTrust` / `setAgentArc` in `src/lib/trust.functions.ts`. Agent loop now calls `resolveApprovalMode(toolMode, arc)` at the gate decision: Observing forces `review` even on `auto` tools; Trusted runs `confirm` tools inline; Ambient runs all inline (except hard-locked `calendar.create` which keeps `confirm`). Safety floor: `review` tools are never downgraded. `/agents` shows a Trust chip (0–100, color-tiered, hover tooltip with formula + breakdown) on every roster button + agent header, and an inline Autonomy Dial (4 buttons + suggested-arc hint) inside the agent detail card. Files: `supabase/migrations/<ts>_agent_autonomy.sql`, `src/lib/ai/trust.server.ts`, `src/lib/trust.functions.ts`, `src/lib/ai/loop.server.ts`, `src/routes/_authenticated.agents.tsx`.
- `2026-06-04` — **Brief injection verifiable end-to-end.** `/agents` page was wired to a legacy single-shot `runAgent` that bypassed the loop, so dispatches produced `ai_events` rows with `trace_id = NULL` (invisible on `/traces`) and the workspace brief never reached the system prompt. Switched the page to `agent_loop.functions.ts → runAgent` (which calls `runAgentLoop`, generates a trace id, loads `workspace_briefs`, and injects `renderBriefBlock`). Dispatches now appear on `/traces`; the first step's system prompt contains the `--- Workspace Strategic Brief ---` block.
- `2026-06-04` — **Briefing save permanent fix.** Root cause: some signed-in accounts could reach `/briefing` before a client-side active workspace existed, while workspace bootstrap was not guaranteed at the database boundary. Fixed at both layers: the database now guarantees every existing and future profile has a default workspace + owner membership; `upsertBrief` resolves a missing workspace server-side; the `/briefing` Save button no longer stays disabled because browser workspace context is late. Verification: edit Current focus → Save button enabled → click Save → server function returns 200 → button returns to Saved; no briefing console errors.
- `2026-06-04` — **Bundle 2 Strategic Briefing (C5) + `prd.link_issue` shipped.** New `workspace_briefs` table (one per workspace; mission / target user / current focus / anti-goals / notes; member-read, owner-write RLS). Server fns `getActiveBrief` + `upsertBrief` in `src/lib/briefs.functions.ts`. Pure `renderBriefBlock()` emits a labelled, fenced text block (skipped when every field is empty). Agent loop reads the brief for the resolved workspace and injects it **between the agent's own system prompt and memory recall** — so Discovery / Strategist / Builder all see the operator's shared context first. New `/_authenticated/briefing` editor (5 textareas + Save + toast) pinned to the sidebar as **"Briefing"**. Also added the small `prd.link_issue` agentic tool (write/confirm, idempotent — sets `prds.github_issue_url`) to close Bundle 6's PRD↔issue link-back; backfilled for every existing user. Verification: edit the brief, run a mission, observe the Strategist honoring Current focus / Anti-goals. Files: `src/lib/briefs.functions.ts`, `src/routes/_authenticated.briefing.tsx`, `src/lib/ai/loop.server.ts`, `src/lib/ai/tools/registry.server.ts`, `src/components/cadence/AppShell.tsx`, plus the migration.
- `2026-06-03` — **PM lifecycle tools landed.** Added 3 agentic tools to `TOOL_REGISTRY` and seeded them for every user (default `confirm` mode): `research.synthesize` (Discover — clusters recent ungrouped signals into themes via the AI chokepoint, writes `themes` rows, links `signals.theme_id`), `prd.draft` (Define — pulls opportunity + theme + top supporting signals, drafts a structured PRD with problem/goals/non-goals/stories/metrics/risks, writes a `prds` row in `draft` status), `backlog.prioritize` (Plan — re-scores ICE on backlog opportunities grounded in supporting-signal counts + recency, returns the new ranked list). All three route through `callModel` (surfaces `discovery` / `prd`) so they show up in traces, hit guardrails + budgets, and respect the agent loop's checkpoint/idempotency layer. Existing agents (Discovery Scout, PRD Writer, Strategist) pick them up automatically — the loop filters `TOOL_REGISTRY` by what the user has enabled, no per-agent assignment needed. Migration `seed_pm_lifecycle_tools(uuid)` backfills every existing user once and is folded into `seed_default_agent_tools(uuid)` for new signups.
- `2026-06-03` — **FND-RUNTIME 0.9 runtime + N1 `github.issue.create` landed.** Added `src/lib/runtime/idempotency.server.ts` (`withIdempotency(scope,key,...)` against the new `idempotency_keys` table — INSERT-then-fallback-to-cached on conflict). Refactored `src/lib/ai/loop.server.ts` into a shared `executeLoop()` body fed by both `runAgentLoop()` (fresh) and new `resumeAgentLoop(runId)` (rehydrates from latest `agent_run_checkpoints` row). Each iteration now upserts a checkpoint BEFORE the provider call (so a `GovernanceHaltError` mid-stream doesn't re-bill on resume) and wraps tool execution in `withIdempotency` keyed by `tool:{runId}:{stepIndex}:{toolName}`. Added per-workspace backpressure (default 5 concurrent `running` runs; over-cap missions insert as `status='queued'`). New `/api/public/hooks/resume-runs` sweeper picks up `queued` runs + `running` runs whose `last_checkpoint_at` is >2 min stale; wired to `pg_cron` every minute. Added `github.issue.create` agentic tool: write category, default `confirm` mode, allow-listed to the single `GITHUB_REPO` env, idempotent via caller-supplied `idempotency_key` (e.g. PRD id) so re-execution never double-creates an issue. Ready for the operator to run the Discover→Define→Plan mission against a real Cadence signal.
- `2026-06-03` — **FND-RUNTIME 0.9 foundation landed.** Wrote `docs/decisions/durable-runtime.md` (chose DB-backed job table over Cloudflare Queues — matches existing `/api/public/hooks/*` + `pg_cron` + tenancy patterns, zero new infra, portable). Applied migration adding `agent_run_checkpoints` (append-only per-step snapshot, UNIQUE on `(run_id, step_index)`) + `idempotency_keys` (scope/key dedup for ticks + tool calls) + `agent_runs.step_index` / `last_checkpoint_at`. Both new tables have GRANTs + RLS scoped to `auth.uid()`. Requested + received `GITHUB_TOKEN` + `GITHUB_REPO` secrets so the next stage (Bundle 6 lifecycle slice + N1 `github.issue.create`) is unblocked. `active-task.md` extended with the loop/resume/sweeper + lifecycle-slice sub-steps and a handoff note.
- `2026-06-03` — Extended Agentic Proof Platform → **v1.1: full PM lifecycle** (Discover → Define → Plan → Build → Test → Ship → Launch → Support → Learn → re-feeds Discover). Un-deferred S4–S6, L, M under a **realism rule** (agents orchestrate existing tools — GitHub, CI, deploy, Slack/email, support channel — they don't replace IDEs/CI/helpdesks). Added 4 new bundles (9 Build+Test, 10 Ship, 11 Launch, 12 Support→Learn), 7 new reserved IDs (N1, I-thin, J-thin, K-thin, L-thin, M-thin, Z1), expanded build sequence 8→12 steps, locked Cadence-on-Cadence as default real-data seed including PRs on this repo (`GITHUB_TOKEN` to be added when Bundle 9 starts). Logged in `docs/strategy/session-decisions.md`; `active-task.md` unchanged (FND-RUNTIME 0.9 still next).
- `2026-06-03` — Reframed the YC demo cut into the **Agentic Proof Platform (v1)**: same 8 capability bundles + sequence, but each now ships against an explicit **proof bar** (something legacy PM tools structurally cannot do), mapped to four claims (C1 agents operate/humans govern · C2 A2A handoff is first-class · C3 one governed loop · C4 trust is dialed). YC demo becomes a by-product; the platform is the point. Renamed `§ YC demo cut` → `§ Agentic Proof Platform (v1)`; logged in `docs/strategy/session-decisions.md`; `active-task.md` unchanged (FND-RUNTIME 0.9 still next).
- `2026-06-03` — Locked YC demo cut: 8 capability bundles centered on agent-to-agent comms + handoff (E1–E6), Founder-as-PM persona, autonomous Build/Test/Ship (S4–S6) explicitly deferred, real demo data. *(superseded by 2026-06-03 reframe above; sequence + IDs unchanged.)*

### How to update this board (any tool)
- **Starting work** → set **Now building** to `‹ID› · ‹tool› · ‹branch›`; clear it from **Next up**.
- **Pausing/ending a session** → if work is mid-flight, leave **Now building** set so the next tool/session knows where you stopped; otherwise clear it.
- **Hitting a wall** → add to **Blocked / stuck**: the ID, the blocker, what unblocks it.
- **Finishing a feature** → flip its `[status]`/rollup mark to `☑`, append a one-liner to **Recent log** *and* [`../plan.md`](../plan.md) §4, recompute **Progress**, and reset **Next up** from the rollup.
- Always refresh **Last updated** (date · tool · branch).

---

## ▶ Agentic Proof Platform (v1.1) — full product lifecycle, end-to-end on real systems

> **What this is.** A scope overlay — not a new roadmap. The exhaustive backlog below is unchanged. This section picks the smallest subset of existing features whose *combined, end-to-end behavior on real data* proves that Cadence delivers agentic-native product management that legacy PM tools (Jira, Linear, Productboard, ProductPlan, Aha) structurally cannot. **The YC demo is a by-product; the platform is the point.**
>
> **Locked decisions (2026-06-03):** Demo persona = **Founder-as-PM** ("run the product org you can't afford to hire"). Demo data = **real product** (default: Cadence-on-Cadence; design partner is additive). **v1.1 un-defers Build/Test/Ship/Launch/Support** to cover the whole PM lifecycle end-to-end — under one realism rule: *agents orchestrate existing tools (GitHub, CI, deploy, Slack/email, support channel) where the tool already exists; they don't replace IDEs, CI, or helpdesks.* See [`docs/strategy/session-decisions.md`](../docs/strategy/session-decisions.md) for the reframe.
>
> **From demo cut → proof cut.** Every bundle now ships against an explicit **proof bar** — the minimum behavior that makes the claim true on real data, not just visible in a screenshot. If a visitor cannot point to each of the four claims being true in the running product within ~5 minutes, the bundle hasn't shipped.

### The four claims we are proving

| # | Claim (vs. legacy PM tools) | Proof artifact |
|---|---|---|
| **C1** | Agents **operate**, humans govern — agents run multi-step missions, not assist with forms | Live Mission Graph + Decision Queue with real approval gates firing |
| **C2** | **Agent-to-agent handoff is first-class** — no human in the routing path | A2A trace: Discovery → Strategist → Planner, each reading prior agent's structured output, with full lineage |
| **C3** | The **whole lifecycle is one governed loop** — Discover → Define → Plan → Build → Test → Ship → Launch → Support → Learn (re-feeds Discover) | One continuous mission from a real signal to a re-scored opportunity, passing through a real PR, real merge, real deploy, real outbound message, real inbound ticket |
| **C4** | **Trust is earned and visible** — autonomy is dialed, not assumed | Trust Score + Autonomy Dial per agent, changing behavior of approval gates in real time |

### Realism rule (so "full lifecycle" doesn't become "half-baked everywhere")

For each lifecycle stage, the demo bar is: a real artifact lands in a real external system that a PM would actually use, driven by an agent through a real integration. No mocks. No "click here and pretend it deployed."

| Stage | Real external system | Real artifact | What the agent owns | What we do NOT build |
|---|---|---|---|---|
| Discover | Cadence DB (own signals: feedback, issues, session-decisions) | Themes + scored opportunities | Discovery agent: ingest, cluster, score | New signal connectors beyond what 0.x has |
| Define | Cadence DB (PRD doc, tiptap) | Versioned PRD with lineage to opportunities | Strategist agent: draft + iterate | A new doc editor |
| Plan | Cadence DB + GitHub Issues | Sprint plan + real issues in GitHub | Strategist proposes; Orchestrator writes via GitHub MCP on approval | Replacing Linear/Jira |
| Build | GitHub PR | A real PR on the Cadence repo for one planned task | Builder agent: scoped diff + PR via GitHub MCP | A custom autonomous IDE (Cursor/Devin) |
| Test | GitHub Actions (existing CI) | CI run on the PR; agent reads results | Builder: watch CI, surface failures, propose fix | A new test runner |
| Ship | GitHub merge + existing deploy webhook | Merged PR + deploy event recorded | Builder (with approval gate): merge; Cadence ingests deploy webhook | A new deploy pipeline |
| Launch | Markdown changelog + one outbound channel (email/Slack via MCP) | Real changelog + a real draft message in the channel | Growth agent: draft on ship; send on approval | A marketing automation tool |
| Support | One real inbound channel (email forward / webhook) | Tickets ingested, triaged, routed back as signals | Support agent: triage + link to PRD/opportunity | A full helpdesk (Zendesk) |
| Learn | Cadence DB | Outcome attached to opportunity → re-scored → re-ranked next sprint | Analyst agent: measure, insight memo, feed Trust Score | A full analytics product |

### The 12 capability bundles + proof bars

Each bundle composes existing backlog IDs; nothing here is a parallel scope. Bundles are ordered by the dependency chain, not priority.

| # | Bundle | Proof bar (what makes the claim true) | Backlog IDs | Supports | Status |
|---|---|---|---|---|---|
| 1 | **Governed Foundation** — tenancy, AI chokepoint, trust tables, blast-radius, kill-switch + spend caps, injection defense, durable runtime | Killing an agent mid-mission halts spend within 1 tick; every action has an audit-log row queryable from the UI. | 0.1, 0.2, 0.3, 0.5, **0.6** ✅, **0.7** ✅, 0.9, A1/A2 | C1, C4 | ◑ (0.6 + 0.7 done; 0.9 next) |
| 2 | **Strategic Briefing surface** | Changing the brief visibly changes the next Discovery + Strategist output (not just stored). | C5 (new) ✅ | C1, C3 | ☑ |
| 3 | **Agent Roster + Trust Score + Autonomy Dial** | Dialing autonomy from Observing → Trusted removes a specific approval gate; Trust Score moves based on real outcomes (eval pass-rate, approval-acceptance, mission success). | C1, C2, C3, C4, **C6** (new) | C1, C4 | ☐ |
| 4 ⭐ | **Agent-to-Agent comms + handoff + sub-agent spawning** | One mission with **≥3 hops** between agents, each reading prior agent's **structured** output via the orchestration layer (not prompt-stuffing), full trace replayable. | E1, E2, E3, E4, E5 | C2 | ☐ |
| 5 | **Live Mission Graph** | The graph updates in real time as agents act; clicking a node opens that agent's trace + cost + tokens + approval state. | E6, X1 | C1, C2 | ☐ |
| 6 | **Lifecycle slice — Discover → Define → Plan on real data** | Real signals → real PRD → real sprint plan → one approval-gated item → on approval, **real GitHub issue created via MCP**. End-to-end, no human routing. | F1, F2, F3, G1, H1 + **N1** (new, GitHub-issues sync) | C3 | ◑ (legacy parts reusable) |
| 7 | **Decision Queue + approval gates UX** | Every gate the agents hit lands in the queue with context (what, why, cost-if-approved, who proposed); approve/reject changes downstream agent behavior. | D3, P-approvals | C1, C4 | ◑ (reusable) |
| 8 | **Product Memory + lineage + full data export** | Every artifact (signal → theme → opportunity → PRD → decision) has lineage backward to its source; "Export everything" produces a complete, re-importable archive. | O1, O2, U6 (new) | C3 | ☐ |
| **9** | **Build + Test bundle** — Builder agent + scoped PR + CI read | Builder opens a **real PR** on the Cadence repo for one planned task; reads CI status; proposes a fix on failure. All gated by approval mode. | **I-thin (S4)**, **J-thin (S5)** + GitHub MCP write scope | C2, C3 | ☐ |
| **10** | **Ship bundle** — approval-gated merge + deploy webhook ingest | Operator approves merge → real merge → existing deploy webhook lands → Ship node lights up on Mission Graph with deploy URL + commit SHA. | **K-thin (S6)** + deploy webhook ingest | C1, C3 | ☐ |
| **11** | **Launch bundle** — changelog + one outbound channel | Growth agent drafts changelog + outbound message on ship; operator approves; message is **really sent** to one real channel (Slack or email). | **L-thin** (changelog + one outbound integration) | C3 | ☐ |
| **12** | **Support → Learn loop** — one inbound channel + Analyst learn loop | Real ticket arrives via one channel → Support agent triages and links to source PRD/opportunity → Analyst attaches outcome and re-scores → next Discovery cycle reflects it. **The loop closes.** | **M-thin** (one inbound channel) + **Z1** (Analyst learn loop) on O1/O2 | C2, C3, C4 | ☐ |

### Build sequence (Proof Platform v1.1)

1. **Finish foundation gaps** — **0.9 FND-RUNTIME** (long missions must survive worker restarts before handoff is meaningful) → **0.2 cache stage**. *(Matches existing Build-order rollup step 1.)*
2. **C5 Strategic Briefing** — small, high-leverage; gives the swarm shared operating context.
3. **C1/C4 + C6 skeleton** — roster UI + read-only Trust Score; scoring math can come later.
4. **E1–E5** — the A2A primitives (protocol + tables + tracing). Hardest bundle; budget the most time here. **This is where C2 becomes true.**
5. **E6 Mission Graph** — the visualization on top of #4. Without #4 it's a fake screenshot.
6. **Bundle 6: Discover→Define→Plan slice + N1 GitHub-issues sync** — Plan stage writes real GitHub issues on approval.
7. **Bundle 9: Build + Test (I-thin, J-thin)** — Builder opens a real, scoped PR on the Cadence repo and reads CI.
8. **Bundle 10: Ship (K-thin)** — approval-gated merge + deploy webhook ingest into Mission Graph.
9. **Bundle 11: Launch (L-thin)** — changelog + one outbound channel (Slack or email) with send-gate.
10. **Bundle 12: Support → Learn (M-thin + Z1)** — one inbound channel + Analyst outcome/re-score. **The full lifecycle loop closes here.**
11. **D3 polish** — make it the obvious "govern here" surface.
12. **O1/O2 lineage view + U6 Export** — anti-lock-in proof.

### Real-data seeding (default: Cadence-on-Cadence)

Bundles 6, 9, 10, 11, and 12 all run on real product data. **Default seed = Cadence itself** (we run our own roadmap on Cadence: real signals from this repo's issues, decisions, session-decisions log, feature-backlog; real PRs on this repo; real deploys; one outbound channel; one inbound support address). Most credible YC story ("we eat our own dog food") and no design-partner dependency. If a design partner is signed later, their product becomes an additional seed — not a replacement.

**Repo-write decision (Bundle 9):** Builder agent opens PRs on the **Cadence repo itself** (option (a) from the plan). Requires a `GITHUB_TOKEN` runtime secret with `repo` scope; branch protection on `main` enforces that no agent can bypass review. To be added when Bundle 9 starts — not now.

### Demo narrative (one continuous mission, ~3 minutes)

> Operator updates the Strategic Briefing. Discovery ingests Cadence's own signals and surfaces a re-ranked opportunity. Strategist drafts a PRD via A2A handoff. Planner proposes a sprint; one item is high-blast-radius → lands in Decision Queue. Operator approves. Orchestrator writes a **real GitHub issue**. Builder opens a **real PR** on the Cadence repo, watches CI. CI passes. Merge gate fires → operator approves → **real merge** → **real deploy webhook** lands → Ship node lights up on Mission Graph. Growth drafts a **real changelog + outbound message**; operator approves; message **really sends**. Two days later, a **real support ticket** lands; Support agent triages and links it back to the same opportunity; Analyst attaches the outcome, re-scores the opportunity, writes the insight memo. The next Discovery cycle reflects the learning. Operator opens Product Memory → sees full lineage from ticket → opportunity → PRD → PR → deploy → ticket. Clicks Export.

Every step in that paragraph is real behavior on real systems, not a slide.

### Explicitly deferred (NOT in v1.1, NOT removed from the product)

External-facing **MCP / A2A interop** (Q — Cadence exposing its agents to outside callers), advanced eval / drift / guardrail UIs beyond what the chokepoint already does, multi-product portfolio view (B3), BYO keys UI polish (A5), billing UI, full autonomous coding/IDE depth (we orchestrate GitHub via MCP; we do NOT replace Cursor/Devin), full helpdesk depth (one inbound channel only), marketing-automation depth (one outbound channel only), analytics dashboards (Learn is a re-score + insight memo). Positioning: *"agentic orchestration of the existing stack; each integration deepens over time."*

### New features this overlay adds to the backlog

These need feature entries written in full when their bundle becomes the next-up task. Stubbed here so the IDs are reserved:

- **C5 — Strategic Briefing surface** `[new]` · `P0` · `X1` — Single doc per product: north star, current goals, hard constraints, working agreements. Every agent loads it as system context. Versioned; changes propagate to in-flight missions on next step.
- **C6 — Agent Trust Score + Autonomy Dial** `[new]` · `P0` · `X1` — Per-agent score derived from eval pass-rate, approval-acceptance-rate, mission success-rate. Operator can move each agent along the trust arc (Observing → Proving → Trusted → Ambient) and the dial changes the default approval mode.
- **U6 — Full data portability / export** `[new]` · `P0` · `U` — Export signals, themes, opportunities, PRDs (markdown), decisions+lineage (JSON), agent configs (YAML), and the product-memory graph (JSON). One-click per product; scheduled exports later.
- **N1 — GitHub Issues sync (write)** `[new]` · `P0` · `H` — On approval of a sprint plan item, Orchestrator creates a real GitHub issue via GitHub MCP with title/body/labels and back-links to the PRD + opportunity. Bidirectional status sync read-only at first.
- **I-thin — Builder agent (scoped PR)** `[new]` · `P0` · `I` — Thin slice of S4: Builder picks one planned task, produces a small scoped diff, opens a real PR on the Cadence repo via GitHub MCP. Blast-radius `high`; default approval mode `confirm`. NOT an autonomous IDE — scoped diffs only.
- **J-thin — CI-read for Builder** `[new]` · `P0` · `J` — Thin slice of S5: Builder reads GitHub Actions status on its open PR, surfaces failures, proposes a fix as a follow-up commit. No custom test runner.
- **K-thin — Merge gate + deploy webhook ingest** `[new]` · `P0` · `K` — Thin slice of S6: approval-gated merge via GitHub MCP; `/api/public/hooks/deploy` ingests deploy events from the existing platform (Cloudflare/Vercel) and posts a Ship node to the Mission Graph with deploy URL + commit SHA.
- **L-thin — Changelog + one outbound channel** `[new]` · `P0` · `L` — On ship event, Growth agent drafts a markdown changelog entry + a single outbound message (Slack OR email, one channel only for v1.1). Send is approval-gated. Real send via MCP/connector, no mocks.
- **M-thin — One inbound support channel** `[new]` · `P0` · `M` — Single inbound channel (email forward or webhook) ingests tickets into `signals` with `source='support'`. Support agent triages and links each ticket to a PRD or opportunity if matched.
- **Z1 — Analyst learn loop** `[new]` · `P0` · `O` — Analyst agent attaches a measured outcome to each shipped opportunity, re-scores it (ICE re-rank), writes a short insight memo, and feeds the result into Trust Score inputs. Closes the lifecycle loop back into Discover.

---

## How to read an entry

```text
ID. Feature name                         [status] · Pn · stage
   What     — one sentence: what it is.
   Build    — the granular sub-features (the actual checklist).
   States   — loading/empty/error/edge cases that must be handled.
   Done when— acceptance signal(s) that mark it shippable.
   Depends  — prerequisite IDs.
```

**Status** (from `plan.md` §2): `[reuse]` legacy survives largely as-is · `[extend]` legacy base + new work · `[new]` build from scratch · `[found]` foundation/non-functional (architecture, not a screen).

**Priority** (from `considerations.md` precedence, P0 highest): `P0` credible first user / built into foundation now · `P1` before/at first enterprise sale · `P2` scale & maturity.

**Stage**: lifecycle `S1`–`S9` (Discover→Learn) · platform `X1`–`X6` · `FND` foundation · `NFR` cross-cutting non-functional.

**Legend for the rollup tables:** ☐ not started · ◑ partial (legacy exists, needs hardening) · ☑ done & verified into the active build log.

---

## Epic map (24 epics)

| # | Epic | Maps to |
|---|---|---|
| 0 | Foundation, tenancy & runtime | `plan.md` §3.1, architecture/* |
| A | Identity & access | `plan.md` §2A |
| B | Workspaces & products | §2B |
| C | Agents — configuration | §2C |
| D | Agent execution | §2D |
| E | Agent communication, coordination & transfer | §2E |
| F | Discover (S1) | §2F |
| G | Define (S2) | §2G |
| H | Plan (S3) | §2H |
| I | Build — autonomous (S4) | §2I |
| J | Test — autonomous (S5) | §2J |
| K | Ship (S6) | §2K |
| L | Launch / GTM / price (S7) | §2L |
| M | Operate / support (S8) | §2M |
| N | Learn (S9) | §2N |
| O | Product Memory (X4) | §2O |
| P | Trust & observability (X3) | §2P |
| Q | Interop — MCP / A2A (X5) | §2Q |
| R | Platform & ops | §2R |
| S | Security & compliance (NFR) | considerations: CISO/Security |
| T | Reliability / SRE (NFR) | considerations: SRE |
| U | Data & privacy (NFR) | considerations: Data/Privacy |
| V | Finance & monetization (NFR) | considerations: Finance |
| W | Growth / GTM platform (NFR) | considerations: Growth |
| X | Legal & compliance (NFR) | considerations: Legal |

---

## EPIC 0 — Foundation, tenancy & runtime `FND`
*The base every later stage is an addition to, not a rewrite of. Build order step 1.*

**0.1 — Three-key tenancy + RLS** `[extend]` · `P0` · `FND`
- What: enforce `user_id` + `workspace_id` + `product_id` scoping on every table and RLS policy.
- Build: add `product_id` to all product-scoped tables; RLS policies for select/insert/update/delete keyed on all three; tenancy helper in server fns; deny-by-default policies; tenancy assertion in the chokepoint and orchestrator.
- States: missing-context request rejected (no silent cross-tenant read); workspace-with-no-product; product archived.
- Done when: an integration test proves a row created under (W1,P1) is invisible to (W1,P2) and (W2,*) at the DB layer.
- Depends: A2 (session), B2 (product entity).

**0.2 — AI chokepoint pipeline** `[reuse]` · `P0` · `FND`
- What: the single path every model call takes (`src/lib/ai/runtime.server.ts`).
- Build: ordered stages — `budget → cache → pre-guard → retrieve(RAG) → PROVIDER → post-guard → persist(trace) → async eval → fallback`; one `ai_events` row + trace span per call; cache key salted by tenant (no cross-user poisoning); cache hit logs cost `$0.0000` explicitly.
- States: budget exceeded → throw before provider; cache hit → short-circuit but still log; guardrail block → abort + log; provider error → fallback chain.
- Done when: a call produces exactly one event + trace; budget throw fires before any provider spend; guardrail block aborts and is logged.
- Depends: 0.1, P1, P2.

**0.3 — Trust-stack tables** `[reuse]` · `P0` · `FND`
- What: the telemetry/governance schema the chokepoint writes to.
- Build: `ai_events`, `ai_traces`, `ai_evals`, `ai_feedback`, prompt-version tables, guardrail-rule tables, budget tables — all 3-key scoped, all with `parent_event_id` for trace nesting.
- Done when: schema migrations applied; chokepoint writes resolve; trace nesting renders in the viewer (P4).
- Depends: 0.1.

**0.4 — Design tokens & system** `[reuse]` · `P0` · `FND`
- What: OKLCH token system in `src/styles.css`; components consume tokens only.
- Build: semantic colors, gradients, shadows, `--surface-*` palette, type ramp, motion tokens, radii; `prefers-reduced-motion` hook; dark-first theme; lint/review guard against hex literals.
- Done when: a token edit changes the surface globally; a11y spot-check passes 4.5:1; no hex literals in components.
- Depends: —. See [`../design.md`](../design.md).

**0.5 — Agent blast-radius limits** `[new]` · `P0` · `FND/NFR`
- What: hard scope limits on what any agent run may touch.
- Build: per-agent tool allow-list enforced at the chokepoint/orchestrator; resource scope (which products/tables/external systems); deny external side-effects without an approval gate; record attempted-out-of-scope actions.
- States: out-of-scope tool call → blocked + logged + surfaced in trace; escalates to Decision Queue if `confirm`.
- Done when: an agent cannot call a tool outside its allow-list, proven by test.
- Depends: 0.2, C2, D2.

**0.6 — Per-mission spend caps + global kill-switch** `[new]` · `P0` · `FND/NFR`
- What: cost ceilings per mission/agent and a one-action pause/stop for everything.
- Build: per-mission and per-workspace cost budgets; soft-warn → hard-stop thresholds; global kill-switch that pauses all running sessions and blocks new ones; per-agent run cap.
- States: cap reached mid-mission → checkpoint + pause (not data loss); kill-switch active → new runs refused with a clear message.
- Done when: a runaway mission halts at its cap with a resumable checkpoint; kill-switch drains running work safely.
- Depends: 0.6 needs P6 (budgets), E? (orchestration checkpoints).
- **How to use / verify (2026-06-03):**
  - **Where:** sidebar → AI Ops → **Governance** (`/_authenticated/governance`). Visible to any authenticated workspace member; system-pause toggle is admin-gated.
  - **Panels:**
    1. **Kill Switch** — workspace pause (owner/admin) with required reason; system pause is read-only for non-admins. When paused, `AppShell` shows a red banner on every route.
    2. **Mission Caps** — per-mission `mission_token_cap` + `mission_spend_cap_usd` with live usage bars (`tokens_used` / `spend_used_usd` from `agent_runs`). Auto-halts the run on exceedance.
    3. **Approvals** — pending `agent_approvals` with TTL countdown (default 24h), `escalation_state`, and Approve / Reject / Extend actions.
  - **Server enforcement:** `callModel()` and `callModelStream()` in `src/lib/ai/runtime.server.ts` call `current_kill_state()` + `check_mission_caps()` before spend and throw `GovernanceHaltError`; the agent loop catches it, calls `halt_agent_run()`, and finalizes the run with `status='halted'`. Blocked attempts log `ai_events.status='blocked'` with `error_message='governance_halt:<kind>'`.
  - **Cron:** `pg_cron` hits `/api/public/hooks/approvals-tick` every minute → expires approvals past `expires_at` and flips `escalation_state`.
  - **Verification checklist:** (a) toggle workspace pause → start any mission → call is rejected with a `governance_halt:kill_switch` event; (b) set a tiny `mission_spend_cap_usd` on a run → next step halts with `governance_halt:mission_spend_cap` and the run row shows `status='halted'`; (c) leave an approval past its `expires_at` → within ~1 min it shows expired in the Approvals panel.

**0.7 — Prompt-injection defense** `[new]` · `P0` · `FND/NFR`
- What: treat all ingested/external content (signals, tickets, MCP/A2A results, web) as untrusted.
- Build: input sanitization + delimiting; instruction-isolation prompt pattern; injection classifier on ingested text; external tool-result quarantine before it can drive an action; high-risk actions require approval regardless of agent mode.
- States: detected injection → flag + strip + log; unverified external instruction never auto-executes a side-effect.
- Done when: a seeded poisoned signal cannot trigger an autonomous external action without approval.
- Depends: 0.2, F1, Q2.

**0.8 — Provider/model fallback & graceful degradation** `[new]` · `P0` · `FND/NFR`
- What: the product keeps working when a model/gateway is down or deprecated.
- Build: ordered fallback routing per surface; health checks; circuit-breaker per provider; degraded-mode UX (queue/retry, not hard-fail); model-deprecation playbook + config.
- States: primary provider 5xx/timeout → next in chain; all down → queue + friendly degraded state.
- Done when: killing the primary provider in a test still returns answers via fallback.
- Depends: 0.2, 5a (model gateway + BYO).

**0.9 — Durable runtime for long/parallel missions** `[new]` · `P0` · `FND/NFR`
- What: missions survive Cloudflare Workers execution limits.
- Build: durable job/queue model; checkpointing + resume; backpressure; idempotent ticks; long-op state in DB not memory.
- States: worker eviction mid-step → resume from last checkpoint; duplicate tick → no double effect.
- Done when: a multi-step mission survives a forced worker restart and completes.
- Depends: 0.2, E5/E6 (parallel sessions), architecture/orchestration.md.

**0.10 — Sandboxed execution + review gate for agent code** `[new]` · `P0` · `FND/NFR`
- What: agent-written code runs isolated and is reviewed before merge/deploy.
- Build: sandboxed exec environment; no ambient secrets in sandbox; mandatory human/policy review gate before merge; supply-chain allow-list for agent-installed deps.
- Done when: agent code executes without access to prod secrets; no merge without passing the review gate.
- Depends: I1 (Studio), K1 (PR/deploy), S1.

**0.11 — App monitoring, backups & DR** `[new]` · `P0/P1` · `FND/NFR`
- What: platform-level (not just AI) observability + recoverability.
- Build: uptime/error/latency monitoring + alerting; DB backups + point-in-time restore; restore drill; basic status signal.
- Done when: an induced app error alerts; a restore drill recovers to a point in time.
- Depends: 0.3 (telemetry base), T1/T5.

**0.12 — CI/CD + environments** `[new]` · `P0` · `FND/NFR`
- What: dev/staging/prod pipelines so autonomous shipping is safe.
- Build: environment separation; build/test/lint gates in CI; migration apply step; deploy + rollback path (Cloudflare Workers + Supabase).
- Done when: a PR runs gates green and deploys to staging; rollback restores the prior release.
- Depends: 0.12 underpins K (Ship).

---

## EPIC A — Identity & access `X6`

**A1 — Sign up / onboarding** `[reuse]` · `P0` · `X6`
- What: account creation + first-run setup.
- Build: email+password + Google OAuth; create first workspace + product; capture display name, timezone, working hours; email verification on by default; sample/template seed (ties W1 onboarding).
- States: duplicate email; unverified email; OAuth cancel; partial onboarding resume.
- Done when: a new user lands in a seeded, usable workspace with a product.
- Depends: 0.1.

**A2 — Login / logout / session** `[reuse]` · `P0` · `X6`
- Build: authenticated session; sign-out-everywhere; session refresh; `Last-Event-ID` resume for SSE streams; global auth middleware on all `_authenticated.*` routes.
- States: expired token; refresh failure; stream resume after reconnect.
- Done when: streams resume after a reconnect; sign-out invalidates all sessions.
- Depends: 0.1.

**A3 — Password reset / email verification** `[reuse]` · `P0` · `X6`
- Build: reset request → email → set-new; verification link; rate-limited.
- States: expired/used token; unknown email (no enumeration leak).

**A4 — Profile & preferences** `[reuse]` · `P0` · `X6`
- Build: display name, role, timezone, working hours, default model per surface.
- Done when: greeting, scheduling windows, and model routing all read these values.
- Depends: A1.

**A5 — BYO model keys** `[reuse]` · `P0` · `X6`
- Build: add/test/rotate/delete provider keys; encrypted (pgsodium); masked display; per-provider validation ping.
- States: invalid key; rotation while a mission is mid-run; revoked key fallback to gateway.
- Done when: a BYO key is used for the chosen surface and never rendered in plaintext.
- Depends: 0.8, S4.

**A6 — Roles & membership (future)** `[new]` · `P1` · `X6`
- Build: invite flow; per-workspace roles (owner/admin/member/viewer); SSO/SAML readiness; RBAC enforcement at RLS + UI.
- Depends: 0.1, B1. (See S6.)

---

## EPIC B — Workspaces & products `X2`

**B1 — Create / switch workspace** `[extend]` · `P0` · `X2`
- Build: workspace as top-level tenancy boundary; create/rename/switch; membership stub.
- States: last-workspace delete guard; switch persists per session.

**B2 — Create product under workspace** `[extend]` · `P0` · `X2`
- Build: product entity with vision/problem/target-users/metrics/stage; create/edit; `product_id` scoping everywhere.
- Done when: a second product under the same workspace is fully isolated (see 0.1).

**B3 — Product switcher + portfolio view** `[new]` · `P1` · `X2`
- Build: fast product switcher (⌘K + header); cross-product portfolio overview (health, activity, budgets per product).
- States: zero products; many products (search/scroll).

**B4 — Per-product isolation** `[extend]` · `P0` · `X2`
- Build: data, agents, memory, budgets, access all scoped by the three keys.
- Done when: covered by the 0.1 isolation test extended to agents/memory/budgets.

**B5 — Archive / delete product** `[new]` · `P1` · `X2`
- Build: archive (soft, reversible) + delete (hard, with export prompt); cascade rules; audit entry.
- States: delete with running missions → block or drain; archived product hidden from switcher but queryable.
- Depends: U2 (export), U1 (retention/deletion).

---

## EPIC C — Agents (configuration) `X1`

**C1 — Agent roster** `[extend]` · `P0` · `X1`
- Build: list durable lifecycle agents + spawned sub-agents per product; status dots; last-run summary.
- Done when: the roster shows the ~10 durable agents (`plan.md` §6) + live sub-agents.

**C2 — Create / clone / configure agent** `[reuse]` · `P0` · `X1`
- Build: schema `slug, name, system_prompt, tool_allowlist[], default_model, temperature/top_p/seed, max_tokens, schedule_cron?, approval_mode(auto|confirm|review), memory_enabled`; clone from template; validation.
- States: invalid prompt/model; tool not permitted; duplicate slug.
- Done when: a configured agent runs through the chokepoint honoring its allow-list + approval mode.
- Depends: 0.5.

**C3 — Enable / disable / schedule agent** `[reuse]` · `P0` · `X1`
- Build: cron schedule with next-run preview; enable/disable; advisory-lock to prevent duplicate fan-out (legacy bug fixed).
- States: disabled mid-schedule; overlapping runs deduped.

**C4 — Agent detail + run history + memory inspector** `[reuse]` · `P1` · `X1`
- Build: last runs (status/duration/score/cost); memory inspector (shared vs private); per-agent eval coverage.
- Depends: P1, O1.

---

## EPIC D — Agent execution `X1`

**D1 — Run on-demand / scheduled** `[reuse]` · `P0` · `X1`
- Build: manual trigger + cron fan-out via `/api/public/hooks/*`; idempotent ticks.
- Depends: 0.9, C3.

**D2 — Planner/executor loop** `[reuse]` · `P0` · `X1`
- Build: plan → tool calls → observe → reflect → answer; max-step + max-cost caps; loop/runaway detection.
- States: step cap hit → stop + escalate; runaway detected → halt.
- Done when: a capped loop terminates and records partial trace.
- Depends: 0.2, 0.6.

**D3 — Approval gates + Decision Queue** `[reuse]` · `P0` · `X1`
- Build: `auto|confirm|review` per run; queue of `awaiting_review` runs with summary + proposed action; approve/reject; one-click resume from checkpoint.
- States: approve → resume; reject → record + stop; timeout policy.
- Done when: a `confirm` action pauses, appears in the queue, and resumes on approve. See `design.md` DecisionQueue card.
- Depends: D2, P (trace).

**D4 — Cancellation / replay-and-branch / checkpoints** `[reuse]` · `P1` · `X1`
- Build: stop mid-run saving partial; checkpoint persistence; re-run against a different model/prompt; show the diff (ties AI-message "Replay with…").
- Depends: D2, 0.9.

---

## EPIC E — Agent communication, coordination & transfer `X1` *(the autonomous spine — do not defer)*

**E1 — Sub-agent spawning** `[new]` · `P1` · `X1`
- Build: Orchestrator spawns ephemeral specialists per task; spawned agents inherit chokepoint + allow-list + governance; lifecycle (spawn→work→retire).
- Done when: the Orchestrator spawns a specialist that runs governed and retires cleanly.
- Depends: D2, 0.5.

**E2 — Agent-to-agent (internal) messaging** `[new]` · `P1` · `X1`
- Build: structured internal A2A messages between agents in a mission; message log; ordering.
- States: recipient busy/dead; message loop guard.

**E3 — Agent transfer / handoff** `[new]` · `P1` · `X1`
- Build: pass a mission + its context, memory, and artifacts across stages (Planner → Engineer → QA → Release) with zero context loss; handoff record.
- Done when: a mission moves Planner→Engineer→QA and each stage sees full prior context.
- Depends: E2, O (memory), 0.9.

**E4 — Parallel sub-agents** `[new]` · `P1` · `X1`
- Build: many specialists on one mission concurrently; shared mission context; conflict/merge handling.
- Depends: E1, 0.9.

**E5 — Parallel agent sessions** `[new]` · `P1` · `X1`
- Build: many missions running at once across products; isolation per session; fair scheduling + backpressure.
- Done when: N missions across 2 products run concurrently without cross-bleed.
- Depends: 0.9, B4.

**E6 — Orchestration / mission graph view** `[new]` · `P1` · `X1`
- Build: live DAG of agents/sessions; per-node status, cost, approval state; pause/steer/approve from the graph.
- States: huge graph (zoom/collapse); node failed; node awaiting approval.
- Done when: the graph reflects live mission state and supports pause/steer. See `design.md`.
- Depends: E1–E5, P.

**E7 — Shared vs. private memory** `[extend]` · `P1` · `X1`
- Build: mission-shared context + per-agent long-term memory with importance decay; access rules (no leakage across missions/products).
- Depends: O1, 0.1.

---

## EPIC F — Discover `S1` *(first end-to-end slice)*

**F1 — Signal ingest** `[extend]` · `P0` · `S1`
- Build: paste + CSV now (chunked inserts, params cap fixed); sentiment on insert; source typing (support/churn/usage/sales/reviews/NPS/interviews); injection-screened on ingest (0.7); connectors next (R2).
- States: huge CSV (chunking); malformed rows; duplicate signals.
- Done when: pasted + CSV signals land scoped, sentiment-tagged, injection-screened.
- Depends: 0.1, 0.7.

**F2 — Clustering → themes → opportunities** `[reuse]` · `P0` · `S1`
- Build: embed + cluster (k-medoid) + synthesize with `evidence_ids[]`; ICE scoring; dedupe by similarity; known limit: degrades past ~1000 signals/run (chunk runs).
- States: too-few signals; noisy cluster; re-run idempotency.
- Done when: signals produce themes → ICE-scored opportunities each citing evidence ids.
- Depends: F1, P (chokepoint), 0.3.

**F3 — Continuous discovery feed** `[extend]` · `P0` · `S1`
- Build: always-fresh per-product feed; incremental synthesis (not one-shot); new-signal → re-cluster delta; feed UI with filters.
- States: empty feed; high-velocity inflow; stale-fact flag (O).
- Done when: new signals update the feed without a full recompute. *This is the lead use case.*
- Depends: F2.

---

## EPIC G — Define `S2`

**G1 — PRD/spec generation** `[reuse]` · `P0` · `S2`
- Build: opportunity → structured cited draft (acceptance criteria, non-goals, risks, success metrics auto-drafted); retrieval-grounded with citation ids.
- States: low-evidence opportunity (warn); regeneration vs. edit conflict.
- Done when: an opportunity yields a cited PRD a human can edit + approve.
- Depends: F2, O (RAG), P.

**G2 — Doc editor + `/ai` + versions/diff** `[reuse]` · `P0` · `S2`
- Build: Tiptap editor; inline `/ai` slash menu; 1.5s autosave to `prd_versions`; version diff; citation pills; side-anchored comments.
- States: autosave conflict; offline edit; long doc.
- Done when: edits autosave + version; `/ai` edits inline with citations; diff renders. See `design.md` DocEditor.
- Depends: G1.

---

## EPIC H — Plan `S3`

**H1 — Task graph** `[reuse]` · `P0` · `S3`
- Build: spec → dependency-aware tasks with estimates/owners/risk flags; cycle detection; acceptance criteria per task (eng-lead need).
- States: cyclic dependency; orphan task; unestimated task.
- Done when: a PRD generates a valid dependency-ordered task graph agents can execute.
- Depends: G1.

**H2 — Outcome roadmap (Now/Next/Later)** `[extend]` · `P1` · `S3`
- Build: `@dnd-kit` board; each item declares the outcome it pursues + how it's measured; drag reorder; link to tasks/opportunities.
- States: empty lane; large board; drag on touch.
- Done when: every roadmap item ties to a measurable outcome (anti-feature-factory).
- Depends: H1.

**H3 — Scheduling** `[reuse]` · `P1` · `S3`
- Build: agent proposes work blocks within profile working hours; calendar-aware (R2 Calendar).
- Depends: A4, H1.

---

## EPIC I — Build (autonomous) `S4` *(the differentiator)*

**I1 — Studio multi-file coding** `[extend]` · `P1` · `S4`
- Build: three-pane Studio; virtual `studio_files`; JSON edit-plan multi-file edits; per-hunk accept/reject; atomic `studio_revisions`; known limit: truncates files >2k lines (chunk).
- States: large file; conflicting hunks; failed apply rollback.
- Done when: an agent edits across files with per-hunk review and atomic commit.
- Depends: 0.10 (sandbox), D2.

**I2 — Watch-the-agents-build surface** `[new]` · `P1` · `S4`
- Build: live per-session view — current step, files touched, tool calls, cost, status; pause/steer/approve mid-run; streaming.
- States: many concurrent sessions; paused; errored step.
- Done when: a building agent's steps/files/cost stream live and can be paused. See README capability surface + `design.md`.
- Depends: E6, I1, P.

**I3 — Branch/worktree isolation per mission** `[new]` · `P1` · `S4`
- Build: each mission on its own branch/worktree; isolation; merge path to Ship.
- States: branch conflict; abandoned branch cleanup.
- Depends: 0.12, K1.

---

## EPIC J — Test (autonomous) `S5`

**J1 — Test generation + run** `[new]` · `P1` · `S5`
- Build: agents author + run unit/integration/E2E + evals; runner wiring (note: no test runner configured yet — see CLAUDE.md); results persisted.
- States: flaky test; timeout; environment missing.
- Done when: the QA agent generates and runs tests producing a pass/fail gate signal.
- Depends: I1, 0.12.

**J2 — QA gate + self-correct loop** `[new]` · `P1` · `S5`
- Build: failing tests feed back to the build agent until green or escalate; regression gate (≥0.1 eval regression blocks without override); ties "Cadence core" eval suite (P5).
- States: infinite-correct guard (cap); unrecoverable → escalate to Decision Queue.
- Done when: a failing suite loops the Engineer until green or escalates; a regression blocks Ship.
- Depends: J1, P5, D3.

---

## EPIC K — Ship `S6`

**K1 — PR / deploy / release notes** `[new]` · `P1` · `S6`
- Build: open PRs; run deploy checklist; deploy; draft release notes — all behind approval gates; respect branch protection + CI gates.
- States: CI red → block; deploy failure → rollback; approval rejected.
- Done when: an approved mission opens a PR, passes gates, deploys, and drafts notes.
- Depends: 0.12, I3, D3, 0.10.

**K2 — Rollback triggers** `[new]` · `P1` · `S6`
- Build: documented rollback per release; automated revert path; feature-flag kill (W?).
- Done when: a release can be reverted from the UI within one action.
- Depends: K1, 0.12.

---

## EPIC L — Launch / GTM / price `S7`

**L1 — Launch + positioning + pricing + distribution drafts** `[new]` · `P2` · `S7`
- Build: agent-drafted launch assets, positioning, pricing pages, distribution plans; human-approved before anything external.
- States: nothing external sends without approval (governance gate).
- Done when: an agent produces a launch package that requires approval to publish.
- Depends: G/H/N (context), D3, Q (publish targets).

**L2 — Customer-facing pages / announcements** `[new]` · `P2` · `S7`
- Build: generate public pages (`p.$slug`) + announcement copy; preview; approval to publish.
- Depends: L1.

---

## EPIC M — Operate / support `S8`

**M1 — Ticket triage + draft answers + route/escalate** `[new]` · `P2` · `S8`
- Build: agents triage inbound tickets, draft answers, route, escalate; support themes flow back into Discover (closes the loop into F1).
- States: low-confidence → escalate; PII handling (U5).
- Done when: a ticket is triaged + draft-answered and its theme appears as a new signal.
- Depends: F1, 0.7, Q.

---

## EPIC N — Learn `S9`

**N1 — Decisions + `supersedes`** `[reuse]` · `P0` · `S9`
- Build: outcomes write `decisions` with `supersedes` lineage; decision timeline (Mission Control widget).
- Done when: a decision supersedes a prior one and the lineage renders as soft arrows.
- Depends: 0.3, O1.

**N2 — Re-score + insight memo + daily brief** `[extend]` · `P1` · `S9`
- Build: outcomes re-rank opportunities; insight memo; daily brief surfaced in Today's Focus.
- States: no outcomes yet (empty brief copy); conflicting outcomes.
- Done when: an outcome re-scores its opportunity and the brief reflects it.
- Depends: F2, N1.

---

## EPIC O — Product Memory `X4`

**O1 — Knowledge graph + query** `[new]` · `P1` · `X4`
- Build: typed nodes/edges — signals → themes → opportunities → decisions → experiments → outcomes — with `supersedes`; queryable; "why is this on the roadmap?" answerable with cited evidence.
- Done when: a roadmap item resolves to its evidence chain via one query.
- Depends: F2, G1, H1, N1.

**O2 — RAG retrieval (citations)** `[reuse]` · `P0` · `X4`
- Build: pgvector hybrid retrieval (512/64 chunks, 1536-d); citation ids returned; salted cache; chunker boundary handling.
- Done when: retrieved chunks produce `[1][2]` citations in the AI-message contract.
- Depends: 0.2, 5b (pgvector).

**O3 — Currency / drift on facts + skill packs** `[new]` · `P2` · `X4`
- Build: flag stale facts; export versioned skill bundles over MCP.
- Depends: O1, Q1.

---

## EPIC P — Trust & observability `X3`

**P1 — Telemetry + traces + judge scores** `[reuse]` · `P0` · `X3`
- Build: per-call `ai_events`; trace waterfall (`/traces/$traceId`, one row per span, depth from `parent_event_id`, surface color-coding); LLM-as-judge composite (groundedness/relevance/coherence/hallucination); recursion blow-up fixed.
- Done when: every AI call is inspectable end-to-end in the trace viewer with a judge score.
- Depends: 0.2, 0.3.

**P2 — Guardrails (input + output)** `[reuse]` · `P0` · `X3`
- Build: rule kinds for pre- and post-guard; block aborts + logs; per-rule unit tests; injection rules tie 0.7.
- Done when: a blocking rule aborts a call and is visible in the trace.

**P3 — Prompt studio (versioning + A/B)** `[reuse]` · `P1` · `X3`
- Build: versioned prompts; A/B assignment; pin per agent/surface; rollback.
- Depends: 0.3.

**P4 — Eval harness + regression gate** `[reuse]` · `P1` · `X3`
- Build: "Cadence core" eval suite; per-surface/agent coverage targets; ≥0.1 regression blocks deploy without override.
- Done when: a regression blocks Ship (ties J2/K1).

**P5 — Drift watch** `[reuse]` · `P1` · `X3`
- Build: monitor score/cost/latency drift per surface/model; alert on threshold.

**P6 — Budgets** `[reuse]` · `P0` · `X3`
- Build: daily/monthly caps per workspace/product/mission; BudgetBar (today vs cap, month vs cap; muted→accent→destructive; per-surface popover); breach is friendly (not a crash).
- Done when: a breach degrades gracefully and the BudgetBar reflects burn. See `design.md` BudgetBar.
- Depends: 0.6, V1.

**P7 — Incidents log** `[reuse]` · `P1` · `X3`
- Build: record safety/guardrail/cost incidents; link to traces; resolution notes.

**P8 — AI message UI contract** `[reuse]` · `P0` · `X3`
- Build: one shared component rendering score/model+via/latency/tokens/cost/citations/feedback/view-trace/replay on every AI message; cache hit shows `$0.0000`; no citations box when `retrieval=false`.
- Done when: every AI surface (chat, copilot, PRD `/ai`, Studio, agent summaries, brief) uses the one contract component. Non-negotiable per `design.md` + `AGENTS.md` rule 9.
- Depends: P1, O2.

---

## EPIC Q — Interop (agent-native) `X5`

**Q1 — MCP server + client** `[new]` · `P2` · `X5`
- Build: expose Cadence capabilities as MCP tools (server); consume external MCP tools (client); capability scopes; rate limits; audit.
- States: untrusted tool result → quarantine (0.7); scope-exceeded call blocked.
- Done when: an external agent calls a scoped Cadence tool and the call is audited.
- Depends: 0.7, S5.

**Q2 — A2A server/client + Agent Cards + scopes/limits/audit** `[new]` · `P2` · `X5`
- Build: Agent Cards; delegate-to-agent; peer registry; per-peer scopes + rate limits; prompt-injection guard on external results; audit log.
- Depends: Q1, 0.7.

---

## EPIC R — Platform & ops

**R1 — Command palette (⌘K) + global search** `[reuse]` · `P0` · `X6`
- Build: `cmdk`-based; resolves every destination/create-action/recent-artifact; keyboard-first.
- Done when: ⌘K reaches every route + create action + recent artifact. See `design.md`.

**R2 — Connectors / integrations** `[extend]` · `P1` · `X5`
- Build: Google Docs/Notion two-way sync, Linear pull/push + Sync Inbox, Google Calendar read+write, GitHub, Slack, CRM; integration health surface; OAuth + token storage (encrypted); reuse Nango engine (`nango/`); known limits: Docs sync drops comments, Notion BFS reorder fixed.
- States: token expired; sync conflict; partial sync; rate limit.
- Done when: at least Docs/Notion/Linear/Calendar round-trip with health visible. See `integrations` epic in `plan.md` §5.
- Depends: A5/secrets, nango.

**R3 — Notifications** `[extend]` · `P1` · `X6`
- Build: approvals, budget breaches, guardrail hits, integration health, digests; in-app + transactional email; preferences.
- Depends: D3, P6, W?(email).

**R4 — Settings** `[extend]` · `P1` · `X6`
- Build: profile, keys, budgets config, guardrail rules, integration health, notification prefs, workspace/product admin.
- Depends: A4, A5, P2, P6.

---

## EPIC S — Security & compliance `NFR`
**S1 — Sandboxed execution for agent code** `P0` → see **0.10**.
**S2 — Supply-chain security (agent-installed deps)** `[new]` · `P0`: allow-list + scanning before install; ties bunfig `minimumReleaseAge`.
**S3 — Secret scanning + SAST in build pipeline** `[new]` · `P1`: scan agent code for secrets/vulns pre-merge.
**S4 — Key rotation + compromise response** `[new]` · `P1`: rotate BYO/gateway/DB creds; revoke + re-issue runbook. Depends A5.
**S5 — Pen-test + threat model for MCP/A2A** `[new]` · `P1`: threat model the external-agent surface. Depends Q.
**S6 — RBAC / roles / team membership** `[new]` · `P1`: enforce at RLS + UI. Depends A6.

## EPIC T — Reliability / SRE `NFR`
**T1 — App monitoring + alerting** `P0` → see **0.11**.
**T2 — SLOs/SLAs + error budgets + status page** `[new]` · `P1`.
**T3 — Long-running job durability / queue + backpressure** `P0` → see **0.9**.
**T4 — Graceful degradation on provider/model down** `P0` → see **0.8**.
**T5 — Incident response runbooks + on-call** `[new]` · `P1`. Depends P7.
**T6 — DR: backups, PITR, restore drills** `P0/P1` → see **0.11**.

## EPIC U — Data & privacy `NFR`
**U1 — Data retention + deletion (GDPR/CCPA)** `[new]` · `P1`: `ai_events` currently unbounded → retention + right-to-be-forgotten.
**U2 — Data export / portability** `[new]` · `P1`: per-workspace/product export (anti-lock-in). Depends B5.
**U3 — Sub-processor list + DPA** `[new]` · `P1`: disclose model-vendor data flows; contracts.
**U4 — Data residency / region options** `[new]` · `P2`.
**U5 — PII classification + minimization before model calls** `[new]` · `P1`: strip/mask PII pre-provider; pairs with guardrails P2.

## EPIC V — Finance & monetization `NFR`
**V1 — Usage metering + plan-limit enforcement** `[new]` · `P0/P1`: meter tokens/missions; enforce caps. Depends P6.
**V2 — Cost-to-serve vs. price model** `[new]` · `P0`: per-mission cost attribution feeding margin analysis.
**V3 — Payments, trials, dunning, invoicing** `[new]` · `P1`.
**V4 — Per-customer cost attribution** `[new]` · `P1`. Depends V1.

## EPIC W — Growth / GTM platform `NFR`
**W1 — Onboarding + activation + samples/templates** `[new]` · `P0`: time-to-value; seeded sample product. Depends A1.
**W2 — Product usage analytics (separate from AI telemetry)** `[new]` · `P1`: activation/retention/funnels.
**W3 — Marketing site, pricing page, waitlist, SEO** `[new]` · `P1`.
**W4 — In-app support, help center, changelog, docs** `[new]` · `P1`.
**W5 — Mobile/PWA for approvals triage** `[new]` · `P2`: approvals can't block on desktop. Depends D3.

## EPIC X — Legal & compliance `NFR`
**X1 — ToS, privacy policy, AUP, DPA** `[new]` · `P1` (required to sell).
**X2 — IP ownership of agent-generated code/content** `[new]` · `P1`.
**X3 — Liability for autonomous actions** `[new]` · `P1` (governance gates are part of the answer).
**X4 — OSS license compliance of agent-installed deps** `[new]` · `P1`. Ties S2, AGENTS.md §9.
**X5 — SOC 2 / ISO 27001 / ISO 42001 path** `[new]` · `P2` (substrate in security.md).

---

## New features — v2 Positioning Session (2026-06-02)

*Derived from strategic repositioning to "autonomous product OS." Full reasoning: [`strategy/product-positioning-v2.md`](./strategy/product-positioning-v2.md).*

**C5 — Strategic Briefing surface** `[status: ☑ shipped 2026-06-04]` · `P0` · `X1`
- What: one place where the operator defines mission, target user, current focus, anti-goals and notes once; every agent reads it as their operating context before each mission.
- Built: `workspace_briefs` table (one per workspace; mission / target_user / current_focus / anti_goals / notes; member-read, owner-write RLS). Editor at `/_authenticated/briefing` (5 textareas with hint copy + char counts + Save). `renderBriefBlock()` helper emits a labelled fenced text block (skipped when every field is empty). Agent loop injects the rendered block **between the agent's persona prompt and memory recall** in `src/lib/ai/loop.server.ts` so Discovery / Strategist / Builder all see the operator's shared context first. Migration also added `prds.github_issue_url` + a `prd.link_issue` tool to close PRD↔issue link-back.
- Done when: ✅ a mission's system prompt visibly contains the brief; editing the brief changes the next mission's plan.
- Depends: C2, G2 (editor), O2 (RAG context).

#### How to use / verify
- **Where to find it.** Sidebar → **Briefing** (Crosshair icon, pinned right after Today). Route: `/briefing`.
- **What each control does.** Five textareas — **Mission** (what this workspace exists to do), **Target user (ICP)** (who you're building for), **Current focus** (this quarter's priorities), **Anti-goals** (what to refuse to spend effort on), **Notes** (tone / constraints / decisions). Top-right **Save brief** button (disabled until dirty).
- **Server enforcement.** Read via `getActiveBrief` server fn (workspace-member RLS). Write via `upsertBrief` (workspace-owner only — RLS rejects everyone else). Brief content is injected into the agent loop's system prompt *before* the tools list and quarantined tool-output rules, so it can't be overridden by tool output.
- **Verification checklist:** (1) Open `/briefing`, type a Current focus + Anti-goal, hit Save (toast confirms). (2) Run a mission from `/agents` (Discovery Scout / PRD Writer / Strategist). (3) Open the trace at `/traces/{trace_id}` and inspect the first model call's system prompt — the **Workspace Strategic Brief** block must appear between the persona prompt and the tools list. (4) Edit the brief, re-run the mission, confirm the Strategist's draft now reflects the new focus and refuses the anti-goal.

**C6 — Agent Trust Score + Autonomy Dial** `[status: ☑ shipped 2026-06-04]` · `P0` · `X1`
- What: each agent shows a visible trust score (0–100) computed from mission outcomes, approval acceptance, and eval scores; the operator places the agent on the trust arc (Observing → Proving → Trusted → Ambient) via an inline dial, and that arc composes with each tool's own approval mode in the agent loop.
- Built: `agent_autonomy` table (one row per user+agent, owner-only RLS). Trust score computed on read (`src/lib/ai/trust.server.ts → computeAllAgentTrust`) with Bayesian shrinkage so a 1-run agent doesn't show 100%. `resolveApprovalMode(toolMode, arc)` is the single combiner: Observing forces `review`, Proving forces `confirm`, Trusted lets `confirm` tools run inline, Ambient lets everything except hard-locked tools run inline. Safety floor preserved: `review` is sticky, and `calendar.create` keeps `confirm` even at Ambient. Server fns `getAllAgentTrust` + `setAgentArc` in `src/lib/trust.functions.ts`. UI: Trust chip (color-tiered, hover tooltip with full breakdown + formula) on each agent button and detail header; AutonomyDial (4 arc buttons + suggested-arc hint) inside the agent detail card.
- Out of scope (later): trust history chart, auto-promotion on sustained score, E8 Loop Health Monitor.
- Done when: ✅ dialing Discovery Scout from Observing → Trusted causes the next mission's `confirm`-mode tool to execute inline instead of queueing in the Decision Queue, and the trace shows `status:"executed"`.
- Depends: C2, D3, P1.

#### How to use / verify
- **Where to find it.** Route `/agents`. Trust chip appears on each agent in the left roster and at the top of the right-hand detail card. The Autonomy Dial sits inside the detail card, just under the agent persona.
- **What each control does.** **Trust chip** (e.g. `Trust 72`) — hover for the full breakdown: missions completed/total, approvals accepted/total, evals avg, sample size, formula (`0.4·success + 0.3·approval + 0.3·eval`, shrunk toward 0.5 when n<10), suggested arc. **Autonomy Dial** — 4 buttons (Observing · Proving · Trusted · Ambient); clicking one writes `agent_autonomy` for that user+agent. The suggested arc is shown when it differs from the current arc — the operator can follow or ignore it.
- **Server enforcement.** `setAgentArc` server fn writes via `requireSupabaseAuth`; RLS on `agent_autonomy` restricts everyone to their own rows. The agent loop (`src/lib/ai/loop.server.ts`) calls `loadAgentArc` once per run and `resolveApprovalMode(toolMode, arc)` at every tool-call gate. `review` mode is sticky (never downgraded). `calendar.create` is hard-locked: even at Ambient it forces `confirm`.
- **Verification checklist:** (1) Open `/agents` — every agent card shows a Trust chip; first-time users see `Trust 50` (prior, no history). (2) Dispatch a goal on **Discovery Scout** with the dial at **Observing** → the action is queued for review (visible at `/decisions` or `/traces` with `status:"queued"`). (3) Flip the dial to **Trusted** → re-dispatch a similar goal → a `confirm`-mode tool now executes inline (trace step `status:"executed"`, no new approval row). (4) Flip back to **Observing** → the approval queue resumes on the next run. (5) At **Ambient**, confirm `calendar.create` still hard-forces `confirm` (safety floor).

**E8 — Loop Health Monitor** `[new]` · `P1` · `X1`
- What: single view showing whether the autonomous product loop is running, where it's stuck, and what needs human attention — the "is my product org operating?" dashboard.
- Build: per-product loop status (active missions, stalled missions, approval queue depth, last signal ingest, last deploy); health score composite; alert when loop stalls >N hours; one-click resume from each stall point.
- States: healthy (all stages active); degraded (one stage stalled); stalled (multiple stages blocked or no activity).
- Done when: stall in the Discover stage appears in the monitor within 1 hour with the reason and unblock action.
- Depends: E6 (orchestration graph), D3, F3.

**N3 — Mission Compounding View** `[new]` · `P2` · `S9`
- What: show how each mission built on previous memory — make Product Memory accumulation visible and rewarding; counter the "is it getting smarter?" question.
- Build: per-mission "context used" panel (which past decisions, signals, outcomes informed this mission's plan); memory growth chart (nodes + edges over time); "this mission referenced N prior decisions" badge; exportable context snapshot.
- States: first mission (no prior context, explain what will be remembered); mature product (rich context graph visible).
- Done when: a mission trace shows which prior Product Memory nodes were retrieved and used in the plan.
- Depends: O1, O2, N1, N2.

**U6 — Full data portability / export** `[new]` · `P1` · `NFR`
- What: export all product data in open, standard formats — the anti-lock-in commitment made concrete. Operator can take their data to any tool at any time.
- Build: export wizard (per product or workspace); exports: signals (CSV/JSON), themes + opportunities (JSON), decisions + lineage (JSON), PRDs (Markdown), task graphs (JSON), agent configs (YAML), Product Memory graph (JSON), trace logs (JSON); scheduled export option; export audit log.
- States: large export (async + download link); partial export (per-data-type selection); export history.
- Done when: a full workspace export produces files importable into standard tools (CSV → spreadsheet, Markdown → Notion, JSON → any processor).
- Depends: B4, O1, G2, plan.md §9 (portability commitment).

**W6 — Persona-specific onboarding tracks** `[new]` · `P0` · `NFR`
- What: three onboarding paths matching the three primary personas — each emphasises the pain point most relevant to that user type and gets them to first value faster.
- Build: onboarding flow selector post-signup (Solo PM / Founding PM / Technical Founder); per-track: different sample data, different first-mission suggestion, different "first win" moment; track stored in profile; can switch tracks.
- States: existing user (skip or re-run track); partial onboarding (resume).
- Done when: each track gets a user to their first completed mission in <10 min (time-to-value measured).
- Depends: A1, W1, C5 (Strategic Briefing seeded as part of onboarding).

---

## Build-order rollup (status × build sequence)

Sequence from [`../plan.md`](../plan.md) §3. Status: ☐ not started · ◑ legacy partial (harden) · ☑ verified into `plan.md` §4. **Per-item code-verified grades + step-1 tickets: [`foundation-audit.md`](./foundation-audit.md) (2026-05-30).**

> **▶ This table is the canonical "what do I build next?" source.** To resolve the next actionable task deterministically (any tool, any human):
> 1. Take the **lowest-numbered step** that is still `◑` or `☐` (the `∥` cross-cutting row is pulled into step 1, not sequenced separately).
> 2. Expand its **Key IDs** to the feature entries above; pick the first whose own `[status]` is not `☑`.
> 3. Open its concrete ticket in [`foundation-audit.md`](./foundation-audit.md) (step 1) or its entry above (later steps), then build.
>
> `TASKS.md` (repo root) is the **strategic** P0–P3 view — it points here for the concrete next step; it is not itself the task queue.

| Step | Scope | Key IDs | Status |
|---|---|---|---|
| 1 | Foundation hardening + P0 non-functionals | 0.1–0.12, A1–A5, B1–B2, P1–P2, P6, P8, O2, R1 | ◑ |
| 2 | First slice: Discover→Define→Plan | F1–F3, G1–G2, H1–H3, N1 | ◑ |
| 3 | Orchestration layer (X1) | E1–E7, D1–D4, C1–C4, **C6**, E6 graph | ◑ |
| 4 | Build→Test→Ship (autonomous) | I1–I3, J1–J2, K1–K2, 0.10, 0.12 | ☐ |
| 5 | Multi-product / multi-workspace | B3–B5, B4, E5 | ◑ |
| 6 | Launch/GTM/Price + Operate/Support | L1–L2, M1 | ☐ |
| 7 | Learn + Product Memory | N2, O1, O3 | ◑ |
| 8 | Interop (MCP/A2A) | Q1–Q2 | ☐ |
| ∥ | Cross-cutting (pull P0s into step 1, rest as relevant) | S, T, U, V, W, X | ☐ |

**P0 critical path (the must-haves for a credible first user):** 0.1, 0.2, 0.5, 0.6, 0.7, 0.8, 0.9, 0.10, A1, A2, B1, B2, F1, F2, F3, G1, P6, P8, W1.

---

## Open scoping questions (decide before/early in the build)

1. **Name + stack lock** (`TASKS.md` P0) — blocks a cheap find-replace later.
2. **Durable runtime choice** (0.9) — Workers + queue (Durable Objects / external queue) vs. a longer-running worker. Architecture decision; everything autonomous depends on it.
3. **Test runner** (J1) — none configured today; pick before the autonomous test loop is real.
4. **Roster cardinality** (`plan.md` §6) — confirm the ~10 durable agents vs. dynamic-only.
5. **Monetization model** (V2) — needed to instrument cost-to-serve from day one, even if billing ships later.

> **Out of scope (now):** fine-tuning from `ai_events`; cross-workspace vector sharing; public skill-pack marketplace; cross-workspace SSO; fully autonomous *strategic* decisions (always human-gated). Per [`../plan.md`](../plan.md) §9.
