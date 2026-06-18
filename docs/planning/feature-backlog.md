# docs/feature-backlog.md — The granular feature backlog (build-ready)

> **SSOT first.** The single front-door tracker is [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) (status, build queue, founder rulings, findings, progress). This file is the granular acceptance-criteria and scope ledger (the F-ID detail) it points to, not the tracker to follow day-to-day.

> **What this is.** The exhaustive, sub-feature-level enumeration of _everything Cadence is built to ship_ — the dev-ready expansion of [`../plan.md`](../../plan.md) §2 (granular catalog). Every feature has a **stable ID** (e.g. `F2.3`) so it can become an issue/PR/spec and be referenced by traces, decisions, and the build log without re-describing scope.
>
> **Relationship to other docs (no duplication of rules).** Product thesis + USP/MOAT: [`../README.md`](../README.md). Build _order_: [`../plan.md`](../../plan.md) §3. Cross-cutting non-functional rationale + P0/P1/P2 priorities: [`../docs/considerations.md`](./considerations.md). UI/IA/screen + AI-message contract: [`../design.md`](../../design.md). Architecture contracts: [`../architecture/`](../../architecture/). Operating rules: [`../AGENTS.md`](../../AGENTS.md).
>
> **This file adds detail; it does not replace `plan.md`.** `plan.md` stays the narrative + build order; this is the flat, addressable scope list. Keep both true (closed doc loop, [`../AGENTS.md`](../../AGENTS.md) §5).
>
> **Looking for the next task to pick up?** Jump to the [Build-order rollup](#build-order-rollup-status--build-sequence) at the bottom - it is the canonical task queue. The live cursor (now / next / blocked) and the day-to-day build queue live in the SSOT, [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) (section 0 + section 3), which points back here for F-ID scope.

---

## ▶ Live status (moved) - this file is the F-ID scope ledger

> **The live status board moved.** Where-are-we-now (now building / next up / blocked) and the day-to-day build queue live in the SSOT, [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) - section 0 (the live cursor) + section 3. The per-station status matrix lives in [`feature-dashboard.md`](./feature-dashboard.md). The full append-only build history is [`../plan.md`](../../plan.md) section 4.
>
> **This file** holds only the granular, per-F-ID scope + acceptance criteria (the pillar catalog and the [Build-order rollup](#build-order-rollup-status--build-sequence) below). Read the SSOT first for what to pick up; come here for the detail behind a given F-ID.

---

## ▶ v4 Feature Map overlay (2026-06-11) — the binding scope layer

> **The v4 feature map ([`../strategy/v4-feature-map-2026-06-11.md`](../strategy/v4-feature-map-2026-06-11.md)) is now the binding scope source.** This overlay maps its station catalogs onto this backlog. The 8-Pillar grouping below remains as historical organization for existing F-IDs; new work is filed under v4 IDs. Where a v4 ID and a legacy F-ID cover the same thing, the row notes it — do not double-build.

**New v4 feature IDs (station · ID · status · maps-to-legacy):**

| v4 ID | Title | Milestone | Status | Legacy overlap |
| --- | --- | --- | --- | --- |
| F-IA-V4 | Collapse IA to 7 surfaces (Home · Chat · Missions · Product · Knowledge · Learn · Govern + Settings), redirects per established pattern, vocabulary enforcement | M1 | ☐ **next up** | extends F-IA-MERGE-* ✅, absorbs F-COCKPIT-MACHINE-MODE |
| SEN-01 | Connector dock: Slack + GitHub issues + one support tool ingest | M1 | ☐ | extends Pillar 1 ingest rows |
| SEN-04 | Researcher watchtower (competitor crawl briefs) | M2 | ☐ | new |
| SEN-05 | Quant analytics inbound (PostHog/Amplitude/Mixpanel) | M2 | ☐ | Pillar 7 placeholder |
| DEC-02 | Critic adversarial pass on opportunities | M1 | ☐ | new |
| DEF-03 | Critic-on-spec red team (spec lens: ambiguity · untestable criteria · scope creep) | M2 | ✅ 2026-06-14 | extends DEC-02 Critic infra |
| DEF-04 | Designer scaffolds (spec → mockup → sandbox preview, token + a11y check) | M3 | ☐ | Pillar 5 placeholder |
| BLD-04 | Delegate-out to external coding agents under our governance (A2A/Linear-style) | M4 | ☐ | new — strategic |
| BLD-05 | Inspector gate (agent-authored tests + preview before merge proposal) | M2 | ☐ | extends Bundle 9 CI read |
| LCH-01 | Launch kit mission (changelog/blog/email/social/docs from diff + spec) | M2 | ☐ | Pillar 7 partial |
| LRN-01 | Support triage loop (tickets → drafted replies gated → bug clusters → signals) | M2 | ☐ | extends F-OUTCOME-SURFACE reads |
| LRN-02 | Outcome reviews (predicted vs actual, Historian verdicts) | M2 | ☐ | new |
| LRN-04 | Product Memory consult/write runtime on every mission + trace visibility | M2 | ☐ | the moat — new |
| ENG-06 | Cost-per-mission / cost-per-artifact telemetry chips | M1 | ☐ | extends budgets/traces |
| ENG-07 | MCP server + client, A2A cards/scopes/audit | M4 | ☐ | Pillar 8 / X5 rows |
| ENG-08 | Roles + per-persona approval lanes | M3 | ☐ | A. roles `[new]` row |
| OPS-01 | Flow mode (ambient soundscape + focus timer on Home, notification quieting) | M3+ | ☐ | new, P3 |

Full L4 decomposition pattern: v4 map §9 M1 exemplar (every hop = HandoffEnvelope + one human card). When picking up any v4 ID, decompose to that grain in this file first, then build.

---

## ▶ Agentic Proof Platform (v1.1) — full product lifecycle, end-to-end on real systems

> **What this is.** A scope overlay — not a new roadmap. The exhaustive backlog below is unchanged. This section picks the smallest subset of existing features whose _combined, end-to-end behavior on real data_ proves that Cadence delivers agentic-native product management that legacy PM tools (Jira, Linear, Productboard, ProductPlan, Aha) structurally cannot. **The YC demo is a by-product; the platform is the point.**
>
> **Locked decisions (2026-06-03):** Demo persona = **Founder-as-PM** ("run the product org you can't afford to hire"). Demo data = **real product** (default: Cadence-on-Cadence; design partner is additive). **v1.1 un-defers Build/Test/Ship/Launch/Support** to cover the whole PM lifecycle end-to-end — under one realism rule: _agents orchestrate existing tools (GitHub, CI, deploy, Slack/email, support channel) where the tool already exists; they don't replace IDEs, CI, or helpdesks._ See [`docs/strategy/session-decisions.md`](../strategy/session-decisions.md) for the reframe.
>
> **From demo cut → proof cut.** Every bundle now ships against an explicit **proof bar** — the minimum behavior that makes the claim true on real data, not just visible in a screenshot. If a visitor cannot point to each of the four claims being true in the running product within ~5 minutes, the bundle hasn't shipped.

### The four claims we are proving

| #      | Claim (vs. legacy PM tools)                                                                                                                  | Proof artifact                                                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | Agents **operate**, humans govern — agents run multi-step missions, not assist with forms                                                    | Live Mission Graph + Decision Queue with real approval gates firing                                                                                                  |
| **C2** | **Agent-to-agent handoff is first-class** — no human in the routing path                                                                     | A2A trace: Discovery → Strategist → Planner, each reading prior agent's structured output, with full lineage                                                         |
| **C3** | The **whole lifecycle is one governed loop** — Discover → Define → Plan → Build → Test → Ship → Launch → Support → Learn (re-feeds Discover) | One continuous mission from a real signal to a re-scored opportunity, passing through a real PR, real merge, real deploy, real outbound message, real inbound ticket |
| **C4** | **Trust is earned and visible** — autonomy is dialed, not assumed                                                                            | Trust Score + Autonomy Dial per agent, changing behavior of approval gates in real time                                                                              |

### Realism rule (so "full lifecycle" doesn't become "half-baked everywhere")

For each lifecycle stage, the demo bar is: a real artifact lands in a real external system that a PM would actually use, driven by an agent through a real integration. No mocks. No "click here and pretend it deployed."

| Stage    | Real external system                                            | Real artifact                                                       | What the agent owns                                                 | What we do NOT build                      |
| -------- | --------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| Discover | Cadence DB (own signals: feedback, issues, session-decisions)   | Themes + scored opportunities                                       | Discovery agent: ingest, cluster, score                             | New signal connectors beyond what 0.x has |
| Define   | Cadence DB (PRD doc, tiptap)                                    | Versioned PRD with lineage to opportunities                         | Strategist agent: draft + iterate                                   | A new doc editor                          |
| Plan     | Cadence DB + GitHub Issues                                      | Sprint plan + real issues in GitHub                                 | Strategist proposes; Orchestrator writes via GitHub MCP on approval | Replacing Linear/Jira                     |
| Build    | GitHub PR                                                       | A real PR on the Cadence repo for one planned task                  | Builder agent: scoped diff + PR via GitHub MCP                      | A custom autonomous IDE (Cursor/Devin)    |
| Test     | GitHub Actions (existing CI)                                    | CI run on the PR; agent reads results                               | Builder: watch CI, surface failures, propose fix                    | A new test runner                         |
| Ship     | GitHub merge + existing deploy webhook                          | Merged PR + deploy event recorded                                   | Builder (with approval gate): merge; Cadence ingests deploy webhook | A new deploy pipeline                     |
| Launch   | Markdown changelog + one outbound channel (email/Slack via MCP) | Real changelog + a real draft message in the channel                | Growth agent: draft on ship; send on approval                       | A marketing automation tool               |
| Support  | One real inbound channel (email forward / webhook)              | Tickets ingested, triaged, routed back as signals                   | Support agent: triage + link to PRD/opportunity                     | A full helpdesk (Zendesk)                 |
| Learn    | Cadence DB                                                      | Outcome attached to opportunity → re-scored → re-ranked next sprint | Analyst agent: measure, insight memo, feed Trust Score              | A full analytics product                  |

### The 12 capability bundles + proof bars

Each bundle composes existing backlog IDs; nothing here is a parallel scope. Bundles are ordered by the dependency chain, not priority.

| #      | Bundle                                                                                                                                     | Proof bar (what makes the claim true)                                                                                                                                                                                                                                                                                                                    | Backlog IDs                                                             | Supports   | Status                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------- | ---------------------------- |
| 1      | **Governed Foundation** — tenancy, AI chokepoint, trust tables, blast-radius, kill-switch + spend caps, injection defense, durable runtime | Killing an agent mid-mission halts spend within 1 tick; every action has an audit-log row queryable from the UI.                                                                                                                                                                                                                                         | 0.1, 0.2, 0.3, 0.5, **0.6** ✅, **0.7** ✅, 0.9, A1/A2                  | C1, C4     | ◑ (0.6 + 0.7 done; 0.9 next) |
| 2      | **Strategic Briefing surface**                                                                                                             | Changing the brief visibly changes the next Discovery + Strategist output (not just stored).                                                                                                                                                                                                                                                             | C5 (new) ✅                                                             | C1, C3     | ☑                            |
| 3      | **Agent Roster + Trust Score + Autonomy Dial**                                                                                             | Dialing autonomy from Observing → Trusted removes a specific approval gate; Trust Score moves based on real outcomes (eval pass-rate, approval-acceptance, mission success).                                                                                                                                                                             | C1, C2, C3, C4, **C6** (new)                                            | C1, C4     | ☐                            |
| 4 ⭐   | **Agent-to-Agent comms + handoff + sub-agent spawning**                                                                                    | One mission with **≥3 hops** between agents, each reading prior agent's **structured** output via the orchestration layer (not prompt-stuffing), full trace replayable.                                                                                                                                                                                  | E1, E2, E3, E4, E5                                                      | C2         | ☐                            |
| 5      | **Live Mission Graph**                                                                                                                     | The graph updates in real time as agents act; clicking a node opens that agent's trace + cost + tokens + approval state.                                                                                                                                                                                                                                 | E6, X1                                                                  | C1, C2     | ☑                            |
| 6      | **Lifecycle slice — Discover → Define → Plan on real data**                                                                                | Real signals → real PRD → real sprint plan → one approval-gated item → on approval, **real GitHub issue created via MCP**. End-to-end, no human routing.                                                                                                                                                                                                 | F1, F2, F3, G1, H1 + **N1** (new, GitHub-issues sync)                   | C3         | ◑ (legacy parts reusable)    |
| 7      | **Decision Queue + approval gates UX**                                                                                                     | Every gate the agents hit lands in the queue with context (what, why, cost-if-approved, who proposed); approve/reject changes downstream agent behavior.                                                                                                                                                                                                 | D3, P-approvals                                                         | C1, C4     | ◑ (reusable)                 |
| 8      | **Product Memory + lineage + full data export**                                                                                            | Every artifact (signal → theme → opportunity → PRD → decision) has lineage backward to its source; "Export everything" produces a complete, re-importable archive.                                                                                                                                                                                       | O1, O2, U6 (new)                                                        | C3         | ☐                            |
| **9**  | **Build + Test bundle** — Builder agent + scoped PR + CI read + parallel-safe conflict guard                                               | Builder opens a **real PR** on the connected repo for one planned task; reads CI status; on red proposes a one-file fix commit; two missions can't race on the same file. All gated by approval mode. **Shipped 2026-06-04 (Slice 1) + 2026-06-06 (Slices 2 + 3).** Per-feature doc: [`./features/bundle-9-builder.md`](../features/bundle-9-builder.md). | **I-thin (S4)**, **J-thin (S5)** + GitHub MCP write scope               | C2, C3     | ✅                           |
| **10** | **Ship bundle** — approval-gated merge + deploy webhook ingest                                                                             | Operator approves merge → real merge → existing deploy webhook lands → Ship node lights up on Mission Graph with deploy URL + commit SHA.                                                                                                                                                                                                                | **K-thin (S6)** + deploy webhook ingest                                 | C1, C3     | ☐                            |
| **11** | **Launch bundle** — changelog + one outbound channel                                                                                       | Growth agent drafts changelog + outbound message on ship; operator approves; message is **really sent** to one real channel (Slack or email).                                                                                                                                                                                                            | **L-thin** (changelog + one outbound integration)                       | C3         | ☐                            |
| **12** | **Support → Learn loop** — one inbound channel + Analyst learn loop                                                                        | Real ticket arrives via one channel → Support agent triages and links to source PRD/opportunity → Analyst attaches outcome and re-scores → next Discovery cycle reflects it. **The loop closes.**                                                                                                                                                        | **M-thin** (one inbound channel) + **Z1** (Analyst learn loop) on O1/O2 | C2, C3, C4 | ☐                            |

### Build sequence (Proof Platform v1.1)

1. **Finish foundation gaps** — **0.9 FND-RUNTIME** (long missions must survive worker restarts before handoff is meaningful) → **0.2 cache stage**. _(Matches existing Build-order rollup step 1.)_
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

External-facing **MCP / A2A interop** (Q — Cadence exposing its agents to outside callers), advanced eval / drift / guardrail UIs beyond what the chokepoint already does, multi-product portfolio view (B3), BYO keys UI polish (A5), billing UI, full autonomous coding/IDE depth (we orchestrate GitHub via MCP; we do NOT replace Cursor/Devin), full helpdesk depth (one inbound channel only), marketing-automation depth (one outbound channel only), analytics dashboards (Learn is a re-score + insight memo). Positioning: _"agentic orchestration of the existing stack; each integration deepens over time."_

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

## The 8 Cockpit Pillars Mapping

This feature backlog is organized under the **8 Cockpit Pillars** representing the end-to-end product lifecycle for a B2B Enterprise team. The 24 developer epics map directly into these pillars:

| Pillar                                     | Focus                    | Included Epics & Feature Scopes                                                        | Stable ID Ranges                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pillar 1: Signal & Discovery**           | "Perplexity for PMs"     | Signal Capture (S1), opportunity clustering, Product Memory, continuous discovery feed | EPIC F (Discover), EPIC O (Product Memory), EPIC N (Learn)                                                                                                                                          |
| **Pillar 2: Speech & Meeting Intake**      | "WhisperFlow for PMs"    | Audio sync and meeting transcription, spec/ticket extraction                           | EPIC S2 (Audio Sync), `F-AUDIO-*`                                                                                                                                                                   |
| **Pillar 3: Conversational Swarm Command** | "ChatGPT/Claude for PMs" | Swarm steering, natural language intent routing, execution loops                       | EPIC D (Agent Execution), `F-CHAT-NL-INTENT`                                                                                                                                                        |
| **Pillar 4: Spec & Plan**                  | "Jira/Linear for PMs"    | PRD writing, roadmapping, sprint planning, Linear/Jira connectors                      | EPIC G (Define), EPIC H (Plan)                                                                                                                                                                      |
| **Pillar 5: Design & Scaffolding**         | "Lovable for PMs"        | UI mockups, visual sandbox, design tokens, style audits                                | EPIC I (Build - Studio/Sandbox portions)                                                                                                                                                            |
| **Pillar 6: Build & QA**                   | "Cursor for PMs"         | Autonomous code writing, CI status loop, test generation, test runners                 | EPIC J (Test), EPIC I (Build - code generation portions)                                                                                                                                            |
| **Pillar 7: Release & Support**            | The Closed Loop          | Ship approvals, deploy webhook tracking, GTM changelogs, Support triage                | EPIC K (Ship), EPIC L (Launch), EPIC M (Support), EPIC N (Learn delta), `F-ANALYTICS-*`                                                                                                             |
| **Pillar 8: Cockpit & Observability**      | "Miro for PMs"           | Swarm HUD, live DAGs, budget telemetry, governance gates, workspaces, auth, interop    | EPIC 0 (Foundation), EPIC A (Identity), EPIC B (Workspaces), EPIC C (Agents config), EPIC E (Coordination), EPIC P (Observability), EPIC Q (Interop), EPIC R (Platform), EPICS S-X (Non-Functional) |

---

---

## Pillar 1: Signal & Discovery ("Perplexity for PMs")

_Focus: Signal Capture (S1), opportunity clustering, Product Memory, continuous discovery feed._

#### EPIC F — Discover `S1` _(first end-to-end slice)_

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
- Done when: new signals update the feed without a full recompute. _This is the lead use case._
- Depends: F2.

---

#### EPIC N — Learn `S9`

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

#### EPIC O — Product Memory `X4`

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

---

## Pillar 2: Speech & Meeting Intake ("WhisperFlow for PMs")

_Focus: Audio sync and meeting transcription, spec/ticket extraction._

### Placeholder Features (WhisperFlow for PMs)

**F-AUDIO-1 — Speech transcription & chunking** `[new]` · `P1` · `S2`

- Build: upload meeting/voice audio → Whisper API transcribe → segment diarization → chunk transcripts.
- States: background upload fails; noisy audio; long transcripts.
- Done when: audio file upload yields formatted speaker-labelled transcripts with timestamps.
- Depends: 0.1, 0.2.

**F-AUDIO-2 — Action item & ticket extraction** `[new]` · `P1` · `S2`

- Build: process transcript → extract action items, requirements, and user pain points → draft opportunities or PRD suggestions citing transcripts.
- States: ambiguous context; hallucinated action items.
- Done when: transcribed meeting automatically generates draft tickets / opportunities in the discovery feed.
- Depends: F-AUDIO-1, F2.

---

## Pillar 3: Conversational Swarm Command ("ChatGPT/Claude for PMs")

_Focus: Swarm steering, natural language intent routing, execution loops._

#### EPIC D — Agent execution `X1`

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

---

## Pillar 4: Spec & Plan ("Jira/Linear for PMs")

_Focus: PRD writing, roadmapping, sprint planning, Linear/Jira connectors._

#### EPIC G — Define `S2`

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

#### EPIC H — Plan `S3`

**H1 — Task graph** ✅ 2026-06-14 · `[reuse]` · `P0` · `S3`

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

---

## Pillar 5: Design & Scaffolding ("Lovable for PMs")

_Focus: UI mockups, visual sandbox, design tokens, style audits._

#### EPIC I — Build (autonomous) `S4` _(the differentiator)_

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

---

## Pillar 6: Build & QA ("Cursor for PMs")

_Focus: Autonomous code writing, CI status loop, test generation, test runners._

#### EPIC J — Test (autonomous) `S5`

**J1 — Test generation + run** `[new]` · `P1` · `S5`

- Build: agents author + run unit/integration/E2E + evals; runner wiring (note: no test runner configured yet — see CLAUDE.md); results persisted.
- States: flaky test; timeout; environment missing.
- Done when: the QA agent generates and runs tests producing a pass/fail gate signal.
- Depends: I1, 0.12.

**J2 — QA gate + self-correct loop** `[new]` · `P1` · `S5`

- Build: failing tests feed back to the build agent until green or escalate; regression gate (≥10-point eval regression on the 0–100 scale blocks without override — KI-14); ties "Cadence core" eval suite (P5).
- States: infinite-correct guard (cap); unrecoverable → escalate to Decision Queue.
- Done when: a failing suite loops the Engineer until green or escalates; a regression blocks Ship.
- Depends: J1, P5, D3.

---

---

## Pillar 7: Release & Support (The Closed Loop)

_Focus: Ship approvals, deploy webhook tracking, GTM changelogs, Support triage._

#### EPIC K — Ship `S6`

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

#### EPIC L — Launch / GTM / price `S7`

**L1 — Launch + positioning + pricing + distribution drafts** `[new]` · `P2` · `S7`

- Build: agent-drafted launch assets, positioning, pricing pages, distribution plans; human-approved before anything external.
- States: nothing external sends without approval (governance gate).
- Done when: an agent produces a launch package that requires approval to publish.
- Depends: G/H/N (context), D3, Q (publish targets).

**L2 — Customer-facing pages / announcements** `[new]` · `P2` · `S7`

- Build: generate public pages (`p.$slug`) + announcement copy; preview; approval to publish.
- Depends: L1.

---

#### EPIC M — Operate / support `S8`

**M1 — Ticket triage + draft answers + route/escalate** `[new]` · `P2` · `S8`

- Build: agents triage inbound tickets, draft answers, route, escalate; support themes flow back into Discover (closes the loop into F1).
- States: low-confidence → escalate; PII handling (U5).
- Done when: a ticket is triaged + draft-answered and its theme appears as a new signal.
- Depends: F1, 0.7, Q.

---

### Placeholder Features (Cohort Metrics & Loop Evaluation)

**F-ANALYTICS-1 — Cohort metrics & telemetry ingestion** `[new]` · `P1` · `S8`

- Build: ingest cohort usage data (daily active users, retention, key actions) → store in `product_analytics` → link to launched features.
- States: ingestion bottleneck; missing event mappings.
- Done when: product analytics dashboards show cohort retention curves correlated with specific feature release tags.
- Depends: 0.1, 0.2.

**F-ANALYTICS-2 — Opportunity impact evaluation** `[new]` · `P1` · `S9`

- Build: analyze post-release cohort performance → feed results back into Strategist and Product Memory → auto-update ICE scores for related opportunities.
- States: low sample size (warn); conflicting signals.
- Done when: system evaluates release outcomes and re-evaluates strategic priorities based on real usage.
- Depends: F-ANALYTICS-1, EPIC O.

---

## Pillar 8: Cockpit & Observability ("Miro for PMs")

_Focus: Swarm HUD, live DAGs, budget telemetry, governance gates, workspaces, auth, interop._

#### EPIC 0 — Foundation, tenancy & runtime `FND`

_The base every later stage is an addition to, not a rewrite of. Build order step 1._

**0.1 — Three-key tenancy + RLS** `[extend]` · `P0` · `FND`

- What: enforce `user_id` + `workspace_id` + `product_id` scoping on every table and RLS policy.
- Build: add `product_id` to all product-scoped tables; RLS policies for select/insert/update/delete keyed on all three; tenancy helper in server fns; deny-by-default policies; tenancy assertion in the chokepoint and orchestrator.
- States: missing-context request rejected (no silent cross-tenant read); workspace-with-no-product; product archived.
- Done when: an integration test proves a row created under (W1,P1) is invisible to (W1,P2) and (W2,\*) at the DB layer.
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
- Depends: —. See [`../design.md`](../../design.md).

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

#### EPIC A — Identity & access `X6`

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

#### EPIC B — Workspaces & products `X2`

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

#### EPIC C — Agents (configuration) `X1`

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

#### EPIC E — Agent communication, coordination & transfer `X1` _(the autonomous spine — do not defer)_

**E1 — Sub-agent spawning** `[done]` · `P1` · `X1`

- Built (MVP): any agent inside a mission spawns the next hop via `agent.handoff` → `enqueueHandoff` (inserts a `queued` `agent_runs` row + structured `agent_messages` row). Spawned runs inherit the chokepoint, the user's tool allow-list, the workspace brief, and their own autonomy arc. Lifecycle = `queued → running → completed/failed`, all rows tied to the mission via `mission_id`.
- Out (deferred): dedicated `agent.spawn` tool with fan-out semantics (folded into Bundle 5 alongside E4 polish).
- See: `docs/a2a-handoff.md`.

**E2 — Agent-to-agent (internal) messaging** `[done]` · `P1` · `X1`

- Built: `agent_messages` table — one structured payload per hop (`from/to_agent`, `kind`, `payload jsonb`, source run/trace, consumer run, `created_at` for ordering). RLS scoped to workspace members. Receiver loads its inbound message via `consumeInboundHandoff` and gets it injected as a `--- Handoff from {agent} ---` block in its system prompt. Receiver never sees a pasted prompt — only a typed JSON payload.
- Out (deferred): loop-guard / message-cap is currently implicit (mission scope + sweeper backpressure). Explicit per-mission message cap is a Bundle 5 polish item.

**E3 — Agent transfer / handoff** `[done]` · `P1` · `X1`

- Built: `missions` table groups every hop. `agent.handoff` tool (write/confirm) takes `to_agent_slug + task + context + artifacts + open_questions + constraints` and enqueues the receiver as a new `agent_runs` row with the same `mission_id`. Receiver inherits brief + structured handoff block; references artifacts by ID and re-reads them with its own tools (no game-of-telephone summarization). Done-when met: a Planner→Engineer→QA chain runs with each stage's first system prompt carrying the prior stage's structured payload.
- See: `docs/a2a-handoff.md` "Why structured payloads".

**E4 — Parallel sub-agents** `[done — schema; UI deferred]` · `P1` · `X1`

- Built: schema supports parallel hops on a single mission — no serial constraint on `agent_messages`, no FK preventing two queued runs sharing a `mission_id`. The resume-runs sweeper promotes them subject to per-workspace concurrency cap (5).
- Out (deferred): a fan-out tool (`agent.spawn` returning N message ids) + merge-result step in the parent agent. Both fold cleanly into Bundle 5.

**E5 — Parallel agent sessions** `[done]` · `P1` · `X1`

- Built: two missions in the same workspace run concurrently up to the FND-RUNTIME 0.9 backpressure cap (`MAX_RUNNING_PER_WORKSPACE = 5`). Above that, additional missions sit `queued` and are promoted by the sweeper. Per-mission isolation is enforced by `mission_id` on `agent_runs` + `agent_messages` and by RLS scoping to `workspace_members`. No cross-bleed possible — each run loads only its own inbound handoff and writes only to its own mission.

**E6 — Orchestration / mission graph view** `[done]` · `P1` · `X1`

- Built (2026-06-04): live DAG on `/missions/$id` via `src/components/cadence/MissionGraph.tsx`. Pure-SVG, no external graph lib. Nodes = `agent_runs` rows; edges = `agent_messages` (`source_run_id → consumed_by_run_id`, fallback to next hop matching `to_agent_slug` while in flight). Layout = BFS-depth columns × chronological rows; fan-out renders as parallel rows in the child column. Status color + glyph mirror the hop card; click = expand+scroll target hop; keyboard accessible. Re-uses the existing 2s refetch loop while mission `status='running'`.
- How to use / verify: dispatch any mission from `/agents` with "Start as mission" → open `/missions/{id}` → Mission graph card sits above the Agent timeline. Single-agent mission ⇒ 1 node, 0 edges. Multi-hop ⇒ N nodes + labelled handoff edges, updating live. Click a node ⇒ matching hop card expands + scrolls into view; per-hop `/traces/$traceId` link still works.
- Deferred to later: pause/steer-from-graph controls, zoom/collapse for very large graphs (>20 nodes), per-node cost/token rollup pill (data available once we surface it in `getMission`).
- Depends: E1–E5, P.

**E7 — Shared vs. private memory** `[extend]` · `P1` · `X1`

- Build: mission-shared context + per-agent long-term memory with importance decay; access rules (no leakage across missions/products).
- Depends: O1, 0.1.

---

#### EPIC P — Trust & observability `X3`

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

- Build: "Cadence core" eval suite; per-surface/agent coverage targets; ≥10-point regression (0–100 scale — KI-14) blocks deploy without override.
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

#### EPIC Q — Interop (agent-native) `X5`

**Q1 — MCP server + client** `[new]` · `P2` · `X5`

- Build: expose Cadence capabilities as MCP tools (server); consume external MCP tools (client); capability scopes; rate limits; audit.
- States: untrusted tool result → quarantine (0.7); scope-exceeded call blocked.
- Done when: an external agent calls a scoped Cadence tool and the call is audited.
- Depends: 0.7, S5.

**Q2 — A2A server/client + Agent Cards + scopes/limits/audit** `[new]` · `P2` · `X5`

- Build: Agent Cards; delegate-to-agent; peer registry; per-peer scopes + rate limits; prompt-injection guard on external results; audit log.
- Depends: Q1, 0.7.

---

#### EPIC R — Platform & ops

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

#### EPIC S — Security & compliance `NFR`

**S1 — Sandboxed execution for agent code** `P0` → see **0.10**.
**S2 — Supply-chain security (agent-installed deps)** `[new]` · `P0`: allow-list + scanning before install; ties bunfig `minimumReleaseAge`.
**S3 — Secret scanning + SAST in build pipeline** `[new]` · `P1`: scan agent code for secrets/vulns pre-merge.
**S4 — Key rotation + compromise response** `[new]` · `P1`: rotate BYO/gateway/DB creds; revoke + re-issue runbook. Depends A5.
**S5 — Pen-test + threat model for MCP/A2A** `[new]` · `P1`: threat model the external-agent surface. Depends Q.
**S6 — RBAC / roles / team membership** `[new]` · `P1`: enforce at RLS + UI. Depends A6.

#### EPIC T — Reliability / SRE `NFR`

**T1 — App monitoring + alerting** `P0` → see **0.11**.
**T2 — SLOs/SLAs + error budgets + status page** `[new]` · `P1`.
**T3 — Long-running job durability / queue + backpressure** `P0` → see **0.9**.
**T4 — Graceful degradation on provider/model down** `P0` → see **0.8**.
**T5 — Incident response runbooks + on-call** `[new]` · `P1`. Depends P7.
**T6 — DR: backups, PITR, restore drills** `P0/P1` → see **0.11**.

#### EPIC U — Data & privacy `NFR`

**U1 — Data retention + deletion (GDPR/CCPA)** `[new]` · `P1`: `ai_events` currently unbounded → retention + right-to-be-forgotten.
**U2 — Data export / portability** `[new]` · `P1`: per-workspace/product export (anti-lock-in). Depends B5.
**U3 — Sub-processor list + DPA** `[new]` · `P1`: disclose model-vendor data flows; contracts.
**U4 — Data residency / region options** `[new]` · `P2`.
**U5 — PII classification + minimization before model calls** `[new]` · `P1`: strip/mask PII pre-provider; pairs with guardrails P2.

#### EPIC V — Finance & monetization `NFR`

**V1 — Usage metering + plan-limit enforcement** `[new]` · `P0/P1`: meter tokens/missions; enforce caps. Depends P6.
**V2 — Cost-to-serve vs. price model** `[new]` · `P0`: per-mission cost attribution feeding margin analysis.
**V3 — Payments, trials, dunning, invoicing** `[new]` · `P1`.
**V4 — Per-customer cost attribution** `[new]` · `P1`. Depends V1.

#### EPIC W — Growth / GTM platform `NFR`

**W1 — Onboarding + activation + samples/templates** `[new]` · `P0`: time-to-value; seeded sample product. Depends A1.
**W2 — Product usage analytics (separate from AI telemetry)** `[new]` · `P1`: activation/retention/funnels.
**W3 — Marketing site, pricing page, waitlist, SEO** `[new]` · `P1`.
**W4 — In-app support, help center, changelog, docs** `[new]` · `P1`.
**W5 — Mobile/PWA for approvals triage** `[new]` · `P2`: approvals can't block on desktop. Depends D3.

#### EPIC X — Legal & compliance `NFR`

**X1 — ToS, privacy policy, AUP, DPA** `[new]` · `P1` (required to sell).
**X2 — IP ownership of agent-generated code/content** `[new]` · `P1`.
**X3 — Liability for autonomous actions** `[new]` · `P1` (governance gates are part of the answer).
**X4 — OSS license compliance of agent-installed deps** `[new]` · `P1`. Ties S2, AGENTS.md §9.
**X5 — SOC 2 / ISO 27001 / ISO 42001 path** `[new]` · `P2` (substrate in security.md).

---

---

## Recent Additions & Triage

## New features — v2 Positioning Session (2026-06-02)

_Derived from strategic repositioning to "autonomous product OS." Full reasoning: [`strategy/product-positioning-v2.md`](../strategy/archive/v2-positioning-2026-06-02.md)._

**C5 — Strategic Briefing surface** `[status: ☑ shipped 2026-06-04]` · `P0` · `X1`

- What: one place where the operator defines mission, target user, current focus, anti-goals and notes once; every agent reads it as their operating context before each mission.
- Built: `workspace_briefs` table (one per workspace; mission / target_user / current_focus / anti_goals / notes; member-read, owner-write RLS). Editor at `/_authenticated/briefing` (5 textareas with hint copy + char counts + Save). `renderBriefBlock()` helper emits a labelled fenced text block (skipped when every field is empty). Agent loop injects the rendered block **between the agent's persona prompt and memory recall** in `src/lib/ai/loop.server.ts` so Discovery / Strategist / Builder all see the operator's shared context first. Migration also added `prds.github_issue_url` + a `prd.link_issue` tool to close PRD↔issue link-back.
- Done when: ✅ a mission's system prompt visibly contains the brief; editing the brief changes the next mission's plan.
- Depends: C2, G2 (editor), O2 (RAG context).

##### How to use / verify

- **Where to find it.** Sidebar → **Briefing** (Crosshair icon, pinned right after Today). Route: `/briefing`.
- **What each control does.** Five textareas — **Mission** (what this workspace exists to do), **Target user (ICP)** (who you're building for), **Current focus** (this quarter's priorities), **Anti-goals** (what to refuse to spend effort on), **Notes** (tone / constraints / decisions). Top-right **Save brief** button (disabled until dirty).
- **Server enforcement.** Read via `getActiveBrief` server fn (workspace-member RLS). Write via `upsertBrief` (workspace-owner only — RLS rejects everyone else). Brief content is injected into the agent loop's system prompt _before_ the tools list and quarantined tool-output rules, so it can't be overridden by tool output.
- **Verification checklist:** (1) Open `/briefing`, type a Current focus + Anti-goal, hit Save (toast confirms). (2) Run a mission from `/agents` (Discovery Scout / PRD Writer / Strategist). (3) Open the trace at `/traces/{trace_id}` and inspect the first model call's system prompt — the **Workspace Strategic Brief** block must appear between the persona prompt and the tools list. (4) Edit the brief, re-run the mission, confirm the Strategist's draft now reflects the new focus and refuses the anti-goal.

**C6 — Agent Trust Score + Autonomy Dial** `[status: ☑ shipped 2026-06-04]` · `P0` · `X1`

- What: each agent shows a visible trust score (0–100) computed from mission outcomes, approval acceptance, and eval scores; the operator places the agent on the trust arc (Observing → Proving → Trusted → Ambient) via an inline dial, and that arc composes with each tool's own approval mode in the agent loop.
- Built: `agent_autonomy` table (one row per user+agent, owner-only RLS). Trust score computed on read (`src/lib/ai/trust.server.ts → computeAllAgentTrust`) with Bayesian shrinkage so a 1-run agent doesn't show 100%. `resolveApprovalMode(toolMode, arc)` is the single combiner: Observing forces `review`, Proving forces `confirm`, Trusted lets `confirm` tools run inline, Ambient lets everything except hard-locked tools run inline. Safety floor preserved: `review` is sticky, and `calendar.create` keeps `confirm` even at Ambient. Server fns `getAllAgentTrust` + `setAgentArc` in `src/lib/trust.functions.ts`. UI: Trust chip (color-tiered, hover tooltip with full breakdown + formula) on each agent button and detail header; AutonomyDial (4 arc buttons + suggested-arc hint) inside the agent detail card.
- Out of scope (later): trust history chart, auto-promotion on sustained score, E8 Loop Health Monitor.
- Done when: ✅ dialing Discovery Scout from Observing → Trusted causes the next mission's `confirm`-mode tool to execute inline instead of queueing in the Decision Queue, and the trace shows `status:"executed"`.
- Depends: C2, D3, P1.

##### How to use / verify

- **Canonical explanation:** see [`docs/trust-and-autonomy.md`](../features/trust-and-autonomy.md) — operator-facing meaning of the 0–100 scale, the three ingredients (40/30/30), the four arc levels, safety floors, and the operator playbook. Linked from `architecture/orchestration.md`.
- **Where to find it.** Route `/agents`. Trust chip appears on each agent in the left roster and at the top of the right-hand detail card. The Autonomy Dial sits inside the detail card, just under the agent persona.
- **What each control does.** **Trust chip** (e.g. `Trust 72 · Trusted`) — the qualitative label is derived from the score band (`At-risk` / `Observing` / `Proving` / `Trusted` / `Ambient`; `New` until ≥3 samples). Hover (Radix tooltip) shows the 0–100 scale + Bayesian shrinkage explanation, then the weighted breakdown: Missions 40%, Approvals 30%, Evals 30% with raw counts and the suggested arc. **Autonomy Dial** — 4 buttons (Observing · Proving · Trusted · Ambient); each button has its own tooltip describing exactly what it does to `auto` / `confirm` / `review` tools. Clicking one writes `agent_autonomy` for that user+agent. The suggested arc is shown when it differs from the current arc.
- **Server enforcement.** `setAgentArc` server fn writes via `requireSupabaseAuth`; RLS on `agent_autonomy` restricts everyone to their own rows. The agent loop (`src/lib/ai/loop.server.ts`) calls `loadAgentArc` once per run and `resolveApprovalMode(toolMode, arc)` at every tool-call gate. `review` mode is sticky (never downgraded). `calendar.create` is hard-locked: even at Ambient it forces `confirm`.
- **Verification checklist:** (1) Open `/agents` — every agent card shows a Trust chip with qualitative label (first-time users see `Trust 50 · New`). (2) Hover the chip — Radix tooltip explains the scale, formula, and full breakdown. (3) Hover each arc button — each shows what that arc does to `auto` / `confirm` / `review` tools. (4) Dispatch a goal on **Discovery Scout** with the dial at **Observing** → the action is queued for review (visible at `/decisions` or `/traces` with `status:"queued"`). (5) Flip to **Trusted** → re-dispatch → a `confirm`-mode tool executes inline (trace step `status:"executed"`). (6) At **Ambient**, confirm `calendar.create` still hard-forces `confirm` (safety floor).

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

## v3 Audit Triage (2026-06-06)

_Derived from [`./strategy/archive/v3-audit-2026-06-06.md`](../strategy/archive/v3-audit-2026-06-06.md) (22 product RECs) and [`./strategy/archive/v3-audit-language-2026-06-06.md`](../strategy/archive/v3-audit-language-2026-06-06.md) (10 LANG + tooltip + IA + outcome + chip recs). Operator-approved A→C→B sequence; this triage **is** Phase C. Each F-ID below is a thin entry pointing back to the audit doc for full body + impact/effort/horizon scoring — do not duplicate that prose here._

**Owner column:** any tool may pick a row whose own status isn't `☑`. Update Live status board's "Now building" before starting. Cross-tool rules: [`../AGENTS.md`](../../AGENTS.md) §10.

**Status legend:** ☑ shipped · ◑ partial · ☐ not started · ⊘ closed/superseded.

#### P0 — ship in the next two weeks (low-risk voice/clarity wins)

| F-ID                  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Source recs                         |  Owner  | Status |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | :-----: | :----: |
| `F-VOICE-LOGIN`       | Rewrite `/login` headline + subhead to the v3 thesis ("Your product org, run by a swarm of agents…").                                                                                                                                                                                                                                                                                                                                                                                                                                                | REC-01 · LANG-01                    | Lovable |   ☑    |
| `F-VOICE-AINATIVE`    | Grep + replace every `AI-native` string with v3 language; update marketing meta + sidebar tagline.                                                                                                                                                                                                                                                                                                                                                                                                                                                   | REC-02                              | Lovable |   ☑    |
| `F-VOICE-VERSIONS`    | Strip `Phase N` / `Bundle N` / `Slice N` internal labels from operator UI (`/build`, `/discovery`, `/opportunities`, `/prds`); keep them in docs only.                                                                                                                                                                                                                                                                                                                                                                                               | REC-18 · LANG-02                    | Lovable |   ☑    |
| `F-VOICE-EMPTY-TODAY` | Rewrite Today empty state (drop "hit refresh") + Swarm empty state (drop "humming").                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | LANG-06                             | Lovable |   ☑    |
| `F-VOICE-CASE`        | Sentence-case every page H1; remove `uppercase tracking-[0.16em]` mono-labels and serif gradients on `Upcoming meetings` / `All tasks`.                                                                                                                                                                                                                                                                                                                                                                                                              | LANG-08                             | Lovable |   ☑    |
| `F-GOV-APPROVAL-COPY` | Approval-gate row copy must lead with consequence: `Approve · <what happens> · Reject · <what rolls back>`. Applies to inbox + decision queue + mission detail.                                                                                                                                                                                                                                                                                                                                                                                      | REC-08 (approval prompts) · LANG-09 | Lovable |   ☑    |
| `F-TODAY-AUTOSEED`    | Auto-generate the Today brief on first sign-in instead of asking the operator to seed it. Implemented via `ensureTodayBrief(supabase, userId)` helper in `src/lib/copilot.functions.ts`, called from `getDashboard`.                                                                                                                                                                                                                                                                                                                                 | REC-05                              | Lovable |   ☑    |
| `F-AGENTS-ROSTER-CUT` | Cut seeded agent roster to 5 (Discovery Scout · Strategist · PRD Writer · Builder · Orchestrator). `seed_default_agents` migration cut 9 → 4; Orchestrator seeded by its own fn. Extras disabled (not deleted) for existing users.                                                                                                                                                                                                                                                                                                                   | REC-04                              | Lovable |   ☑    |
| `F-NAV-ACCORDION`     | Sidebar groups behave as single-open accordion: clicking a group auto-collapses the others; the active route's group auto-opens; `localStorage` persists one id. Implemented in `src/components/cadence/AppShell.tsx` only. **Why:** addresses operator feedback that the left rail felt crowded; pairs with `F-IA-MERGE-OBSERVE` to clean up the AI Ops area without hiding features. **How to verify:** open `/agents` → "Agents" group is the only one expanded; click "Deliver" → "Agents" auto-collapses; refresh → last-opened group restored. | operator-fb · pairs with REC-12     | Lovable |   ☑    |

#### P1 — ship in the next 1–2 months (structural)

| F-ID                  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Source recs               |  Owner  |        Status        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | :-----: | :------------------: |
| `F-IA-MERGE-OBSERVE`  | Sidebar `AI Ops` → `Run` (Observe · Evals). `/analytics` + `/traces` + `/drift` merged into `/observe` with tabs (Analytics · Traces · Drift); Traces & Drift labels carry live count badges; `?tab=` drives state; old URLs `throw redirect()` to the matching tab; `/traces/$traceId` preserved. Govern group untouched (Guardrails · Governance · Budgets · Integrations). **How to use / verify:** sidebar → Run → Observe; default Analytics tab; switching tabs updates `?tab=`; visiting `/analytics`, `/traces`, or `/drift` redirects to the matching tab; ⌘K resolves "Observe"; Trace detail still opens at `/traces/<id>`. **Implementation:** new `src/routes/_authenticated.observe.tsx` + `src/components/observe/{Analytics,Traces,Drift}Panel.tsx`; old route files reduced to `beforeLoad: redirect(...)`; sidebar group `aiops` → `run` with 2 items in `src/components/cadence/AppShell.tsx`. | REC-12 · operator-fb      | Lovable |          ☑           |
| `F-IA-MERGE-GOVERN`   | Merge `/inbox` + `/guardrails` + `/budgets` → `/governance` with internal tabs (Controls · Approvals · Guardrails · Budgets); old URLs redirect to the matching tab; sidebar workspace "Approvals" deep-links to `?tab=approvals`; Govern group shrinks to Governance + Integrations. **How to use / verify:** open `/governance` → tab strip shows the 4 tabs with a one-line description below; visit `/inbox`, `/guardrails`, `/budgets` and confirm 301 to `/governance?tab=…`; sidebar Approvals (workspace rail) and Governance (Govern group) both light up correctly when their tab is active. Server enforcement is unchanged — all four panels reuse their existing server fns (`listApprovals`/`decideApproval`, `getGuardrailOverview`/etc., `getBudgetOverview`/etc., `getGovernanceOverview`/reactor fns), each gated by `requireSupabaseAuth`.                                                     | REC-13                    |   any   | ☑ shipped 2026-06-06 |
| `F-IA-CULL-CALDOCS`   | Delete `/calendar`, `/meetings`, `/docs`, `/sync` from operator nav (data preserved).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | REC-14                    |   any   |          ☐           |
| `F-IA-AGENTS-TABS`    | Fold `/prompts` and `/agents` into one **Agents** route with internal tabs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | REC-15                    |   any   |          ☐           |
| `F-IA-TODAY-BRIEFING` | Execute Today + Briefing merge per audit §5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | REC-11                    |   any   |          ☐           |
| `F-IA-RENAMES`        | Batch rename in sidebar + command palette + page headers (URLs unchanged, so no redirects needed): `Build Console`→`Builder` · `AI Chat`→`Chat` · `Swarm HUD`→`Swarm` · `Prompt Studio`→`Prompts` · `Sync Inbox`→`Connectors`. `AI Ops`→`Observe`, `AI Analytics`→`Analytics`, and `Eval Harness`→`Evals` already landed via `F-IA-MERGE-OBSERVE`. **How to use / verify:** open sidebar and confirm the new labels; open `/build`, `/swarm`, `/prompts`, `/sync`, `/chat` and confirm tab title + page H1 match; command palette (⌘K) shows "Chat" not "AI Chat".                                                                                                                                                                                                                                                                                                                                                | LANG-05                   |   any   | ☑ shipped 2026-06-06 |
| `F-CHAT-NL-INTENT`    | Natural Language Intent Detection & Inline Mission Progress on Chat. Intercepts user inputs, runs fast Gemini classification, seeds orchestrator, dispatches mission, and renders inline progress card & approvals panel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | REC-08 (chat-mission)     |   any   | ☑ shipped 2026-06-07 |
| `F-COCKPIT-MERGE`     | Merge `/swarm` + `/missions` → `/cockpit` (two views: Agents · Missions). Subsumes most of LANG-IA-12.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | REC-16 · LANG-IA-12       |   any   | ☑ shipped 2026-06-11 |
| `F-TODAY-LOOPPULSE`   | Replace Today hero (Focus Score / deep blocks) with Loop Pulse: `Overnight: 7 signals clustered → 2 themes promoted · 1 PRD ready for review · Builder PR #142 awaiting CI (green in 3m)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | REC-03 · REC-17           |   any   |          ☐           |
| `F-VOICE-EMPTY-ALL`   | Empty-state copy pass across all remaining routes (post-IA merges).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | REC-06                    |   any   |          ☐           |
| `F-GOV-COST-SURFACE`  | Surface unit economics on `/build` and `/governance`: `This mission cost $0.42 in tokens; budget $5.00`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | REC-20                    |   any   |          ☐           |
| `F-VOICE-TOOLTIPS`    | Apply audit §4.1 (delete restating tooltips, ~15 sites) + §4.2 (rewrite to consequence-first, ~8 sites, mostly `/agents`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | TOOLTIP-DEL · TOOLTIP-REW |   any   |          ☐           |
| `F-VOICE-GLOSSARY`    | Publish glossary; add a CI script that flags banned synonyms (`Trajectory`, `Run` for missions, `Specialist` in UI).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | LANG-04                   |   any   |          ☐           |

#### P2 — 3–6 months (platform / differentiator depth)

| F-ID                     | What                                                                                                                                                                                                     | Source recs                          | Owner | Status |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | :---: | :----: |
| `F-COCKPIT-MACHINE-MODE` | Header toggle: Human Mode (current dense surface) ↔ Machine Mode (full-screen dispatch board showing running agents, queue, attention, throughput; hides everything else). Depends on `F-COCKPIT-MERGE`. | REC-22 · REC-08 (mode toggle aspect) |  any  |   ☐    |
| `F-MCP-V1`               | Ship minimal Cadence MCP server (read signals/opportunities/PRDs · append decision · queue mission).                                                                                                     | REC-09                               |  any  |   ☐    |
| `F-AGENTS-MENTIONABLE`   | Agents as first-class users: `@discovery, please re-cluster the last 50 signals` from any PRD comment or Today card.                                                                                     | REC-10                               |  any  |   ☐    |
| `F-BUILDER-MULTIFILE`    | Lift Builder from single-file to scoped multi-file: pre-declared touch list, max N files, review per file.                                                                                               | REC-21                               |  any  |   ☐    |
| `F-VOICE-CHIP`           | Enforce AI-message chip spec via component prop types: `<AiCallChip model via score latency tokens cost />`.                                                                                             | LANG-CHIP                            |  any  |   ☐    |
| `F-MKT-COCKPIT-AB`       | A/B landing: "OS" vs. "cockpit" positioning. Marketing surface only.                                                                                                                                     | REC-19                               |  any  |   ☐    |

#### Phase B — Outcome surface (the big merged bet)

| F-ID                | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Source recs               | Owner |        Status        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | :---: | :------------------: |
| `F-OUTCOME-SURFACE` | Ship `/outcome` (Releases · Launches · Support · Learnings) and the 5 missing right-half loop surfaces (Release · Launch · Support · Learn · Outcome) in shadow form so operators _see_ the loop they're sold. Maps to Proof Platform v1.1 bundles 10–12 (Ship · Launch · Support→Learn). Empty surfaces are fine if the loop is named. **How to use / verify:** open the sidebar → **Outcome** group → `/outcome`. Four tabs: **Releases** (completed missions + completed agent runs with duration/tokens/cost), **Launches** (approvals on outbound tools `send_slack`/`send_email`/`publish_changelog`/`post_announcement`/`notify_channel` — pending rows link to `/inbox`), **Support** (signals with `source` in `support`/`ticket`/`helpdesk`/`email`/`zendesk`/`intercom`/`freshdesk`), **Learnings** (opportunities whose `updated_at` is >60s after `created_at` — proxy for re-scoring). Each tab is empty by design until upstream events arrive; empty state names the loop step + why it lights up. All reads go through `getOutcomeData` in `src/lib/outcome.functions.ts` (RLS-scoped via `requireSupabaseAuth`). No new agent logic; no chokepoint bypass. | REC-07 · LANG-NEW-OUTCOME |  any  | ☑ shipped 2026-06-06 |

#### Already shipped (close-out)

| F-ID              | What                                                                                                                                                                                                                                          | Source recs |        Status        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | :------------------: |
| `F-VOICE-DIALOGS` | `window.prompt()`/`window.confirm()` flows in `AppShell` (workspace + product creation/rename/delete) replaced with `useConfirm` / `usePrompt` dialogs + sentence-case labels; ESLint guardrail blocks `alert/confirm/prompt/onbeforeunload`. | LANG-07     | ☑ shipped 2026-06-06 |
| `F-VOICE-GUIDE`   | One-page voice guide published as [`./conventions/ui-voice.md`](../conventions/ui-voice.md); linked from `design.md`, `AGENTS.md` §3, `CLAUDE.md` + `GEMINI.md` read-order step 1.6.                                                           | LANG-10     | ☑ shipped 2026-06-06 |

#### Security follow-up (ignored finding, tracked)

| F-ID                 | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Source                                                   |          Status          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | :----------------------: |
| `F-SEC-REALTIME-RLS` | `realtime.messages` has no RLS — any authenticated user can subscribe to any channel topic. Operator picked "ignore for now, track as backlog F-ID". Fix requires (a) renaming every `supabase.channel()` call site to `workspace:<id>:…` / `user:<auth.uid()>:…` topic convention, then (b) RLS on `realtime.messages` enforcing topic regex against workspace membership. Higher risk than payoff today (no PII broadcast on realtime; row reads still RLS-protected). | supabase_lov scanner `realtime_messages_no_channel_auth` | ☐ (deferred by operator) |

#### Triage notes (apply when picking a row)

- **Most P0 rows are pure copy.** No schema change, no server-fn change, no migration. Estimate is hours-per-route, not days.
- **`F-IA-*` merges break URLs.** Always add redirects in the same commit; never ship a rename without `<Navigate>` from old route.
- **`F-AGENTS-ROSTER-CUT` is a data change**, not a code change — update seed data + the agent roster server fn, leave the spawn pipeline alone.
- **`F-OUTCOME-SURFACE` is Phase B** - claim it via the SSOT live cursor ([`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) section 0) before another tool does; bundles 10-12 collapse into this one F-ID.
- **Don't expand prose here.** Full bodies live in the two audit docs. This section is the addressable index.

---

---

## Build-order rollup (status × build sequence)

Sequence from [`../plan.md`](../../plan.md) §3. Status: ☐ not started · ◑ legacy partial (harden) · ☑ verified into `plan.md` §4. **Per-item code-verified grades + step-1 tickets: [`archive/foundation-audit.md`](./archive/foundation-audit.md) (2026-05-30).**

> **▶ This table is the canonical "what do I build next?" source.** To resolve the next actionable task deterministically (any tool, any human):
>
> 1. Take the **lowest-numbered step** that is still `◑` or `☐` (the `∥` cross-cutting row is pulled into step 1, not sequenced separately).
> 2. Expand its **Key IDs** to the feature entries above; pick the first whose own `[status]` is not `☑`.
> 3. Open its concrete ticket in [`archive/foundation-audit.md`](./archive/foundation-audit.md) (step 1) or its entry above (later steps), then build.
>
> The SSOT, [`SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) (section 0 + section 3), carries the live cursor and day-to-day build queue - it points here for the concrete F-ID scope behind the next step.

| Step | Scope                                                  | Key IDs                                       | Status |
| ---- | ------------------------------------------------------ | --------------------------------------------- | ------ |
| 1    | Foundation hardening + P0 non-functionals              | 0.1–0.12, A1–A5, B1–B2, P1–P2, P6, P8, O2, R1 | ◑      |
| 2    | First slice: Discover→Define→Plan                      | F1–F3, G1–G2, H1–H3, N1                       | ◑      |
| 3    | Orchestration layer (X1)                               | E1–E7, D1–D4, C1–C4, **C6**, E6 graph         | ◑      |
| 4    | Build→Test→Ship (autonomous)                           | I1–I3, J1–J2, K1–K2, 0.10, 0.12               | ☐      |
| 5    | Multi-product / multi-workspace                        | B3–B5, B4, E5                                 | ◑      |
| 6    | Launch/GTM/Price + Operate/Support                     | L1–L2, M1                                     | ☐      |
| 7    | Learn + Product Memory                                 | N2, O1, O3                                    | ◑      |
| 8    | Interop (MCP/A2A)                                      | Q1–Q2                                         | ☐      |
| ∥    | Cross-cutting (pull P0s into step 1, rest as relevant) | S, T, U, V, W, X                              | ☐      |

**P0 critical path (the must-haves for a credible first user):** 0.1, 0.2, 0.5, 0.6, 0.7, 0.8, 0.9, 0.10, A1, A2, B1, B2, F1, F2, F3, G1, P6, P8, W1.

---
