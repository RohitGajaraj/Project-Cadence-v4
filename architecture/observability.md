# architecture/observability.md: what we can see, and the bars we hold

> **What this is.** The observability surfaces Cadence already runs (cost, traces, evals, drift, guardrails, the proof gauntlet, logging) and the non-functional requirements that govern them (latency, scale, availability, the inference-cost and margin model, rate limits, retention). Strategy canon: [`../docs/strategy/v7-agentic-product-os-2026-06-14.md`](../docs/strategy/v7-agentic-product-os-2026-06-14.md). The AI chokepoint that produces most of this telemetry: [`runtime.md`](./runtime.md). Orchestration and the loop: [`orchestration.md`](./orchestration.md). Security and the kill switch: [`security.md`](./security.md). Build history and roadmap: [`../plan.md`](../plan.md).
>
> Every item is marked **Built**, **Partial**, or **Missing/Planned**. The rule is the v7 rule: claim never outruns wiring. Where a surface exists in code but cannot read real numbers yet (signup 500s, slug bug, connectors not live), it says so.

---

## Why this doc exists

Two questions, one file. First: when an agent does something, what evidence do we keep, and where does it live? Second: how fast, how cheap, and how reliable does the system have to be before we ask a PM to trust it with reversible work? Part A answers the first. Part B answers the second.

The honest frame from v7: the autonomy and memory engine is real, and most of the telemetry below is wired and writing rows. The gaps are not in the observability layer. They are upstream, at the unblock gates (the orchestrator slug bug, the migration-sync queue, connectors not yet operational). Until those clear, several of these surfaces are watching a system that cannot yet run on a real account's real data. The instrumentation is ready before the data is.

---

# Part A. Observability (what exists)

Everything an AI call touches is logged once, at one place. The chokepoint (`src/lib/ai/runtime.server.ts`) writes the master telemetry row, and the surfaces below read from it or from the tables the loop fills around it. This is the design payoff of a single call path: telemetry, cost, evals, guardrails, and replay are uniform across chat, the agent loop, PRD drafting, discovery, Studio, and the judge itself, for free. See [`runtime.md`](./runtime.md) for the pipeline order.

## 1. Cost and token telemetry: **Built**

