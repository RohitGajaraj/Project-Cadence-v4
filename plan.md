# plan.md — Feature scope & build log

> The canonical record of **what Cadence is built to be** (the full feature scope), **the order we build it**, and **what already exists to reuse**. Product framing: [`README.md`](./README.md). Operating rules: [`AGENTS.md`](./AGENTS.md). Architecture: [`architecture/`](./architecture/). UI contract: [`design.md`](./design.md).
>
> **No MVP1/MVP2/MVP3 gating, no far-future phase deferral.** We build the full intended scope on the current stack ([`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md)) and ship continuously. This doc is written to be read straight into a coding session (Claude Code / Lovable) and acted on.

---

## How this file is organized

1. **Feature scope** — the whole product, stress-tested as if nothing is built. The high-level feature list.
2. **Competitive feature comparison** — factory.ai · hyperagent · Linear → what Cadence should build.
3. **Granular feature catalog** — every feature from login/logout to agent-transfer/workspace level, with *what* and *why*. This is the dev-ready map.
4. **Build order** — the sequence to build it, production-grade, reusing legacy code where it fits.
5. **Active build log** — what we actually ship, updated as we go (starts near-empty).
6. **Legacy build log (retained)** — the previous source build, kept as a reuse reference, not the plan.
7. **Product-agent roster** — re-examined (explicit vs. implicit).
8. **Testing, lessons, out-of-scope.**

---

## 1. Feature scope (stress-tested from scratch)

Cadence runs the full product lifecycle as one governed, autonomous loop. The scope below is the target product — not a discovery tool. Each stage is run by autonomous agents; the human approves at the gates.

### Who we serve, what they expect, and the gap (grounding for the feature list)

The feature list below is a deliberate response to who the customer is and what the market already sets as table-stakes — not a wish list. Inspiration drawn from products worth learning from is captured in [`docs/references/competitive-reference.md`](./docs/references/competitive-reference.md) (deferred; inspiration only).

**Personas (who orchestrates Cadence):**
- **P1 — Founder-as-product-org** (pre-seed/seed, AI-native SaaS): owns everything — discovery, specs, build, ship, GTM, pricing, support. Pain: tool sprawl + being the glue across the whole arc alone.
- **P2 — Solo / lead PM** at a 30-300-person AI-native SaaS: owns discovery→roadmap and increasingly build/ship/metrics, no team to hand off to. Pain: mechanical spec/ticket/update work + shallow discovery.
- **P3 — Technical founder / indie hacker**: can build, wants agents to run discovery→launch→support so they can stay in the code or step out of it. Pain: everything that isn't coding.
- **P4 (expansion, validate) — eng/sales/support/CEO** sharing one queryable lifecycle. Pain: no single place that explains *why* the product is what it is.

**Market expectations (table-stakes — must-haves, or we're not credible):** auth + SSO-ready tenancy; real (not mocked) data; connectors to the tools they live in; an assistant/chat surface; observability + cost visibility; approvals/audit for anything autonomous; multi-project support; export/no-lock-in.

**The gap (where the market is underserved — our opening):** point tools own single bands (engineering autonomy, or issue tracking, or research synthesis). **No one runs the *whole* lifecycle — discover → build → ship → launch → support → learn — as one governed, autonomous, multi-product loop.** That gap is the spine of the feature catalog in section 2.

**What the customer actually wants (the job):** "Take this intent and run it end-to-end — autonomously, in parallel, across my products — and only stop me for the calls that matter." Every feature below maps to that job.

**The feature list derives from the PM's actual day.** The product manager is the highest-precedence role — the features below exist to run the PM's day (triage inbox → decide → synthesize → spec → tickets → build/test/ship → launch/update → answer "why is this on the roadmap?" → report → repeat). The day-to-features mapping and the PM/eng-lead lenses are in [`docs/considerations.md`](./docs/considerations.md) (Product-lead lens). If a feature does not serve a real PM task, question it.

### Lifecycle stages (the core loop)

**S1 — Discover**
- Multi-source signal ingest: support tickets, churn, usage telemetry, sales notes, reviews, NPS, interviews (paste/CSV now; connectors next).
- Agent clustering → themes → ICE-scored opportunities; continuous (not one-shot) synthesis; dedupe by similarity.
- A continuously-updated discovery feed per product. *(This is the first end-to-end slice — see Build order.)*

**S2 — Define**
- Opportunity → PRD/spec, retrieval-grounded and cited; inline `/ai` editing; versioned with diff.
- Acceptance criteria, non-goals, risks, success metrics auto-drafted; human edits and approves.

**S3 — Plan**
- Spec → dependency-aware task graph with estimates, owners, risk flags.
- Outcome-oriented roadmap (Now/Next/Later); each item declares the outcome it pursues and how it's measured.
- Scheduling: agent proposes work blocks within working hours.

**S4 — Build (autonomous)**
- In-product multi-file coding (Studio): agents scaffold and write code across files, in parallel sessions.
- **"Watch the agents build"** — a live surface showing each agent/session: current step, files touched, tool calls, cost, status — pause/steer/approve mid-run.
- Per-hunk diff review; atomic commits; branch/worktree isolation per mission.

**S5 — Test (autonomous)**
- Agents generate and run unit/integration/E2E tests and evals; QA pass; results gate progression.
- Self-correct loop: failing tests feed back to the build agent until green or escalated.

**S6 — Ship**
- Agents open PRs, run the deploy checklist, deploy, and draft release notes — behind approval gates.
- Rollback triggers documented per release.

**S7 — Launch / GTM / Price**
- Agents draft launch assets, positioning, messaging, pricing pages, customer-facing pages, distribution plans, and announcement copy — human approves before anything goes external.

**S8 — Operate / Support**
- Agents triage incoming tickets, draft answers, route, and escalate; support themes flow back into Discover (closing the loop).

**S9 — Learn**
- Outcomes write decisions with `supersedes` lineage; re-score opportunities; update Product Memory; surface an insight memo into the daily brief.

### Cross-cutting platform (mandatory, spans all stages)

**X1 — Orchestration & automation engine**
- Workflow definitions across stages; event/schedule/webhook triggers; an automation builder.
- **Many sub-agents running in parallel** within a mission; **many agent sessions running in parallel** across missions.
- A live orchestration view (the mission/agent graph) with per-node status, cost, and approval state.
- Planner/executor loop with max-step/max-cost caps, replay-and-branch, cancellation, checkpoints.

**X2 — Multi-product & multi-workspace**
- **Multiple products in flight — Product A/B/C — grouped under Workspaces (A/B/C).**
- Per-product/workspace isolation of data, agents, memory, budgets, and access (RLS by `user_id` + `workspace_id`; see [`architecture/data.md`](./architecture/data.md)).
- Product switcher; cross-product portfolio view.

**X3 — Trust & governance (the AI trust stack)**
- Per-call telemetry, LLM-as-judge scoring, guardrails (input + output), RAG with citations, prompt versioning + A/B, eval harness with regression gate, drift watch, budgets, live trace waterfall, incidents log, approval gates everywhere.

**X4 — Product Memory**
- Queryable graph of signals → themes → opportunities → decisions → experiments → outcomes, with `supersedes` lineage; the institutional context agents reason over; exportable as skill packs.

**X5 — Interop (agent-native)**
- MCP server (Cadence as a tool surface) + MCP client (consume external tools) + A2A (Agent Cards, delegate-to-agent, peer registry). Capability scopes, rate limits, prompt-injection guard on external results, audit log.

**X6 — Identity, auth, billing**
- Auth (email + OAuth), session management, per-workspace membership (future: roles/teams), BYO model keys (encrypted), usage/billing metering against budgets. See [`architecture/security.md`](./architecture/security.md).

---

## 2. Granular feature catalog (login to agent-transfer, with what + why)

> **Sub-feature-level expansion:** [`docs/feature-backlog.md`](./docs/feature-backlog.md) takes every area below down to addressable sub-features with stable IDs, states, acceptance signals, dependencies, and a status × build-order rollup. This section stays the narrative catalog; the backlog is the flat, ticket-ready list. Keep both true.

Every feature, grouped by area. Format: **Feature — what it is — *why we need it*.** This is the build checklist; each becomes an issue/spec. Status tags: `[reuse]` legacy survives, `[extend]` legacy base + new work, `[new]` build from scratch.

> **Inspiration, not comparison.** This catalog absorbs the best ideas from products worth learning from — factory.ai's autonomous build/ship + live "mission" view (we extend it past code into launch/support), hyperagent's team-of-agents with per-agent budgets and self-improving memory, and Linear's agents-as-first-class-users + saved-workflow skills + event automations. We take the inspiration and build it into *our* features below; we are not maintaining a competitor scorecard.

### A. Identity & access
- **Sign up / onboarding** — email+password + Google OAuth; create first workspace + product; set display name, timezone, working hours. — *Entry point; personalization and scheduling depend on it.* `[reuse]`
- **Login / logout** — authenticated session, sign-out everywhere, session refresh, `Last-Event-ID` resume for streams. — *Baseline security and reliable streaming.* `[reuse]`
- **Password reset / email verification** — standard flows; verification on by default. — *Account safety.* `[reuse]`
- **Profile & preferences** — display name, role, timezone, working hours, default model per surface. — *Drives greeting, scheduling, model routing.* `[reuse]`
- **BYO model keys** — add/test/rotate/delete provider keys, encrypted; masked display. — *Model-agnostic; cost control; enterprise trust.* `[reuse]`
- **Roles & membership (future)** — invite, per-workspace roles, SSO/SAML. — *Team and enterprise readiness.* `[new]`

### B. Workspaces & products
- **Create / switch workspace** — top-level tenancy boundary. — *Isolates a client/company/initiative.* `[extend]`
- **Create product under workspace** — Product A/B/C inside a workspace; vision/problem/target-users/metrics/stage. — *Run several products in parallel without bleed.* `[extend]`
- **Product switcher + portfolio view** — fast switch; cross-product overview. — *One operator, many products.* `[new]`
- **Per-product isolation** — data, agents, memory, budgets scoped by `user_id`+`workspace_id`+product. — *Security + correctness across products.* `[extend]`
- **Archive / delete product** — lifecycle hygiene. — *Avoid clutter; data governance.* `[new]`

### C. Agents — configuration
- **Agent roster** — list durable agents + spawned sub-agents per product. — *See the team you command.* `[extend]`
- **Create / clone / configure agent** — system prompt, tool allow-list, model, temperature/top_p/seed, max tokens, schedule, approval mode, memory toggle. — *Tailor behavior + governance per role.* `[reuse]`
- **Enable / disable / schedule agent** — cron schedules with next-run preview. — *Autonomy on a clock.* `[reuse]`
- **Agent detail + run history** — last runs (status/duration/score/cost), memory inspector. — *Trust through observability.* `[reuse]`

### D. Agent execution
- **Run on-demand / scheduled** — manual trigger or cron fan-out. — *Both reactive and proactive autonomy.* `[reuse]`
- **Planner/executor loop** — plan → tool calls → observe → reflect → answer; max-step/max-cost caps. — *Reliable multi-step autonomy.* `[reuse]`
- **Approval gates + Decision Queue** — `auto|confirm|review`; queue of runs awaiting review; one-click resume from checkpoint. — *Governed autonomy; the trust core.* `[reuse]`
- **Cancellation / replay-and-branch / checkpoints** — stop mid-run (save partial), re-run against different model/prompt, resume. — *Control + iteration.* `[reuse]`

### E. Agent communication, coordination & transfer (mandatory)
- **Sub-agent spawning** — Orchestrator spawns ephemeral specialists per task. — *Scale to the work without fixed seats.* `[new]`
- **Agent-to-agent messaging** — structured internal A2A messages between agents in a mission. — *Coordination without a human relaying context.* `[new]`
- **Agent transfer / handoff** — pass a mission + its context, memory, and artifacts from one agent to another (e.g. Planner → Engineer → QA → Release). — *Work flows across the lifecycle with zero context loss; this is the spine of the autonomous loop.* `[new]`
- **Parallel sub-agents** — many specialists working a single mission concurrently. — *Speed; mirrors a real team.* `[new]`
- **Parallel agent sessions** — many missions running at once across products. — *One operator, many things in flight.* `[new]`
- **Orchestration / mission graph view** — live DAG of agents/sessions with per-node status, cost, approval state; pause/steer. — *See and command the swarm.* `[new]`
- **Shared vs. private memory** — mission-shared context + per-agent long-term memory with importance decay. — *Coordination without leakage.* `[extend]`

### F. Discover
- **Signal ingest** — paste/CSV now; connectors (Intercom/Zendesk/reviews/sales) next; sentiment on insert. — *Raw material of discovery.* `[extend]`
- **Clustering → themes → opportunities** — embed + cluster + synthesize with evidence ids; ICE scoring; dedupe by similarity. — *Turn noise into ranked opportunities.* `[reuse]`
- **Continuous discovery feed** — always-fresh per-product feed. — *The lead use case; ongoing, not one-shot.* `[extend]`

### G. Define
- **PRD/spec generation** — opportunity → structured cited draft. — *Specs downstream of evidence, not vibes.* `[reuse]`
- **Doc editor + `/ai` + versions/diff** — Tiptap, inline AI commands, autosave, version diff, citation pills. — *Author + iterate with provenance.* `[reuse]`

### H. Plan
- **Task graph** — spec → dependency-aware tasks with estimates/owners/risk. — *Executable plan agents can run.* `[reuse]`
- **Outcome roadmap** — Now/Next/Later; each item declares its outcome + measure. — *Anti-feature-factory; ties work to results.* `[extend]`
- **Scheduling** — agent proposes work blocks in working hours. — *Time-aware execution.* `[reuse]`

### I. Build (autonomous)
- **Studio multi-file coding** — agents write across files; per-hunk diff accept/reject; atomic revisions. — *Agents build, not just suggest.* `[extend]`
- **Watch-the-agents-build surface** — live per-session view: step, files, tool calls, cost, status; pause/steer/approve. — *Trust + control over autonomous code.* `[new]`
- **Branch/worktree isolation per mission** — each mission on its own branch. — *Parallel safe building.* `[new]`

### J. Test (autonomous)
- **Test generation + run** — agents author and run unit/integration/E2E + evals. — *Quality without a human writing every test.* `[new]`
- **QA gate + self-correct loop** — failing tests feed back to the build agent until green or escalate. — *Closed-loop quality before ship.* `[new]`

### K. Ship
- **PR / deploy / release notes** — open PRs, run deploy checklist, deploy, draft notes — behind approval. — *Autonomous delivery, governed.* `[new]`
- **Rollback triggers** — documented per release. — *Safe shipping.* `[new]`

### L. Launch / GTM / price
- **Launch + positioning + pricing + distribution drafts** — agent-drafted, human-approved before external. — *The lifecycle past code, that point tools skip.* `[new]`
- **Customer-facing pages / announcements** — generated, approved. — *Close the go-to-market gap.* `[new]`

### M. Operate / support
- **Ticket triage + draft answers + route/escalate** — agents handle inbound; themes flow back to Discover. — *Support closes the loop into discovery.* `[new]`

### N. Learn
- **Decisions + `supersedes`** — outcomes write decisions with lineage. — *Auditable "why," and belief updates.* `[reuse]`
- **Re-score + insight memo + daily brief** — outcomes re-rank opportunities; memo surfaces in the brief. — *The loop compounds.* `[extend]`

### O. Product Memory
- **Knowledge graph + query** — signals→decisions→outcomes, typed nodes/edges. — *Institutional context agents reason over.* `[new]`
- **Currency / drift on facts + skill packs** — flag stale facts; export versioned skill bundles over MCP. — *Memory stays true; reusable expertise.* `[new]`

### P. Trust & observability
- **Telemetry + traces + judge scores** — per-call events, trace waterfall, LLM-as-judge. — *Measure every AI action.* `[reuse]`
- **Guardrails + prompt studio + eval harness + drift + budgets + incidents** — input/output guards, versioned prompts + A/B, regression-gated evals, drift watch, budget caps, incident log. — *Make autonomy safe, improvable, affordable.* `[reuse]`
- **AI message contract** — score/model/latency/tokens/cost/citations/feedback/trace/replay on every AI message. — *Trust is the UI.* `[reuse]`

### Q. Interop (agent-native)
- **MCP server + client** — expose Cadence as tools; consume external tools. — *Be the place agents plug in.* `[new]`
- **A2A server/client + Agent Cards + scopes/limits/audit** — peer agents, delegate-to-agent, governed. — *Cross-vendor agent ecosystem.* `[new]`

### R. Platform & ops
- **Command palette (⌘K) + global search** — resolve every destination/action/artifact. — *Keyboard-first speed.* `[reuse]`
- **Connectors / integrations** — Docs, Notion, Linear, Calendar, GitHub, Slack, CRM. — *Act on the systems the operator lives in.* `[extend]`
- **Notifications + budgets config + settings** — approvals, breaches, guardrail rules, integration health. — *Operate the platform.* `[extend]`

---

## 3. Build order (production-grade, reuse where it fits)

Not milestones, not months — a build sequence. Build each slice production-grade and shippable, reusing legacy code (section 5) where it survives the stress-test. Make the first end-to-end slice rock-solid before widening.

1. **Foundation hardening** — auth + tenancy (`user_id` + `workspace_id` + `product_id` everywhere), the AI chokepoint, the trust-stack tables, design tokens. Reuse most of legacy here. **Build these P0 non-functionals into the foundation now** (full detail + priorities in [`docs/considerations.md`](./docs/considerations.md)): agent **blast-radius limits + per-mission spend caps + global kill-switch**; **prompt-injection defense** on all ingested/external input; **provider/model fallback** + graceful degradation; **durable runtime** for long/parallel missions ([`architecture/orchestration.md`](./architecture/orchestration.md)); **sandboxed execution** + review gate for agent-written code; app-level monitoring + backups/DR. These are architecture, not afterthoughts.
2. **First end-to-end slice: Discover → Define → Plan** (the *lead use case* — Continuous Discovery → cited spec → task graph). Make it bulletproof; it proves the loop and the governance model.
3. **Orchestration layer (X1)** — the parallel sub-agent / parallel session engine + live orchestration view. This unlocks everything autonomous; build it early, not late.
4. **Build → Test → Ship (S4-S6, autonomous)** — Studio coding agents, autonomous test/QA, PR/deploy/release behind approval, with the "watch the agents build" surface. This is the differentiator; do not defer it.
5. **Multi-product / multi-workspace (X2)** — once one product works end-to-end, generalize to A/B/C under workspaces.
6. **Launch / GTM / Price + Operate/Support (S7-S8)** — agent-drafted go-to-market and support, closing the loop.
7. **Learn (S9) + Product Memory (X4)** — make the loop compound.
8. **Interop (X5)** — MCP/A2A so Cadence is the place other agents plug in.

Sequencing rule: the architecture (auth, chokepoint, orchestration, RLS, governance) is built right from step 1 so later stages are *additions, not rewrites*. See [`docs/decisions/tech-stack.md`](./docs/decisions/tech-stack.md).

---

## 4. Active build log (update as we ship)

> Append one line per shipped, real change as development proceeds in Claude Code / Lovable. Keep it true. Dedupe against the legacy log (section 5) — when a legacy capability is rebuilt or confirmed-reused, move its entry here and mark the legacy entry superseded.

- **2026-06-04 — Bundle 2 Strategic Briefing (C5) + `prd.link_issue` shipped.** New `workspace_briefs` table (one row per workspace; mission / target user / current focus / anti-goals / notes; workspace-member read, owner write; RLS + GRANTs). New server module `src/lib/briefs.functions.ts` with `getActiveBrief` + `upsertBrief` and a pure helper `renderBriefBlock()` that emits a labelled, fenced text block (skipped entirely when every field is empty so we never inject noise). Agent loop (`src/lib/ai/loop.server.ts`) now reads the brief for the resolved workspace and injects the rendered block **between the agent's own system prompt and the memory recall**, so every mission — Discovery, Strategist, Builder — sees the operator's shared context first. New route `/_authenticated/briefing` provides the editor UI (5 textareas with hint copy + character counts, single Save button, mutation-driven toast, AppShell layout). Pinned to the sidebar nav as **"Briefing"** (Crosshair icon) right after Today. Also added the small `prd.link_issue` agentic tool to `TOOL_REGISTRY` (write category, default `confirm` mode, idempotent: sets `prds.github_issue_url`) closing the Bundle 6 PRD↔issue link-back loop; backfilled into `agent_tools` for every existing user. Migration adds `prds.github_issue_url`. Verification: edit the brief on `/briefing`, run a mission from `/agents`, observe the Strategist's draft honoring Current focus / Anti-goals. Files: `src/lib/briefs.functions.ts` (new), `src/routes/_authenticated.briefing.tsx` (new), `src/lib/ai/loop.server.ts`, `src/lib/ai/tools/registry.server.ts`, `src/components/cadence/AppShell.tsx`, plus the migration. Next on the YC-demo path: Bundle 3 (Agent Roster + Trust Score + Autonomy Dial).
- **2026-06-03 — Repaletted to "Carbon & Ember" (supersedes Midnight Indigo).** Operator unhappy with the indigo look; wanted factory.ai-adjacent darker base with Pantone orange contrast. Shifted `src/styles.css` token values only (no rename, no component touches): `--paper` → warm carbon `oklch(0.13 .006 60)` (Pantone Black 6 C ~ #101820); `--violet` (still the canonical accent token) repointed to **Pantone Orange 021 C** `oklch(0.70 .22 38)` (~#FE5000); `--primary` now aliases `--violet` so every CTA/ring/focus reads ember; `--amber` warmed for the gradient halo; `--cyan` desaturated to ice as a cool counter-accent for charts. `.neural-gradient`, `.neural-text`, `.indigo-grid`, `.ring-glow-violet` automatically pick up the new palette. WCAG AA ≈ 7.4:1 ember-on-carbon. Documented in `design.md` §Tokens → "Active palette: Carbon & Ember" per the AI Color Selection Protocol.
- **2026-06-03 — PM lifecycle tools shipped (`research.synthesize`, `prd.draft`, `backlog.prioritize`).** Added 3 PM-centric agentic tools to `src/lib/ai/tools/registry.server.ts` and seeded them into `agent_tools` for every existing user (and for new signups via the updated `seed_default_agent_tools(uuid)`), all default `confirm` mode. (1) `research.synthesize` — pulls recent ungrouped `signals` (filterable by tag/sentiment/lookback), asks the model (via `callModel`, surface=`discovery`, `responseFormat=json_object`) to cluster them into 2–6 cohesive themes, writes `themes` rows (severity 1–5, confidence 0–1, frequency = signal count) and links source signals via `signals.theme_id`. (2) `prd.draft(opportunity_id)` — reads the opportunity, joins its `theme` + top 8 supporting signals, asks the model (surface=`prd`) to draft a structured PRD (Problem / Target user / Goals / Non-goals / Stories / Solution sketch / Success metrics / Risks) and writes a `prds` row in `draft` status with `model` recorded. (3) `backlog.prioritize` — for each backlog opportunity, gathers supporting-signal count + recency (last 7d), asks the model to re-score ICE (1–10 integers) with rationale, updates `opportunities.{impact,confidence,ease}` (ice_score is a generated column so it recomputes), returns the new ranked list with rationales. All three flow through the AI chokepoint so they hit guardrails + budgets + tracing, and through the agent loop they pick up `runId`/`stepIndex` automatically for idempotent retry on resume. No per-agent assignment needed — the loop filters `TOOL_REGISTRY` by what the user has enabled, so Discovery Scout / PRD Writer / Strategist see them immediately. Closes the Define + Plan halves of the Bundle 6 lifecycle slice that previously had only the GitHub-issue write on the Build edge. Files: `src/lib/ai/tools/registry.server.ts`, migration `seed_pm_lifecycle_tools(uuid)` + folded into `seed_default_agent_tools(uuid)` with a backfill loop.
- **2026-06-03 — FND-RUNTIME 0.9 runtime instrumentation + N1 `github.issue.create` shipped.** Added `src/lib/runtime/idempotency.server.ts` (`withIdempotency(scope,key,userId,runId,fn)` → execute → INSERT-on-conflict-fall-back-to-cached against the new `idempotency_keys` table). Refactored `src/lib/ai/loop.server.ts` so both `runAgentLoop()` (fresh) and new exported `resumeAgentLoop(runId)` (rehydrates from latest `agent_run_checkpoints` row) feed a shared `executeLoop()`; every iteration upserts a checkpoint *before* the provider call (so a `GovernanceHaltError` mid-stream never re-bills on resume) and wraps tool execution in `withIdempotency` keyed `tool:{runId}:{stepIndex}:{toolName}` — replaying a step short-circuits to the cached result instead of re-invoking the side-effecting tool. Added per-workspace **backpressure** (default 5 concurrent `running` runs); over-cap missions insert as `status='queued'` and are promoted by the new `/api/public/hooks/resume-runs` sweeper, which also resumes `running` runs whose `last_checkpoint_at` is >2 min stale (worker eviction). Sweeper is `pg_cron`-driven every minute against the stable preview URL. Added **`github.issue.create`** agentic tool to `TOOL_REGISTRY` (category `write`, default `confirm` mode): writes to the single allow-listed `GITHUB_REPO` env, validated `owner/name` format, idempotent via caller-supplied `idempotency_key` (e.g. PRD id) so re-execution from a checkpoint never double-creates an issue. ToolCtx extended with optional `runId` + `stepIndex` so future tools can key their own idempotency without re-deriving. Files: `src/lib/runtime/idempotency.server.ts` (new), `src/lib/ai/tools/registry.server.ts`, `src/lib/ai/loop.server.ts`, `src/routes/api/public/hooks/resume-runs.ts` (new), plus a `pg_cron` migration scheduling `resume-runs` every minute. Forced-restart integration test still TODO. Lifecycle slice (Bundle 6 Discover→Define→Plan against a real Cadence signal, approving the real GitHub-issue write) is now the operator-driven next step.
- **2026-06-03 — FND-RUNTIME 0.9 foundation landed (decision + schema + secrets).** Wrote `docs/decisions/durable-runtime.md` selecting a **DB-backed durable job table** over Cloudflare Queues — rationale: matches existing `/api/public/hooks/*` + `pg_cron` + tenancy patterns; zero new infra/runtime/auth model; portable off Cloudflare; visible to the human governor as ordinary rows. Applied a migration adding (1) `agent_run_checkpoints` — append-only, one row per loop iteration, `UNIQUE (run_id, step_index)`, `state JSONB`, full tenancy keys, RLS scoped to `auth.uid()`; (2) `idempotency_keys` — `UNIQUE (scope, key)` dedup table for `/api/public/hooks/*` ticks (`tick:{hook}:{run_id}:{step_index}`) and tool execution (`tool:{run_id}:{step_index}:{tool_name}`) so a resumed step never re-executes a side-effecting tool; (3) `agent_runs.step_index` + `last_checkpoint_at` for heartbeat + resume cursor. Both new tables have `GRANT … TO authenticated`/`service_role` and RLS. Requested + received `GITHUB_TOKEN` + `GITHUB_REPO` secrets so the next stage — first lifecycle slice end-to-end on the Cadence repo (Bundle 6 Discover→Define→Plan + N1 `github.issue.create`) — has no hard blocker. `active-task.md` extended with the loop-checkpoint, `resumeAgentLoop`, `/api/public/hooks/resume-runs` sweeper, backpressure, and lifecycle-slice sub-steps; Live status board now shows "Now building: FND-RUNTIME (0.9) · Lovable · main".
- **2026-06-03 — Extended Agentic Proof Platform → v1.1: full PM lifecycle on real systems.** Un-deferred S4–S6, L, M (previously deferred from the YC cut) under one **realism rule**: agents orchestrate existing tools (GitHub, GitHub Actions, deploy webhooks, Slack/email, support channel) — they don't replace IDEs, CI, or helpdesks. Added 4 new capability bundles to `docs/feature-backlog.md` (9 Build+Test, 10 Ship, 11 Launch, 12 Support→Learn), 7 new reserved IDs (N1 GitHub-issues write, I-thin Builder scoped PR, J-thin CI read, K-thin merge+deploy ingest, L-thin changelog+one channel, M-thin one inbound channel, Z1 Analyst learn loop), expanded build sequence 8→12 steps, added Demo narrative ("one continuous mission, ~3 minutes" — real signal → real GitHub issue → real PR → real CI → real merge → real deploy → real outbound message → real inbound ticket → re-scored opportunity → next Discovery cycle). Confirmed Cadence-on-Cadence as the real-data seed including PR writes on this repo (Builder needs `GITHUB_TOKEN` with `repo` scope, branch protection on `main` makes it safe; secret added when Bundle 9 starts, not now). Logged in `docs/strategy/session-decisions.md`. `active-task.md` unchanged — FND-RUNTIME 0.9 still next.
- **2026-06-03 — Reframed "YC demo cut" → "Agentic Proof Platform (v1)".** Same 8 capability bundles, same sequence, same reserved IDs (C5, C6, U6); what changed is the bar: each bundle now ships against an explicit **proof bar** (end-to-end behavior on real data) mapped to four claims legacy PM tools cannot make — C1 agents operate/humans govern · C2 A2A handoff is first-class · C3 one governed loop · C4 trust is dialed. Default real-data seed = **Cadence-on-Cadence** (we run our own roadmap on Cadence) so bundle 6 has no design-partner dependency. YC application becomes a by-product of the proof platform, not its driver. Updated `docs/feature-backlog.md` (renamed section, added four-claims table + per-bundle proof bars + Real-data seeding subsection) and logged in `docs/strategy/session-decisions.md`. `active-task.md` unchanged (FND-RUNTIME 0.9 still next).
- **2026-06-03 — Locked YC demo cut (scope overlay, no new roadmap).** Defined the 8 capability bundles that compose the YC application demo and mapped each to existing backlog IDs in `docs/feature-backlog.md` → new top section "▶ YC demo cut". Centerpiece is bundle #4 (E1–E6: sub-agent spawning, A2A messaging, mission handoff, parallel sub-agents/sessions, Mission Graph) — the agent-to-agent thesis. Decisions: persona = Founder-as-PM; S4–S6 (autonomous Build/Test/Ship) deferred and positioned as "foundation built, next milestone"; demo data = real product. Sequence: finish foundation (0.9 durable runtime → 0.2 cache) → C5 Strategic Briefing → C1/C6 roster + Trust Score → E1–E5 A2A primitives → E6 Mission Graph → wire F→G→H through handoff → D3 polish → O1/O2 + U6 export. Reserved IDs C5, C6, U6 with stub entries. Logged in `docs/strategy/session-decisions.md`; seeded `active-task.md` for FND-RUNTIME (0.9).
- **2026-06-03 — Completed FND-KILLSWITCH (0.6).** Added governance layer on top of existing spend caps: new `kill_switches` table (system + per-workspace) with admin-only system row and owner/admin-writable workspace rows; `current_kill_state(ws)` `SECURITY DEFINER` RPC the chokepoint reads before every call; `agent_runs` extended with `workspace_id`, `mission_spend_cap_usd`, `mission_token_cap`, `tokens_used`, `spend_used_usd`, `halted_reason`/`halted_at` and atomically incremented via `record_mission_usage()`; `agent_approvals` extended with `escalation_state` + 24h default `expires_at`; new public route `/api/public/hooks/approvals-tick` driven by `pg_cron` every minute to auto-expire stale approvals. Chokepoint enforcement in `callModel()` and `callModelStream()` throws a typed `GovernanceHaltError` that logs `ai_events` with `status='blocked'` and `error_message='governance_halt:<kind>'`; agent loop catches it and finalizes the run with `status='halted'`. New `/_authenticated/governance` UI shows pause panel (reason field, admin-gated), per-mission token/spend bars, and a stale-approvals panel with extend/approve/reject. `AppShell` shows a red paused banner when the current workspace is paused. Files: `src/lib/ai/runtime.server.ts`, `src/lib/ai/loop.server.ts`, `src/lib/governance.functions.ts`, `src/routes/_authenticated.governance.tsx`, `src/routes/api/public/hooks/approvals-tick.ts`, `src/components/cadence/AppShell.tsx`, plus two migrations. Foundation-audit §0.6: 🟡 → ✅.
- **2026-06-03 — Documented FND-KILLSWITCH (0.6) UI + persisted doc-loop rules to memory.** Added a "How to use / verify" block under `docs/feature-backlog.md` §0.6 (operator walkthrough of the Governance page panels, paused banner, server enforcement points, and a three-step verification checklist), added a one-paragraph "Governance surface (operator UI)" pointer to `architecture/security.md` so the architecture doc links to the operator guide, and refreshed the Live status board. Promoted the closed documentation-loop rules (update backlog status board + plan §4 + matching architecture/foundation-audit entry + add a "How to use / verify" block when a feature has a user-facing surface; commit to `main` with one-line WHY; speak in product terms, never expose Supabase) to `mem://index.md` Core so every future Lovable session applies them without re-prompting.
- **2026-05-31 — Completed implementation of 0.7 (FND-INJECTION).** Hardened the AI runtime and agent planner loop by XML-escaping and quarantining RAG context chunks and tool execution results inside isolation tags. Added instructions to treat these outputs as passive text. Programmatically elevated prompt-injection guardrails to block immediately.
- **2026-05-31 — Completed code-side implementation of 0.2 (FND-CHOKEPOINT-STREAM).** Implemented `callModelStream` in `runtime.server.ts` to enforce budgets, input/output guardrails, prompt templates, and vector RAG context. Refactored `/api/chat` and `/api/studio-chat` routes to use `callModelStream`, ensuring all streaming chat interactions pass through the central AI runtime chokepoint.
- **2026-05-31 — Completed code-side implementation of 0.1 (FND-TENANCY).** Created `useWorkspace` hook and provider to manage select workspace/product states; wrapped `_authenticated` layout in `WorkspaceProvider`; refactored `AppShell` with sidebar dropdown switcher and project tabs; updated `projects.functions.ts` server functions with default workspace fallbacks.
- **2026-05-31 — Registered closed-loop documentation verification and context boot hooks.** Added [remind-doc-loop.sh](file:///Users/rohitgajaraj/Documents/My Projects/My Builds/Project-Cadence/.claude/hooks/remind-doc-loop.sh) and [load-project-memory.sh](file:///Users/rohitgajaraj/Documents/My Projects/My Builds/Project-Cadence/.claude/hooks/load-project-memory.sh) to `.claude/hooks/`. Registered them under `Stop`/`SubagentStop` and `SessionStart` events respectively in [.claude/settings.json](file:///Users/rohitgajaraj/Documents/My Projects/My Builds/Project-Cadence/.claude/settings.json). The startup hook boots new sessions with context by printing core doc locations, active tasks, and recent memories. The shutdown hook verifies that changes were documented. Set the status board in [feature-backlog.md](file:///Users/rohitgajaraj/Documents/My Projects/My Builds/Project-Cadence/docs/feature-backlog.md) to show `0.1 (FND-TENANCY)` is active under `Antigravity`.
- **2026-05-30 — Tenancy retrofit migrations authored (0.1, not yet applied).** Three forward-only migrations under `supabase/migrations/` (`…tenancy_a_scaffolding`, `…_b_add_keys_backfill`, `…_c_tighten_policies`): add `workspaces` + `workspace_members` + `is_workspace_member()` helper; add `workspace_id` to 22 NOW-set tables + `product_id` to 10 (backfilled from existing `project_id` on 8 first-slice tables); membership-keyed RLS replacing `user_id`-only; `current_user_default_workspace()` default bridge so existing app/Lovable inserts keep working; RAG `match_*` functions scoped to workspace + optional product. Design + table-by-table scope: [`docs/decisions/tenancy-retrofit.md`](./docs/decisions/tenancy-retrofit.md). **Pending:** apply via Supabase flow (migration-safety hook runs on apply); then server-fn context plumbing (O2) to set keys explicitly; then flip 0.1 → ✅ in [`docs/foundation-audit.md`](./docs/foundation-audit.md).
- **2026-05-30 — Cross-tool co-dev substrate established.** Added `AGENTS.md` §10 (portability matrix + layer-ownership + per-tool entry points + git-reconciliation workflow): the repo is the only shared substrate; skills/subagents/hooks/plugins are Claude-Code-only, MCP + `AGENTS.md` are the portable layers. New portable MCP manifest `.mcp.json` (Supabase read-only + Playwright, env-driven, no secrets). New `.claude/skills/` (policy README + `cadence-feature-pair` project skill encoding the two-files-in-lockstep convention) and `.claude/agents/` policy README. Renamed `agents.md` → `AGENTS.md` (case-only; was a latent bug on case-sensitive FS / non-Mac tools). **Security:** `.env` was tracked + un-ignored — added `.env`/`.env.*` to `.gitignore`, added `.env.example`, ran `git rm --cached .env`. **Pending (needs operator decision):** rotate Supabase keys + scrub history; mirror `.mcp.json` into Antigravity/Gemini config.
- **2026-05-30 — Removed `nango/` from the repo; deleted stray `playwright-cli`.** Audit found **zero** references to nango anywhere in `src/` (incl. `sync.functions.ts` / `integrations.functions.ts`), no `@nangohq` dep in `package.json`, and nango absent from the build graph (vite/tsconfig/wrangler) — it was ~200M of the self-hostable Nango *platform* (its own clone of `NangoHQ/nango@7faf2c30`), disconnected from the app and present only as a broken gitlink (no `.gitmodules` → empty on fresh clone). Untracked it and added `nango/` to `.gitignore` (working copy kept on disk). **Decision:** when integrations are wired, run Nango as a separate backend (Nango Cloud or self-hosted via its own docker-compose) and consume it via `@nangohq/node` + `@nangohq/frontend` + `NANGO_HOST`/`NANGO_SECRET_KEY` env — same service-behind-a-URL pattern as Supabase. Also deleted `playwright-cli` (stray archived MS clone).

---

## 5. Legacy build log (retained — the previous source, for reuse)

> This is the earlier build (the "vibe-coded" source). **It is a reuse reference, not the plan.** Mine it for what survives the stress-test; supersede entries as they're rebuilt into section 4. Do not treat anything here as current truth without checking the code.

- **Foundation** — Supabase auth (email + Google OAuth), `profiles`, workspaces + extended `projects`, persistent SSE chat with workspace grounding, model-agnostic router with per-surface defaults, command palette (⌘K), Mission Control widgets, OKLCH dark theme, RLS, loader+Suspense pattern, route boundaries, global auth middleware. *(Largely reusable.)*
- **Discovery & specs** — `signals` ingest (paste/CSV, chunked inserts; sentiment on insert), clustering (k-medoid + synthesis with `evidence_ids[]`), themes → ICE opportunities, one-click PRD → Tiptap with `/ai` slash menu, `prd_versions` autosave + diff, early pgvector RAG (512/64 chunks, 1536-d). *(Reusable; this is the first-slice base.)*
- **Planning & meeting intelligence** — Now/Next/Later board (`@dnd-kit`), Sprint Planner (PRD → tasks), meeting pipeline (summarize → decisions → action items → assignees), first-class `decisions` with `supersedes`, daily brief. *(Reusable; reframe roadmap to outcome-oriented.)*
- **Code Studio** — three-pane Studio, virtual `studio_files`, JSON edit-plan multi-file edits with per-hunk accept/reject, `studio_revisions`, `experiments`. *(Reusable base for the autonomous Build stage; live preview + autonomous test loop are new.)*
- **Integrations** — Google Docs/Notion two-way sync, Linear pull/push + Sync Inbox, Google Calendar read+write, BYO keys (pgsodium), scheduled agents (`pg_cron` + advisory lock). *(Reusable.)*
- **AI trust stack** — telemetry (`ai_events`/`ai_traces`/`ai_evals`/...), the chokepoint pipeline, LLM-as-judge, guardrails, hybrid RAG + citations, planner/executor loop + `agent_memory`, Prompt Studio, eval harness ("Cadence core"), `/analytics` dashboard, safety/incidents, trace viewer. *(Reusable core; the orchestration layer X1 extends it to parallel sessions/products.)*

> The detailed sub-phase narrative of the legacy build (every bug fix and decision) is preserved in git history and the prior revision of this file; this summary is enough to decide reuse.

---

## 6. Product-agent roster (re-examined: explicit vs. implicit)

**The question:** is a fixed roster of 16 named agents right? **Answer:** no — split it. Use a small set of **durable, named lifecycle agents** (explicit, one owner per stage) plus an orchestrator that **dynamically spawns ephemeral specialist sub-agents** for sub-tasks (implicit). Fixed seats for micro-roles create clutter; dynamic sub-agents scale with the work.

**6 outcome-focused durable agents (explicit, one per lifecycle band):**

The roster is kept narrow and delivery-oriented. Each agent owns a clear band of the product lifecycle. Fixed seats for micro-roles are avoided — those collapse into ephemeral specialists.

| Agent | Lifecycle band | Owns | Primary pain point addressed |
|---|---|---|---|
| **Orchestrator** | All stages | Mission coordination, spawns ephemeral specialists, manages approval routing, parallelism | Coordination overhead, context loss between stages |
| **Discovery** | S1 Discover | Signal ingest (support/churn/usage/sales/reviews), clustering → themes → ICE-scored opportunities, continuous feed | Shallow discovery, anecdotal signals, no synthesis |
| **Strategist** | S2 Define + S3 Plan | Cited PRD/spec from opportunities, dependency-aware task graph, outcome roadmap, anti-feature-factory guardrail (interrogates whether work matches stated outcomes) | Mechanical spec writing, feature factories, weak prioritization |
| **Builder** | S4 Build + S5 Test + S6 Ship | Autonomous multi-file coding, test generation + QA gating, PR/deploy/release notes — all behind governance gates | Autonomous code production, quality gates, release overhead |
| **Growth** | S7 Launch/GTM/Price + S8 Operate/Support | Launch assets, positioning, pricing pages, distribution plans, support triage + draft answers (support themes feed back into Discovery to close the loop) | GTM gap after shipping, support overhead, loop closure |
| **Analyst** | S9 Learn | Outcome measurement, re-score opportunities, insight memo, Product Memory updates, daily brief | Learning loop — decisions and outcomes never connected |

**Ephemeral specialists (spawned by Orchestrator per task):** competitor scan, UX critique, stakeholder brief, data analysis, security review, code review, and any other short-lived specialist. They inherit the chokepoint, tool allow-list, and governance. No permanent seats for micro-roles.

**Persona mapping:**
- P1 (Solo PM): primarily Discovery + Strategist + Analyst — handles the full insight-to-roadmap loop
- P2 (Founding PM): all 6 agents — runs the entire product org autonomously
- P3 (Technical Founder): Discovery + Growth + Analyst — frees them from everything except coding

Schema per agent: `slug, name, system_prompt, tool_allowlist[], default_model, temperature/top_p/seed, max_tokens, schedule_cron?, approval_mode (auto|confirm|review), memory_enabled`. Roster changes need a migration + a section-3 entry.

---

## 7. Testing strategy

- **Unit:** pricing math, each guardrail rule kind, RAG chunker boundaries, ICE/cron/date helpers.
- **Integration:** chokepoint (one `ai_events` row + trace; budget throws before provider; cache short-circuits but logs; guardrail block aborts + logs; ticks idempotent); orchestration (parallel sessions isolated; checkpoints resume; cancellation saves partial trace); RLS isolation across products/workspaces.
- **Autonomous build/test loop:** the Engineer agent's output must pass the QA agent's generated tests before Ship; a failing eval suite ("Cadence core") blocks deploy (≥0.1 regression without override).
- **E2E:** intent → discover → define → plan → build → test → ship, watched in the orchestration view; multi-product isolation; ⌘K across routes; `/analytics` renders on seeded data.
- **Manual QA before release:** auth + tenancy isolation; every route empty/partial/full; AI message contract present ([`design.md`](./design.md)); guardrail block works; budget breach is friendly; dark-mode contrast.

---

## 8. Lessons learned (kept from the legacy build)

One AI chokepoint paid for itself (judge added in half a day). Loader + `useSuspenseQuery` killed `useEffect+fetch` regressions. OKLCH tokens ended dark-mode contrast bugs. Bugs fixed: name-vs-email leak; duplicate agent fan-out (advisory lock); action-item due-date glitch; Notion BFS reorder; trace recursion blow-up; cache cross-user poisoning (salted key); CSV params cap (chunked inserts). Known limits: clustering degrades past ~1000 signals/run; Studio truncates files >2k lines; Docs sync drops comments; `model_pricing` hand-maintained.

---

## 9. Out of scope (for now)
Fine-tuning workflows from `ai_events`; cross-workspace vector sharing; public agent/skill-pack marketplace; cross-workspace SSO; fully autonomous *strategic* decisions (strategic conclusions keep a human gate by design — tactical ones may auto-apply). These are deliberate exclusions, revisited when the core loop is solid.
