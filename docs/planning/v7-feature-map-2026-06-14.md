# v7 Feature Map: the catalog of what Circuit ships today (2026-06-14)

> **What this is.** The shipped-state catalog of Circuit (née Cadence): every feature we offer, organized by the six lifecycle stations (Sense, Decide, Define, Build, Ship, Learn) and by surface. Each entry carries a name, a one-line, the agent(s) and tool(s) behind it, a status (Built / Partial / Missing-Planned), and the surface or route it lives on. This is the *what we offer* register, not behavior detail and not schema. It is code-verified against `main` at commit `f515cfb`.
>
> **Read with.** Positioning and the honest state-of-product live in [`../strategy/v7-agentic-product-os-2026-06-14.md`](../strategy/v7-agentic-product-os-2026-06-14.md) (the canon). The full L0→L5 expansion superset (7 laws, 6 stations, the 19-agent mesh roadmap, handoff contract, HITL gates, milestones M1 to M5) lives in [`../strategy/v4-feature-map-2026-06-11.md`](../strategy/v4-feature-map-2026-06-11.md). Live gaps are tracked in [`known-issues.md`](./known-issues.md); sub-feature scope in [`feature-backlog.md`](./feature-backlog.md).
>
> **The honesty rule (claim-never-outruns-wiring).** Every item below is marked against code. The autonomy and memory engine is real (deterministic auto-advance, memory threading, outcome-to-memory recall, the unattended-execution audit, the Today decision card, the gauntlet metrics). The shipped roster is 4 specialist agents plus the orchestrator, with Critic as an inline LLM call. Where a feature is wired but not operational on real data, it is marked Partial with the blocking gate named.

---

## 0. How to read this catalog

Three statuses, applied per feature:

- **Built**: wired end to end and functional on real data.
- **Partial**: code is wired, but a named gate (migration sync, OAuth registration, a live bug) keeps it from running on real data, or only part of the feature is live.
- **Missing-Planned**: named in the v4 superset, not yet built. Cross-referenced in section 8.

Two reader types throughout: the **human** (operator at a surface) and the **agent** (a model calling a tool, or a peer agent receiving a handoff). Section 6 treats the agent-facing surface on its own.

---

## 1. Sense: read the world, surface what changed

The intake station. Signals arrive, get typed and clustered, and the Scout frames opportunities the Strategist can rank.

| Feature | One-line | Agent · tool | Status | Surface / route |
|---|---|---|---|---|
| Signal inbox | Customer signals land, get typed, and cluster into themes. | Scout (`discovery-scout`) · `discovery.functions.ts` | Built | `/product?tab=signals` |
| Signal ingest webhook | External systems POST signals with a bearer token (≤50 rows/call). | Reactor · `/api/public/ingest-signals` | Partial, endpoint gates on KI-09 (ingest-token migration unapplied) | server route |
| Ingest token management | Operator rotates, revokes, and reads the 64-char ingest token. | `ingest.functions.ts` | Partial, UI live, token fns error until KI-09 syncs | `/sync` |
| Auto-discovery pipeline | `signal.created` auto-dispatches the Scout to mine and frame. | Reactor + Scout · `reactor.functions.ts`, event subscriptions | Built (auto-mode) | engine (no surface) |
| Opportunity framing + ICE | Scout drafts opportunities, scored by impact/confidence/ease. | Scout (`discovery-scout`) · `discovery.functions.ts` | Built | `/product?tab=opportunities` |
| Inline Critic red-team | The call gets challenged before it is made; verdict stored on the row. | Critic (inline `runCritic`) · `discovery.functions.ts` (lines 25, 62, 90) | Built | annotation on signals/opps |
| Connector-sourced signals | Pull signals from connected accounts (GitHub, Notion, calendar, etc.). | `src/lib/connectors/` · `resolveProviderAuth` | Partial, OAuth-wired, not operational (KI-12, KI-01); Sense is webhook-only in practice | `/settings?section=accounts`, `/sync` |
| Meeting + transcript intake | Meetings and transcripts feed the company brain. | `knowledge` surface · `getBrainStatus` | Partial, per-user calendar OAuth blocked (KI-01); seeded demo data visible | `/knowledge?tab=calendar`, `/meetings/$id` |

---

## 2. Decide: bring the calls that need a human, clear them fast

The judgment station. Three call types surface on Today; the operator approves, redirects, or kills, and the cleared-ring fills.