The master table is `ai_events`. One row per model call, written by both `callModel` (awaited) and `callModelStream` (after the stream drains, in the stream's `finally` block). Each row carries `surface`, `model`, `provider`, `via` (gateway or byo), `prompt_tokens`, `completion_tokens`, `total_tokens`, `est_cost_usd`, `latency_ms`, `ttft_ms`, `cache_hit`, `status` (ok / error / blocked), and short previews (input 500 chars, system 4000, output 1000). Cost math comes from `src/lib/ai/pricing.ts` (`estimateCostUsd`), a hand-maintained per-model rate table. Update it when a provider changes pricing; nothing else reads pricing.

Spend is enforced, not just recorded. `ai_budgets` holds per-user daily and monthly USD and token caps with rolling windows; `ai_surface_budgets` does the same per surface. A hard-cap breach throws before the provider is ever called. A soft-cap crossing (`alert_at_pct`, default 80%) writes an `ai_budget_alerts` row. Per-mission ceilings live on `agent_runs` (`mission_token_cap`, `mission_spend_cap_usd`) and are incremented atomically via the `record_mission_usage` RPC, so the next call in the same mission sees the bump and can be halted by it.

**What you can answer today:** cost per surface, per model, per user, per mission, per trace. Cache-hit rate. Token intensity per decision cycle. Where the spend concentrates.

**Gap (Partial):** the cost surfaces read whatever rows exist. With signup 500ing (KI-13) and the orchestrator slug bug killing multi-agent missions, the rows that exist today are seeded and developer traffic, not real-account decision cycles. The accounting is correct. The denominator is not yet real.

## 2. Execution traces: **Built**

`trace_id` on `ai_events` correlates every model call inside a single `runAgentLoop` invocation; `parent_event_id` links a child call to its parent, so a loop's steps form a span tree. Trace IDs are time-sortable (UUIDv7), so a trace reads in execution order without a sort key. The `/traces` surface reads this tree. Around it, `tool_calls` records every tool execution (tool name, args, result, ok/error, `latency_ms`), and `agent_run_checkpoints` snapshots loop state per step, which is what makes a trace replayable and a mission resumable after a worker eviction.

**What you can answer today:** for any mission, the full thought → tool-call → observe → reflect → answer chain, with per-step latency and per-call cost, plus which approvals gated which steps.

## 3. Evals: **Built (two harnesses), Partial on coverage**

Two eval paths, both on the 0-to-100 mental model the team uses (stored internally as 0-to-1 dimensions, read as a 0-100 score):

- **Per-event LLM judge.** The `eval-tick` hook picks up to 20 recent `ai_events` (last 24h, `status='ok'`, excluding the judge's own `surface='judge'`/`'eval'` calls) that lack an `ai_evals` row, and scores them with `google/gemini-2.5-flash-lite` across seven dimensions: hallucination, groundedness, relevance, coherence, toxicity, pii_risk, prompt_injection_risk, plus a rationale and any unsupported claims. Rows land in `ai_evals`, keyed to `event_id`.
- **Structured suites.** `eval_suites` (named case collections with a `schedule_cron`) and `eval_case_results` (per-case scored outputs). The `eval-suite-tick` hook (daily, 3am) runs enabled suites whose `last_run_at` is stale by more than an hour, via `runEvalSuite` in the eval runner.

The deploy-gate intent (an eval regression of ten or more points on a Cadence-core case blocks the deploy, KI-14) is the standing policy from [`runtime.md`](./runtime.md). The judge and suites are wired. The gate's enforcement in CI is the part to verify against the live pipeline.

**Gap (Partial):** the judge runs on whatever `ai_events` exist, same denominator caveat as cost. Suite coverage is as deep as the cases an operator has authored.

## 4. Drift: **Built**

`drift_snapshots` holds metric baselines. The `drift-tick` hook (daily, 4am) calls `runDriftForUser` (`drift.server.ts`) for every user active in the last 30 days, compares current metrics against the baseline, and opens or resolves drift incidents. Drift is a passive watcher by design, not a deploy gate (that is the eval job). Its purpose is to catch a model or prompt whose behavior moved without anyone changing the deploy.

**Gap (Partial):** drift needs a population of active users with a history to baseline against. Pre-launch, the active-user set is small, so drift is structurally ready but thin on signal until real accounts accumulate.

## 5. Guardrails: **Built**

`guardrail_rules` holds user-configured policies (kind: regex / keyword / pii / injection / secret; action: block / warn / redact; applies_to: input / output / both). They run inside the chokepoint: input rules fire before the provider call, output rules after. `block` throws immediately with `code='GUARDRAIL_BLOCK'`; `redact` rewrites the matched text in place; every match writes a `guardrail_hits` row (rule id, name, kind, action, side, and the first 80 chars of the matched text). Output guardrails do not run on `json_object` responses (the loop's planner format).

Two structural defenses sit alongside the rules and are also observable. Prompt-injection defense: tool output is XML-escaped and wrapped in `<untrusted_tool_output tool_name="...">` before re-injection into the conversation, with a CRITICAL system-prompt block telling the model never to follow instructions inside those tags. The kill switch (`current_kill_state` RPC, two levels: system and workspace) is checked at the top of every call before any spend; a halt is logged as a `status='blocked'` `ai_event` and flips the run terminal via `halt_agent_run`. See [`security.md`](./security.md).

## 6. The proof gauntlet: **Built (computed on real tables), Partial on real data**

The three numbers v7 names as the proof the engine works are computed over live tables, surfaced at `/govern?tab=gauntlet`:

- **Acceptance rate.** Approval decisions on `agent_approvals` (approved vs. rejected). The "approve by exception" signal: as it rises and overrides fall, the agent is earning trust.
- **Ritual retention.** `ritual_sessions` (the reflection-session table, migration `20260614150000`): are operators coming back to the daily loop.
- **Autonomy ratio.** The share of side-effecting tool runs that executed unattended (`is_unattended`, derived from `isSideEffectingTool`), surfaced as the "Executed unattended" audit on the mission cockpit. The number v7 wants trending up.

Trust is the related per-agent score. `computeAllAgentTrust` (`trust.server.ts`) reads three live signal tables on demand: mission success rate from `agent_runs` (40%), approval acceptance from `agent_approvals` (30%), mean eval score joined through `ai_events.agent_id` from `ai_evals` (30%), all shrunk toward 0.5 with a prior weight of 10 so a handful of samples cannot swing the score. It produces a 0-to-100 score and an arc hint; the operator sets the actual arc via `agent_autonomy`.

**Gap (Partial):** every input table is real and the math is real. The numbers only become *meaningful* once a real account runs the loop on real data, which is gated on M-0 (slug bug + migration sync) and M-A (ambient on-ramp, real ingest) in the v7 roadmap. The gauntlet is the dashboard the launch gate reads; it is waiting on the data, not on more code.

## 7. Logging: **Partial**

Structured row-level telemetry (the tables above) is the primary observability layer and is strong. Free-text application logging is thinner: `console.error` throughout for non-fatal failures, which in the Cloudflare Worker goes to the Workers log stream. One deliberate piece of plumbing: `src/lib/error-capture.ts` captures the last unhandled error in module scope so `src/server.ts` can surface the real error behind an h3-swallowed 500 (h3 hides in-handler 500s as a generic JSON body; `src/server.ts` detects that pattern and renders a branded error page while logging the captured cause).

**Missing/Planned:** there is no structured log aggregation, no log-based alerting, and no request-level tracing outside the AI chokepoint. For a pre-launch product the row tables cover the questions that matter (what did each agent do, what did it cost, was it safe). A real log pipeline (levels, correlation IDs on non-AI paths, retention, alert routing) is post-launch work, sized to the first incidents rather than guessed at now.

## Observability at a glance

| Surface | Where it lives | Status |
|---|---|---|
| Cost and tokens | `ai_events`, `ai_budgets`, `ai_surface_budgets`, `ai_budget_alerts`; chokepoint | Built; Partial on real data |
| Execution traces | `ai_events` (`trace_id` / `parent_event_id`), `tool_calls`, `agent_run_checkpoints`; `/traces` | Built |
| Per-event evals | `ai_evals`; `eval-tick` (judge: `gemini-2.5-flash-lite`, 7 dims) | Built; Partial coverage |
| Structured eval suites | `eval_suites`, `eval_case_results`; `eval-suite-tick` (3am) | Built; coverage = authored cases |
| Drift | `drift_snapshots`; `drift-tick` (4am) | Built; thin on signal pre-launch |
| Guardrails | `guardrail_rules`, `guardrail_hits`; chokepoint + kill switch | Built |
| Proof gauntlet | `agent_approvals`, `ritual_sessions`, `is_unattended`; `/govern?tab=gauntlet` | Built; Partial on real data |
| Trust score | `computeAllAgentTrust` over `agent_runs` / `agent_approvals` / `ai_evals` | Built |
| Application logging | `console.*` to Workers stream; `error-capture.ts` | Partial; aggregation Missing |

---

# Part B. Non-functional requirements

These are the bars the product holds itself to. Some are enforced in code today (budget caps, mission caps, kill switch, cron batch sizes, the memory decay tick). Some are targets the v7 canon sets that the system must hit before launch (the under-10-second interaction, time-to-value under 10 minutes, the margin model). Each is marked for which it is.

## 1. Performance and latency: **Target, partially enforced**

- **Interaction bar: under 10 seconds.** A felt single-action response (a chat turn, a single agent step surfacing a result, an approval decision applying) should land in under 10 seconds. This is the felt-product bar; it is a target, not a hard gate in code. The instrumentation to measure it is Built: `latency_ms` and `ttft_ms` are on every `ai_events` row, so the bar is auditable per surface today. Streaming (`callModelStream`) exists precisely so chat feels responsive before the full answer lands; `ttft_ms` is the number that protects the felt latency on long answers.
- **Time-to-value: under 10 minutes.** From a real signup to the loop closing once on the user's own data, in under 10 minutes (v7 §10, §12 M-A; it is also the metric investors ask for in §11). This is a product target across the whole onboarding path, not a single request budget. It is gated on M-0 and M-A: it cannot even be measured until signup works (KI-13) and at least two real ingest sources exist. **Status: Target; currently un-measurable until the unblock gates clear.**
- **What protects latency in code today.** The cache lookup in the chokepoint (exact `request_hash` plus near-dupe embedding similarity, salted per user/workspace/surface) avoids paying for a repeat call. Adaptive step budgets (`adaptiveStepBudget`) keep a loop from running more model steps than its role and arc warrant (orchestrator base 14, builder 24, others 6, plus arc and DAG-size bonuses, hard ceiling 40), which bounds worst-case mission latency. Retry uses bounded backoff (400ms × attempt, default 2 retries on 429/5xx) so a flaky provider degrades latency by a known amount rather than hanging.

## 2. Scalability: **Built (the caps are real)**

The runtime is a Cloudflare Worker; horizontal scale of the request path is the platform's job. The interesting scale limits are the ones we set on the background loop, and they are concrete:

- **Per-minute cron batch caps.** The loop advances on a fleet of every-minute hooks, each with a fixed batch size so a single tick has bounded work and bounded cost:

  | Hook | Schedule | Batch cap |
  |---|---|---|
  | `resume-runs` | every minute | 5 queued/stale/waiting runs resumed; then up to 20 running missions advanced via `advanceMissionCore` |
  | `approvals-tick` | every minute | pending approvals processed |
  | `event-reactor-tick` | every minute | 10 `event_queue` rows (`approval_mode='auto'`) drained |
  | `outcome-tick` | hourly | approved PRDs with linked issues, checked for close |
  | `indexer-tick` | hourly (:07) | recent workspace content chunked and embedded into `rag_chunks` |
  | `eval-tick` | scheduled/on-demand | 20 recent `ai_events` lacking an eval |
  | `eval-suite-tick` | daily (3am) | enabled suites stale by >1h |
  | `drift-tick` | daily (4am) | users active in the last 30 days |
  | `memory-tick` | daily | low-value, unused memory rows pruned |

- **Backpressure.** A workspace with five or more `status='running'` runs does not start a sixth; the new run is enqueued `status='queued'` and the `resume-runs` sweeper promotes it when capacity frees. This caps concurrent model load per workspace and is the spillover valve the batch caps lean on.
- **Concurrency safety under scale.** Step dispatch and run promotion use compare-and-swap (`UPDATE ... WHERE status='planned'` / `WHERE status='queued'`), so two concurrent minute-ticks can never double-dispatch a step or double-run a run. Tool side effects are wrapped in `withIdempotency(key='tool:{runId}:{stepIndex}:{toolName}')`, so a resume after eviction returns the cached result instead of re-firing an external write. This is what lets the cron batches run aggressively without racing.
- **Scaling the batch caps.** The caps are conservative on purpose (pre-launch, small population). They are the first knob to turn when real load arrives: raise the per-tick batch and the per-workspace concurrency ceiling together, watching `ai_events` cost and `latency_ms` so the spend and the felt latency stay in band. **Status: the caps are Built and tunable; the tuning is a post-launch, data-driven step, not a guess made now.**

## 3. Availability: **Partial**

- **Platform.** Cloudflare Workers carries the request path; availability inherits from the platform. Supabase carries data and auth. There is no second region or failover layer we run ourselves; this is appropriate for the stage.
- **Graceful failure in code.** The h3-swallowed-500 handling in `src/server.ts` means an unhandled SSR error renders a branded error page instead of a raw crash, and the real cause is logged via `error-capture.ts`. Provider failure has a fallback model (attempted once after primary retries) and a local-dev gateway fallback. The kill switch is an intentional availability lever: an operator can pause the system or a single workspace, and every in-flight AI call halts cleanly at the next chokepoint check.
- **Resumability is the availability story for the loop.** Because every loop step checkpoints to `agent_run_checkpoints` and tool calls are idempotent, a Worker eviction mid-mission is recoverable: `resume-runs` rehydrates from the last checkpoint and continues without duplicate external writes (this is the FND-RUNTIME restart guarantee). A mission survives an outage of the compute layer.
- **Missing/Planned.** No formal uptime SLO, no health-check endpoint contract, no synthetic monitoring, no paging. Sized post-launch.

## 4. Inference cost and gross-margin model: **Target; the levers are Built, the model is owed**

This is the margin reality from v7 §9, stated plainly so it is not hand-waved: agentic workflows run **5 to 30 times** the token load of a single chat call. A multi-step decision cycle can cost roughly **$0.50 to $1.50** in inference. An active user on the ~$39/mo Pro tier running dozens of cycles a month can approach or exceed COGS on a single seat. Positive margin is not automatic; it is engineered, and the levers are wired:

- **BYOK (bring your own key), Built.** When a user supplies a provider key (`user_api_keys`) and the model prefix matches a known BYO provider, the chokepoint routes the call to the user's own key and the inference cost moves off our books entirely. Model-agnostic by contract (adding a provider is an adapter, not a call-site change), so provider routing across labs is model-agnostic by contract. _(Positioning update 2026-06-19: self-serve BYOK is REMOVED (enterprise-only); managed metered credits are the only self-serve path. Model-agnostic provider routing via our keys remains. The `user_api_keys` self-serve path is retired per WM-M9. See [`../docs/strategy/moat.md`](../docs/strategy/moat.md) §7.)_
- **Small-model routing, Built primitive, Partial policy.** The runtime can route any call to any model, and the per-surface defaults exist. The v7 intent (cheap models for familiar patterns, premium models only for hard reasoning) is a routing *policy* to layer on top of the existing capability. The mechanism is there; the cost-aware policy is the work.
- **Batch and cache, Built.** The chokepoint cache (exact + near-dupe, per-user/workspace/surface salted) already turns repeat calls into free hits, logged with `cache_hit=true`. The cron hooks already batch eval, indexing, and drift work so those background calls amortize. `cache_hit` on `ai_events` is the instrument that proves the cache is earning its keep.
- **Caps as a margin floor.** `ai_budgets` and `ai_surface_budgets` hard-stop a runaway user before the spend becomes a loss. Per-mission caps do the same at mission granularity. A user cannot cost more than their caps allow, full stop.

**What is owed (Target).** A real unit-economics model: tokens per cycle × model price × cycles per user, per tier, with the BYOK split and the routing policy folded in. v7 §9 and §14 name this as belonging in the TRD. The telemetry to build it from is already in `ai_events` (token counts, est cost, model, surface, per user). The model is a calculation over existing data, not new instrumentation.

## 5. Rate limits and ingest caps: **Built**

- **Ingest cap (KI-10).** The public signal-ingest webhook (`/api/public/ingest-signals`) accepts at most **50 signals** per request (a batch `{ signals: [...] }`) or a single `{ title, content?, source? }`. Auth is a bearer token resolved against `ingest_tokens` (revocable via `revoked_at`), and every insert carries an explicit `workspace_id` so the `signals_reactor_fanout` trigger can fan rows into `event_queue`. This is the rate-limiting valve on the one anonymous write path into the system.
- **Event-queue dedup.** `event_queue` is deduped by `UNIQUE(subscription_id, source_id)`, so a webhook that re-delivers the same source event cannot fan out twice. The reactor drains it at 10 rows per minute (the batch cap above), which rate-limits how fast inbound signal can trigger agent work regardless of how fast it arrives.
- **Budget caps as rate limits.** The daily/monthly token and USD caps in `ai_budgets`/`ai_surface_budgets` are, in effect, a rate limit on cost. A user who would otherwise loop expensively is stopped at the cap, before spend.
- **Missing/Planned.** There is no per-IP or per-token request-rate limit (requests per second) on the public endpoints beyond the 50-item body cap and the token gate. A true RPS limiter is a hardening item for when the ingest surface faces real traffic.

## 6. Data retention: **Built**

- **Memory decay tick.** `memory-tick` (daily) deletes `agent_memory` rows where `importance <= 2` AND `COALESCE(last_used_at, created_at) < now() - 30 days`. Recall writes `last_used_at` (`touch: true`), so a memory that keeps getting recalled stays alive and an unimportant, unused one ages out. This is the decay that keeps the memory store from bloating with low-value notes while protecting the moat object (high-importance outcome memories and anything recently used survive).
- **Free-tier memory expiry.** v7 §9 makes memory persistence the paid pull: on **Free**, decision memory expires (~30 days); on **Pro**, it persists and never expires. The decay tick is the mechanism the free-tier expiry rides on; the tier-aware retention policy (exempt paid workspaces from expiry) is the entitlement layer to wire at M-C (Monetize). **Status: the decay mechanism is Built; the plan-tier gating on top of it is Planned with the pricing/entitlements work.**
- **Telemetry retention.** `ai_events`, `tool_calls`, `guardrail_hits`, `ai_evals`, `drift_snapshots`, checkpoints, and approvals have no automatic expiry today; they are the audit trail and the gauntlet's denominator, so retaining them is the point pre-launch. A retention/archival policy for these (cost and compliance, EU AI Act audit horizons) is a post-launch decision, not a pre-launch one.

## Non-functional requirements at a glance

| Requirement | Bar | Status |
|---|---|---|
| Interaction latency | under 10s, felt single action | Target; measurable now via `latency_ms`/`ttft_ms` |
| Time-to-value | under 10 min, signup to first closed loop on real data | Target; un-measurable until M-0/M-A |
| Loop step budget | role+arc adaptive, ceiling 40 steps | Built |
| Per-workspace concurrency | 5 running runs, then queue | Built |
| Cron batch caps | per-hook fixed batches (table above) | Built; tunable |
| Concurrency safety | CAS dispatch + idempotent tools | Built |
| Availability / resumability | checkpoint + idempotency survive eviction; kill switch | Built; formal SLO Missing |
| Inference margin | BYOK + small-model routing + batch/cache | Levers Built; routing policy + unit model Owed |
| Ingest cap | 50 signals/request, token-gated (KI-10) | Built |
| RPS rate limit | per-IP / per-token | Missing/Planned |
| Memory retention | decay at importance≤2 + 30d unused; free-tier expiry | Decay Built; tier gating Planned |
| Telemetry retention | audit trail kept | Built (no expiry by design); archival policy Planned |

---

## The honest bottom line

The observability layer is the strong part of the system. Cost, traces, evals, drift, guardrails, and the gauntlet are wired through one chokepoint and writing real rows, and the non-functional levers that matter most for an agentic product (caps, idempotency, checkpointing, the kill switch, the cache) are Built and load-bearing. The two things that are not yet true: several surfaces are watching a system that cannot run on a real account's data until the v7 unblock gates clear (slug bug, migration sync, connectors), and the margin model is a calculation owed against data we already collect, not a missing instrument. Nothing here over-claims autonomy it cannot back with a row in a table.

---

## Related

- [`runtime.md`](./runtime.md): the AI chokepoint contract, where `ai_events`, budgets, caps, guardrails, the cache, and the kill-switch check all live.
- [`orchestration.md`](./orchestration.md): the loop, missions, A2A handoff, checkpoints, retry, adaptive budgets, and the cron hooks that drive the batch caps.
- [`security.md`](./security.md): the kill switch, the sacred caps, prompt-injection defense, and the anon-read threat model.
- [`data.md`](./data.md): the data model and RAG chunks behind retrieval and the indexer tick.
- [`deployment.md`](./deployment.md): the Cloudflare Worker, env split, and migration model the cron hooks and availability story sit on.
- [`../docs/strategy/v7-agentic-product-os-2026-06-14.md`](../docs/strategy/v7-agentic-product-os-2026-06-14.md): the canon, the gauntlet metrics, the latency and time-to-value bars, the margin model, and the unblock gates.
- [`../docs/features/trust-and-autonomy.md`](../docs/features/trust-and-autonomy.md): the trust score and the four autonomy arcs the gauntlet measures.
- [`../plan.md`](../plan.md): build log and the proof-gated roadmap (M-0 through M-D).
