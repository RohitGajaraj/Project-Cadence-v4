# ENG-06 — Cost per outcome

> _Created: 2026-06-17 · Last updated: 2026-06-19_

> The Engine-Room-Doctrine-safe answer to "how much are the agents consuming." Split across two surfaces by audience: a calm **cost-per-outcome line** on Today for the PM, and a **unit-economics roll-up** behind the Engine Room door for the operator. Born from the 2026-06-17 "agent manager" framing decision ([`../strategy/session-decisions.md`](../strategy/session-decisions.md)).

**Engine-Room:** per-run AI spend + outcome counts -> calm front shows one "shipped this week for $X" line on Today -> full per-window cost-per-outcome lives behind Engine Room > Analytics.

## What it does

Frames AI spend as value, not telemetry. The PM sees what they GOT for what they spent ("Shipped this week — 3 specs · 2 decisions · 1 shipped for $4.20"), never raw tokens or API calls. The operator who opens the Engine Room gets the deeper unit economics for the selected window: total attributed agent spend, the outcome breakdown, and a blended cost-per-outcome.

## Why it exists

The founder's instinct to make the "agent manager" role explicit was right, but a literal "Agent Manager" dashboard of cost/API/efficiency on the calm front is the doctrine's named anti-pattern ("control-room creep"). This is the doctrine-compliant expression: outcome-framed and light on the front, deep and on-demand behind the one door. Build log: [`../../plan.md`](../../plan.md) §4 (2026-06-17, Part B).

## Where to find it

- **Calm front (Today):** Today (`/`), inside the "This week" PULSE bento — a single line under the rate vitals. Renders only when there is something to show (no outcomes and no spend = silent).
- **Calm front (Missions):** the Missions header (`/missions`) — the B2 "manager's glance" line, same data, framed for the fleet. Same silence rule.
- **Engine Room:** `/govern?tab=analytics`, a "Unit economics · {range}" bento above "Spend by surface." Renders only once outcomes exist in the window.

## Demo script (≤ 90s)

1. Open **Today**. Under "This week," point to the cost-per-outcome line: "this is value, not a meter — what shipped, then what it cost."
2. If a monthly budget is set, note the trailing "$X of $Y this month" context.
3. Open **Engine Room → Analytics** (Trust row → Engine Room → Analytics tab). Switch the range (24h / 7d / 30d / 90d).
4. Point to **Unit economics**: agent spend, the specs · decisions · shipped breakdown, and **cost per outcome**. "Same truth as the front line, with the operator depth."

## How it works

- **Calm front** — `getCostPerOutcome` ([`../../src/lib/cost-per-outcome.functions.ts`](../../src/lib/cost-per-outcome.functions.ts)): trailing-7-day counts of `prds`, `decisions`, completed `missions`; summed `agent_runs.spend_used_usd`; month-to-date used/cap from `ai_budgets`. Rendered by `CostPerOutcomeChip` ([`../../src/components/today/CostPerOutcomeChip.tsx`](../../src/components/today/CostPerOutcomeChip.tsx)).
- **Engine Room** — `getUnitEconomics({days})` in [`../../src/lib/analytics.functions.ts`](../../src/lib/analytics.functions.ts): summed agent spend over the window divided by total outcomes (specs + decisions + missions). The cost-per-outcome denominator is **blended across outcome types on purpose** — per-type spend attribution would over-claim precision the data does not support. Rendered in [`../../src/components/observe/AnalyticsPanel.tsx`](../../src/components/observe/AnalyticsPanel.tsx).
- Both reuse the existing TanStack server-fn pattern (`createServerFn` + `requireSupabaseAuth`); no migration, no new AI infrastructure.

## Governance & guardrails

- Read-only over existing tables. All queries are user-scoped (explicit `user_id` filter on the front fn; RLS on the analytics fn, matching its sibling `getAnalyticsOverview`).
- No writes, no agent calls, no spend incurred by the feature itself.

## Verification checklist

- `bunx tsc --noEmit` is clean (the real type gate; `bun run build` strips types).
- `bunx eslint` clean on the four changed/added source files.
- Today: with a workspace that has shipped specs/decisions/missions in the last 7 days, the line shows real non-zero counts and a real `$` spend; a fully quiet week renders nothing.
- Engine Room → Analytics: the Unit economics bento appears once outcomes exist; cost per outcome reconciles as agent spend ÷ outcomes for the selected range.

## Known limits / out of scope

- **B2 (Missions "manager's glance") shipped FE cycle 5 (2026-06-20):** `MissionsCostGlance` ([`../../src/components/cockpit/MissionsCostGlance.tsx`](../../src/components/cockpit/MissionsCostGlance.tsx)) renders a calm one-line cost-per-outcome glance ("This week the fleet shipped N specs · N decisions · N shipped for $X") on the Missions header (`_authenticated.missions.index.tsx`), reusing `getCostPerOutcome` via the shared `["cost-per-outcome"]` query cache (no extra fetch) and staying silent on a quiet week. Doctrine-safe (one outcome-framed line, not a control-room panel). It is intentionally near-identical to the Today chip but a dedicated component, to leave the Today surface untouched. ◐ live-verify on the next publish. All 3 B-slices (B1 front chip + B2 Missions glance + B3 Engine Room roll-up) are now built.
- Cost per outcome is **blended**, not per-type attributed (deliberate; see How it works).
- Front line uses a trailing-7-day window for outcomes/spend and a month-to-date window for the budget context; the two windows are labeled distinctly to stay honest.
- **Build is green; one environment caveat.** `tsc --noEmit`, eslint, and the production build all pass — but the build must run under bun's runtime (`bun --bun run build` → `✓ built`) or Node ≥ 20.19 / ≥ 22.12. Plain `bun run build` on **Node 20.9.0** (this environment) fails at config load with `ERR_REQUIRE_ESM`, because Lovable's CJS config wrapper now `require()`s the ESM-only `lovable-tagger@1.2.0` and old Node cannot `require()` an ES module. Pre-existing and unrelated to this feature (reproduces on clean `HEAD`; `vite.config.ts` untouched). The hosted UI walkthrough waits on the next publish, as usual.

## Related

- Decision + reasoning: [`../strategy/session-decisions.md`](../strategy/session-decisions.md) · [`../strategy/strategic-inputs-log.md`](../strategy/strategic-inputs-log.md) (2026-06-17 "year of the agent manager") · [`../strategy/v9-decision-wedge-and-build-next.md`](../strategy/v9-decision-wedge-and-build-next.md) §2.
- Doctrine: [`../conventions/engine-room-doctrine.md`](../conventions/engine-room-doctrine.md).
- Backlog: `ENG-06 / F-GOV-COST-SURFACE` in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md) and [`../planning/feature-backlog.md`](../planning/feature-backlog.md).
- Build log: [`../../plan.md`](../../plan.md) §4.