| Feature | One-line | Agent · tool | Status | Surface / route |
|---|---|---|---|---|
| Needs-You decision queue | Three call types (approvals, PRD-review calls, Critic-challenged opps) in one round-trip. | Chief of Staff · `today.functions.ts` `getNeedsYou` | Built | `/` |
| Decision card | One card renders all three kinds with approve, redirect, defer. | `DecisionCard.tsx` · `governance.functions.ts` `resolveApproval` | Built | `/` |
| Calls-cleared ring | SVG ring fills as the operator clears the queue (session-local count). | Today surface · `clearedSession` state | Built | `/` |
| Cold-start onramp | First-run workspaces with zero signals/opps/PRDs see an onramp, not an empty queue. | Today surface · `getColdStart` | Built | `/` |
| Gate-response latency | Median raised→decided time (7-day window) shown on the queue. | `today.functions.ts` · `gateMedianMinutes` | Built | `/` |
| Capture-as-decision | Any hop output or call becomes a durable decision record. | Mission cockpit · `decisions` write | Built | `/missions/$missionId`, `/knowledge?tab=decisions` |
| Public decision page | A decision can be shared publicly (OG tags, anon read-only). The viral loop entry. | `/d/$slug` SSR loader | Built | `/d/$slug` (public) |
| Spend-today strip | Today shows the day's AI spend alongside the queue. | `today.functions.ts` · `spendTodayUsd` | Built | `/` |

---

## 3. Define: turn a decision into the artifact that follows

The specification station. The Scribe drafts a PRD from a ranked opportunity, the Critic reviews it, and it hands off to Build or a GitHub issue.

| Feature | One-line | Agent · tool | Status | Surface / route |
|---|---|---|---|---|
| PRD generation | Generate a spec from an opportunity in the Scribe's voice. | Scribe (`prd-writer`) · `discovery.functions.ts` `generatePrd` | Built | `/product?tab=specs` |
| PRD detail + edit | Full PRD view with inline edit and lineage to upstream evidence. | `prds/$id` route · `Outlet` | Built | `/prds/$id` |
| PRD Critic review | The spec is red-teamed; verdict stored on the PRD row. | Critic (inline `runCritic`) · `prds.critic_review` | Built | `/product?tab=specs` |
| PRD-review call | A PRD in `review` status surfaces as a Today call. | Today surface · `getNeedsYou` `prdCalls` | Built | `/` |
| Hand-off to Build | A PRD becomes a Build work order. | Scribe → Build · Build dispatcher | Built | `/build` |
| Hand-off to GitHub issue | A PRD becomes a GitHub issue (env-var fallback keeps this working pre-OAuth). | `github.issue_close` tool path | Partial, issue close works via env fallback; full App not registered (KI-12) | engine |
| Docs import + edit | Import GDocs/Notion docs into the company brain, edit inline. | `knowledge` surface | Partial, import gated on connector OAuth (KI-12) | `/knowledge?tab=docs`, `/docs` |

---

## 4. Build: stage real code, open a PR, read CI, gated merge

The most complete station. A work order runs the Build agent loop, stages multi-file changes, opens a PR, reads CI, and waits at a merge gate.

| Feature | One-line | Agent · tool | Status | Surface / route |
|---|---|---|---|---|
| Build dispatcher | Compose a work order, pick a PRD, pick a model, fire a session. | Scribe (`builder`) · `studio.functions.ts` `startStudioSession` | Built | `/build` |
| Build session detail | Pipeline journey strip plus Changes / PR·CI / Cost tabs, polled live. | `studio.functions.ts` `getStudioSession` | Partial, see PR/CI below | `/build/$missionId` |
| Changeset staging | Multi-file changes staged on an isolated branch (`staged → committed → pr_open → merged → abandoned`). | Build · `studio_changesets` (legacy ids retained) | Built | `/build/$missionId` (Changes) |
| PR creation | Open a pull request with `pr_url` and `pr_number` on the changeset. | Build · `studio.functions.ts` | Partial, GitHub App not registered (KI-12); PR creation non-operational on live | `/build/$missionId` (PR·CI) |
| CI snapshot | Read CI status onto the PR·CI tab. | Build · `refreshStudioCi` | Partial, manual refresh; can't verify until App secrets exist (KI-12) | `/build/$missionId` (PR·CI) |
| Gated merge | Operator approves the merge gate; Build closes the loop. | Build · approval gate | Partial, depends on PR creation (KI-12) | `/build/$missionId` |
| Mid-session steer | Redirect a running session with ⌘Enter. | Build · `steerStudioSession` | Built | `/build/$missionId` |
| Build cost ledger | Per-session token and dollar cost. | Build · Cost tab | Built | `/build/$missionId` (Cost) |
| Public prototype viewer | Assemble and serve a prototype publicly (HTML/CSS/JS inline, anon read-only). | `/p/$slug` SSR · `prototypes`, `prototype_files` | Built (KI-17 anon-leak fix committed, awaiting sync) | `/p/$slug` (public) |

