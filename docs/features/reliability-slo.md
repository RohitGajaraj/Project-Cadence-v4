# RELIABILITY-SLO — AI-surface SLO + error budget

> _Created: 2026-06-21 (lane 1). Status: ✅ backend + read fn + Missions-header glance shipped and **LIVE-VERIFIED on the published app 2026-06-22** (lane 1): the Missions header renders "Heads up · AI error budget spent, 86.42% of calls succeeded this week" — and 86.42% is the exact `ok/(ok+error)` over the live 7-day `ai_events` window (70 ok / 81 evaluated, 20 blocked correctly excluded), so `getReliabilitySlo` + `computeSlo` are proven correct end-to-end against production data. A live-data review also surfaced and fixed a real correctness gap (success-synonym misclassification — see Verification). Remaining is the optional deep Engine Room breakdown (founder/design)._

Closes the `considerations.md` SRE-lens **P1** gap "SLOs/SLAs + error budgets." APP-HEALTH answers _is the platform up right now?_ (a binary liveness/readiness probe for monitors and load balancers). This answers the next question an enterprise buyer and an on-call operator ask: _how reliable has the AI surface actually been, and how much of our error budget is left?_

## What it measures

Over a trailing window of the caller's own AI calls (`ai_events`), it reports:

- **Availability %** — `ok / (ok + error)`. The share of real calls that succeeded.
- **Error rate %** — the complement.
- **p50 / p95 latency (ms)** — end-to-end latency percentiles over the same evaluated set.
- **Error budget** — against a target availability (default **99%**): how much of the permitted failure budget has been consumed, the remaining budget, and a calm three-state signal (`healthy` < 75% spent · `warning` 75–100% · `exhausted` ≥ 100%).

## The correctness crux: three call states, not two

`ai_events.status` is `ok | error | blocked`. A naive SLO counts every non-`ok` row as downtime. But **`blocked` is a deliberate governance/credit halt — the guardrails working as designed**, not an outage. Folding it into the error rate would make the system look unreliable exactly when its safety rails fire. So `blocked` is **excluded** from the availability denominator and from the latency percentiles entirely. This is the single most important behavior in the module, and it has a dedicated test.

`normalizeStatus` also recognizes the known success synonyms `success`/`succeeded` as `ok`. The runtime chokepoint only ever writes the three canonical states, but `ai_events` also carries `success` rows from seed/legacy/imported telemetry — counting those as errors would understate availability on any window that includes them. The fail-visible guarantee is unchanged: a genuinely unknown/NULL status still surfaces as `error`, never the excluded `blocked` bucket.

## How it works

- **Pure engine** — [`../../src/lib/reliability/slo.ts`](../../src/lib/reliability/slo.ts): `computeSlo(samples, config)` plus the `percentile`, `errorBudgetStatus`, and `summarizeSlo` helpers. Deterministic and **total** (never throws) for every input: empty window, all-blocked, a zero-tolerance 100% target, and NaN/negative latency are all handled. Fully unit-tested (`slo.test.ts`, 18 cases) with no DB and no publish, so the hard correctness gate covers the whole calculation.
- **Read-only server fn** — `getReliabilitySlo({ days?, targetAvailabilityPct? })` in [`../../src/lib/reliability.functions.ts`](../../src/lib/reliability.functions.ts): pulls the caller's `ai_events` (status + latency) over the window, maps each row to a normalized sample, and hands them to `computeSlo`. User-scoped (RLS via `requireSupabaseAuth` + an explicit `user_id` filter, matching `getCostPerOutcome`); the scan is capped at 5000 rows so a long history can never turn the read into an unbounded query. No writes, no agent calls, no AI spend.

## Governance & guardrails

- Read-only over an existing table; nothing is written and no model is called.
- Distinct from the three sibling health surfaces it does **not** duplicate: `app-health.ts` (binary liveness for external monitors), `health.functions.ts` (migration-drift checker), and `loop-health.functions.ts` (autonomous-loop health). This is the only one that quantifies measured AI reliability over time.

## Verification

- `bunx tsc --noEmit` clean; `bun test src/lib/reliability/` 57 pass (`slo.test.ts` 23, +1 success-synonym regression).
- **Live (2026-06-22):** the Missions-header glance renders "86.42% of calls succeeded this week" on the published app — the exact `getReliabilitySlo` 7-day computation over live `ai_events` (70 ok / 81 evaluated; the 20 `blocked` rows correctly excluded). Verified by Playwright against `cadence-flow-beta.lovable.app` (demo account, commit 662b5aec).
- **Live-data correctness fix (2026-06-22):** querying the demo's 30-day window showed availability **75.66%** under the old `normalizeStatus` (the 17 seed `success` rows counted as errors) vs **84.66%** after recognizing `success` as `ok` — a 9-point correction proven directly against production data. The 7-day glance was already correct because no `success` rows fall in that window; the fix makes wider windows correct too.

## Wired into the UI (2026-06-21)

A calm, silent-when-healthy `ReliabilityGlance` ([`../../src/components/cockpit/ReliabilityGlance.tsx`](../../src/components/cockpit/ReliabilityGlance.tsx)) on the Missions header consumes `getReliabilitySlo` (alongside `getRunawayMissions`) and surfaces a one-line "Heads up" **only** when the error budget is `warning`/`exhausted` (or a mission is spinning). It renders nothing when healthy, per the engine-room-doctrine (attention, not an always-on panel). Neutral ink tones (the role-color accents stay reserved). Gated through `impeccable`. ◐ renders on the founder's next publish.

## Out of scope / follow-ups

- **Deep Engine Room breakdown** — the full per-surface SLO + latency-percentile view behind the Engine Room door (the calm glance only fires on a strained budget). Reuses the same read fn.
- **Public status page / posted SLA** — outward-facing, founder-gated (the internal operator view is not).
- **Per-surface SLOs** — the `SloConfig` type already isolates the target so a per-surface override is a one-line change when the data warrants it.
- **Alerting** — turning an `exhausted` budget into an Attention/incident nudge (ties into R3 / P7), once the operator surface lands.

## Related

- Gap source: [`../planning/considerations.md`](../planning/considerations.md) (SRE / Platform / Reliability lens, P1).
- Sibling: [`app-health.md`](./app-health.md) (liveness/readiness); [`p7-incidents.md`](./p7-incidents.md) + [`r3-notifications.md`](./r3-notifications.md) (where alerting would surface).
- Board: `RELIABILITY-SLO` (row 152) in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md).
- Build log: [`../../plan.md`](../../plan.md) §4.