---

## 5. Ship: get the release out (changelogs, posts, enablement)

The launch station. Launch tool calls are tracked as approvals; there is no dedicated shipping agent seeded yet, so the Build/Orchestrator agents wield the launch tools.

| Feature | One-line | Agent · tool | Status | Surface / route |
|---|---|---|---|---|
| Releases view | Completed build sessions roll up as releases. | `product` surface · Releases tab | Built | `/product?tab=releases` |
| Launch tool calls | Send Slack, send email, publish changelog, tracked as approvals. | `LAUNCH_TOOLS` · `outcome.functions.ts`, `agent_approvals` | Partial, tools defined and gated; no dedicated Ship agent seeded; sends depend on connector OAuth (KI-12) | `/product?tab=releases` |
| Dedicated Ship agent | A `release` / `marketer` specialist owns the launch station end to end. | mapped to Scribe face; slugs `release`, `releaser`, `marketer` | Missing-Planned, not seeded; relies on Build/Orchestrator | n/a (not seeded) |

---

## 6. Learn: check whether it worked, compound what did

The closed loop. Completed missions and closed opportunities distil into memory, re-score the ICE that produced them, and surface the delta on Today.

| Feature | One-line | Agent · tool | Status | Surface / route |
|---|---|---|---|---|
| Outcome capture | A finished mission or moved opportunity collects its outcome. | `outcome.functions.ts` `getOutcomeData` | Built | `/learn?tab=outcomes` |
| Outcome → memory | The outcome distils into an embedded memory row future runs recall. | `outcome-memory.ts` `buildOutcomeMemory`, `memory.server.ts` `rememberOutcome` | Built | engine (the moat) |
| ICE re-score | Memory re-scores the linked opportunity's ICE (`prior_ice → new_ice`). | `rememberOutcome` · re-score path | Built | `/` (Memory strip) |
| Memory strip | Today shows the latest re-score: the loop closing, visible. | Today surface · `listLearnings` | Built | `/` |
| Memory recall into hops | Each dispatched hop recalls semantic memory into the handoff payload. | `handoff.server.ts` · `memory_refs[]` | Built | engine |
| Workspace memory view | All workspace learnings, browsable. | `knowledge` surface · Memory tab | Built | `/knowledge?tab=memory` |
| Decisions register | Every decision, drillable, with lineage. | `knowledge` surface · Decisions tab | Built | `/knowledge?tab=decisions` |

---

## 7. The engine and the orchestration spine (behind the curtain)

These are not stations. They run beneath all six, and the operator sees them on demand at the engine-room surfaces.

| Feature | One-line | Agent · tool | Status | Surface / route |
|---|---|---|---|---|
| Orchestrated missions | A goal becomes a mission DAG, dispatched and finalized. | Chief of Staff (`orchestrator`) · `startOrchestratedMission` | Partial, single-agent missions run; multi-agent missions die on the slug bug (see section 9) | `/missions` |
| Mission cockpit | Hop timeline, MissionGraph DAG, per-hop input/output/handoff, tool-consequence labels. | `missions.functions.ts` · `MissionDetailPage` | Built | `/missions/$missionId` |
| Deterministic auto-advance | The loop advances multi-wave missions unattended, every minute, model-free. | `mission-advance.server.ts` `advanceMissionCore` · `resume-runs` cron | Built | engine |
| Operator push-now | A manual lever to advance a mission immediately. | `advanceMission` | Built | `/missions/$missionId` |
| Bounded retry | Halted missions retry within a bound; failed ones show a Retry button. | loop · `startOrchestratedMission` | Built | `/missions/$missionId` |
| Adaptive step budget | Per-mission step budgets adapt to the work. | loop server | Built | engine |
| Reactor fan-out | Events (`signal.created`, etc.) dispatch subscribed agents by approval mode. | `reactor.functions.ts` · `/api/public/hooks/event-reactor-tick` | Built (auto-mode); confirm-mode queues for human | engine |
| Trust arc + approval modes | Agents move `observing → proving → trusted → ambient`; the arc sets the safety floor. | `trust.server.ts`, `trust.functions.ts` | Partial, works, but defaults to `observing` (gate everything); see section 9 | `/govern` |
| Approvals queue | Every tool-call gate, queued for human decision. | `governance.functions.ts` · `agent_approvals` | Built | `/govern?tab=approvals` |
| Kill switch + caps | Stop everything; cap concurrent missions; clear stuck approvals. | Govern · Controls tab | Built | `/govern?tab=controls` |
| Guardrails | Block / warn / redact rules on agent actions. | Govern · Guardrails tab | Built | `/govern?tab=guardrails` |
| Budgets | Spend caps with budget-aware degradation. | Govern · Budgets tab | Built | `/govern?tab=budgets` |
| Prompts | System-prompt versioning plus A/B. | Govern · Prompts tab | Built | `/govern?tab=prompts` |
| Evals | Regression test suites against agent output. | Govern · Evals tab | Partial, eval-score scale fix (KI-14) committed, awaiting sync | `/govern?tab=evals` |
| Analytics | Spend, tokens, latency over time. | Govern · Analytics tab | Built | `/govern?tab=analytics` |
| Traces | Step-by-step replay of any run. | Govern · Traces tab · `/traces/$traceId` | Built | `/govern?tab=traces`, `/traces/$traceId` |
| Drift | Quality shift versus baseline, open-incident badge. | Govern · Drift tab | Built | `/govern?tab=drift` |
| Gauntlet metrics | Three proof metrics (acceptance, ritual retention, autonomy ratio) on real tables. | `gauntlet.functions.ts`, `gauntlet-metrics.ts` | Built | `/govern?tab=gauntlet` |
| Unattended-execution audit | Every auto-mode side-effecting tool call is recorded and labelled. | `tool_calls` · `getAutonomyRatio` | Built | `/missions/$missionId`, gauntlet |
| Brain (chat) | SSE chat with web-grounded RAG, model switch, brain actions, inline cockpit. | `chat.ts`, research-mode decomposition | Built | `/chat` |
| BYO key routing | Bring your own AI keys; calls route through the runtime chokepoint. | `byokeys.functions` · `runtime.server.ts` | Built | `/settings?section=models` |
| Workspace sync + bindings | Workspace resource bindings and pull/push conflict resolution. | `sync.tsx` · `WorkspaceBindingsSection`, `listSyncMappings` | Partial, bindings inert until KI-12 sync | `/sync` |
| Onboarding | First-run flow, full-viewport, gates on `profiles.onboarded`. | `OnboardingFlow` | Built | `/onboarding` |

---

## 8. Two users: human surfaces and the agent-facing handoff

Circuit serves two readers. Most of this catalog is the human's surface. A growing slice is for *agents* talking to agents.

### 8.1 Human surfaces (the seven-surface IA)

The live IA collapses to seven destinations. Every legacy route redirects into one of these.

| Surface | Route | Role | Station(s) |
|---|---|---|---|
| Today | `/` | Daily driver: the calls that need you. | Decide |
| Loop | `/product` | Sense → Define → Ship: signals, opportunities, specs, releases. | Sense, Define, Ship |
| Missions | `/missions`, `/missions/$missionId` | Build / orchestration: the swarm and the cockpit. | Build, engine |
| Build | `/build`, `/build/$missionId` | The green path: code, PR, CI, merge. | Build |
| Knowledge | `/knowledge` | Learn: calendar, memory, decisions, docs. | Learn, Sense |
| Govern | `/govern` | Engine room: controls, approvals, guardrails, budgets, prompts, evals, analytics, gauntlet, traces, drift. | engine |
| Settings | `/settings` | Workspace, profile, brief, voice, models, connected accounts. | engine |

Plus `/chat` (Brain), `/sync` (workspace bindings), and two public surfaces: `/p/$slug` (prototype viewer) and `/d/$slug` (decision page, the viral loop).

### 8.2 The agent-facing surface

| Surface | What it is | Status | Where |
|---|---|---|---|
| A2A handoff (today) | Agents pass a typed `HandoffPayload` with `memory_refs[]` from one hop to the next; the receiver renders the recalled memory. | Built | `handoff.server.ts` (internal, in-process) |
| Tool registry | Agentic tools agents can call, with per-tool approval modes (`auto` / `confirm` / `review`). | Built | `tools/registry.server.ts` |
| Ingest webhook | External systems push signals in with a bearer token. | Partial (KI-09) | `/api/public/ingest-signals` |
| Event reactor hook | A cron-driven endpoint that fans events out to subscribed agents. | Built | `/api/public/hooks/event-reactor-tick` |
| MCP server (planned) | Expose Circuit's tools to external agents over MCP. | Missing-Planned | n/a |
| Public agent API (planned) | A stable external API for agent-to-agent and programmatic use. | Missing-Planned | n/a |

Today, A2A is in-process: agents hand off to each other inside a mission, not across an org boundary. The MCP server and public API are the planned external face. Until then, the only external ingress is the ingest webhook and the reactor hook.

---

## 9. The five agent faces

Five user-facing faces in the vocabulary (`agent-vocabulary.ts`). Four map to routable seeded agents. **Critic is inline, not routable**, it is an `runCritic` LLM call in `discovery.functions.ts`, not a seeded `agents` row, and it has no slug that dispatches.

| Face | Verb | Blurb | Routable? | Seeded slug(s) it maps to |
|---|---|---|---|---|
| Scout | senses | Reads your sources and surfaces what changed. | Yes | `discovery-scout` |
| Strategist | ranks | Scores and re-ranks opportunities by impact. | Yes | `strategist` |
| Critic | challenges | Red-teams the call before you make it. | **No, inline `runCritic`** | none (display label only) |
| Scribe | drafts | Turns a decision into the artifact that follows. | Yes | `prd-writer`, `builder` |
| Chief of Staff | orchestrates | Runs the loop and brings you the calls that need you. | Yes | `orchestrator` |

Shipped roster: **4 specialist agents (`discovery-scout`, `strategist`, `prd-writer`, `builder`) plus the `orchestrator` spine.** The Ship-station faces (`release`, `releaser`, `marketer`) and the broader mesh are roadmap, not seeded.

---

## 10. Cross-reference: the v4 expansion superset, and what v7 commits to first

The full ambition is the [`v4 feature map`](../strategy/v4-feature-map-2026-06-11.md): 7 laws, 6 stations over a 12-stage engine, a **19-agent mesh** (17 specialists + 2 spine), the A2A handoff contract, the HITL gate matrix, and milestones M1 to M5. v7 is the honest subset of that superset that exists in code, plus the short list it commits to *first*.

**What the v4 superset names that v7 has not built (Missing-Planned):**

- The full 19-agent mesh. v7 ships 5 (4 specialists + orchestrator); Critic is inline.
- Dedicated Ship-station agent (`release` / `marketer`). v7 routes launch tools through Build/Orchestrator.
- Sub-agent spawning (ephemeral specialists per the v4 §2.1 roster).
- External agent slots over MCP / A2A across an org boundary, and the public agent API.
- The deeper LAUNCH and LEARN stations that depend on real connector inputs.

**What v7 commits to first (the closing of the last mile, per the canon §2 and §12):**

1. **Fix the orchestrator slug bug** (section 9 below). It gates every multi-agent mission. Cheap, pre-everything.
2. **Sync the pending migrations** (KI-13 signup, memory-recall scope, ritual sessions, eval score, decision share). Owned apply-and-verify, not a passive wait.
3. **Register connector OAuth** so Sense stops being webhook-only.
4. **Reframe the default arc toward ambient** so the felt product matches the claim (mostly defaults plus UX, not new architecture).
5. **Complete the loop on real data before breadth**, depth over the 19-mesh.

Breadth (the rest of the mesh, MCP/public API, dedicated Ship agent) comes after the loop runs on real data, per the founder ruling baked into the canon.

---

## 11. Live gaps (consolidated)

The named blockers that keep wired features from running on real data. Full register in [`known-issues.md`](./known-issues.md).

| ID | Gap | Impact | Status |
|---|---|---|---|
| Orchestrator slug bug | The `orchestrator` system prompt names slugs (`discovery`, `growth`, `analyst`) that aren't seeded; real slugs are `discovery-scout`, `strategist`, `prd-writer`, `builder`. `mission.plan` validates against the live roster (`orchestrator.server.ts:177`) and throws. | Live mission-killer: any multi-agent orchestrated mission dies at planning. | Open, unresolved in code |
| KI-13 | `handle_new_user` trigger threw on live; fix adds `BEGIN..EXCEPTION` subtransactions per seed step. | No new real account could be created. | Fix committed (`20260614140000`), awaiting sync |
| KI-12 | Connector OAuth fully built in code, but provider client-ID secrets unset and the GitHub App is not registered. | Connections and workspace bindings inert; Sense is webhook-only; PR creation non-operational. Env fallback keeps existing GitHub issue calls working. | Open: founder must register OAuth apps + add 6 secrets |
| Observing-by-default | `agent_autonomy` defaults to absent → `computeAllAgentTrust` falls back to `observing` (`trust.server.ts:194`). In `observing`, `resolveApprovalMode` promotes every tool, including `auto`-mode, to `review`. | Unattended execution is structurally blocked for new users; autonomy ratio (Gauntlet C) stays near zero until the operator advances the arc. | By-design safety floor; gap for the "loop runs itself" felt claim |
| KI-01 | Google/Microsoft calendar OAuth client IDs unset. | Calendar uses seeded demo data; no live per-user calendar. | Open |
| KI-09 | Ingest-token migration unapplied on live. | Webhook endpoint 401s until synced. | Migration committed, awaiting sync |
| KI-10 | Ingest endpoint has no rate limit. | A leaked token is uncapped cost exposure. | Open |
| KI-14 | Eval score scale (0 to 100 normalization). | Trust score's eval term skews until re-seed; fix lands with sync. | Fix committed (`20260614160000`), awaiting sync |
| KI-15 | Zero-step mission stuck `running`. | An unconsumed handoff message blocks `maybeCompleteMission`. | Open |
| KI-17 | `/p/$slug` anon column leak. | Anon could read unsafe prototype columns. | Security fix committed (`20260614180000`), awaiting sync |

The pattern: the engine is real in code; most live gaps are a migration sync away or a founder OAuth registration away. The two that need code changes are the orchestrator slug bug and the observing-by-default reframe.

---

## 12. Glossary: the ubiquitous language

The nouns this product uses. Use these, not stock SaaS terms.

- **Agents**: the five faces (Scout, Strategist, Critic, Scribe, Chief of Staff) that *execute* work, not assist with forms. Four are seeded and routable; Critic is an inline LLM call.
- **Missions**: a goal turned into a DAG of hops, dispatched by the Chief of Staff and run by specialists. Lives at `/missions`; the cockpit is `/missions/$missionId`.
- **Hops**: the individual steps of a mission. Each hop has a thought, a tool call, and a handoff to the next hop carrying recalled memory.
- **The loop**: sense → decide → define → build → ship → learn, run continuously, with the human appearing only at the calls that matter. It advances itself via the auto-advance cron.
- **Decision cards**: the Needs-You queue on Today. Three call types (approvals, PRD-review calls, Critic-challenged opportunities) in one card, each with approve / redirect / defer.
- **The arc**: an agent's trust state: `observing → proving → trusted → ambient`. The arc sets the approval-mode safety floor: observing gates everything; ambient runs everything except forced-review tools (for example `studio.pr.merge`, always gated).
- **The stations**: the six lifecycle stages: Sense, Decide, Define, Build, Ship, Learn. Each has named agents that run it.
- **The gauntlet**: the three proof metrics computed on real tables: acceptance rate, ritual retention, autonomy ratio. Lives at `/govern?tab=gauntlet`.
- **The unattended-execution audit**: the record of every auto-mode side-effecting tool call, labelled and counted into the autonomy ratio. The proof the loop carries real work.

---

## Related

- [`../strategy/v7-agentic-product-os-2026-06-14.md`](../strategy/v7-agentic-product-os-2026-06-14.md), the current positioning and honest state-of-product canon.
- [`../strategy/v4-feature-map-2026-06-11.md`](../strategy/v4-feature-map-2026-06-11.md), the L0→L5 expansion superset (7 laws, 19-agent mesh, HITL gates, M1 to M5).
- [`known-issues.md`](./known-issues.md), the live-gaps register, by KI id.
- [`feature-backlog.md`](./feature-backlog.md), ticket-level sub-feature scope.
- [`../strategy/session-decisions.md`](../strategy/session-decisions.md), the 2026-06-14 course-corrections and the slug-bug decision.
