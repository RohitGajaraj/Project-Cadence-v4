# RUNAWAY-DETECT — runaway / loop mission detector

> _Created: 2026-06-21 (lane 1). Status: ✅ detector + read fn + operator surface shipped and **LIVE-VERIFIED on the published app 2026-06-22** (lane 1): clicking the Missions-header reliability glance opens the "Reliability Status" popover, which correctly reads "No spinning missions detected" against the live demo workspace (21 missions, none meeting the runaway thresholds — verified by Playwright). The `getRunawayMissions` live read over `missions`/`mission_steps`/`agent_runs` executes and returns the correct (empty) flagged set; the same detector also powers the RUNAWAY-INCIDENTS source, live-verified on the Engine Room → Incidents tab. Remaining is founder-gated: push alerting (cron → Attention) + auto-pause._

Closes the `considerations.md` AI-safety-lens **P1** gap "Loop/runaway detection" (_"agents can spin; cap + detect"_). KI-15/16 shipped the **caps** (per-tick `MISSION_BATCH` + per-mission step-dispatch bound). This is the **detect** half: surface a mission whose hop / step / retry / spend has blown past those caps so an operator (or a future alert) sees it.

It is the **inverse of E8's stall monitor** (`loop-health.functions.ts`): a stall is too *little* progress (stuck/expired/queue-depth); a runaway is too *much* churn. Together they bracket "the loop is misbehaving," and with RELIABILITY-SLO they form a loop-observability triad.

## What it flags

Per mission, a threshold breach on any of:

- **Hops** — `missions.hop_count` over `maxHops` (default 20).
- **Steps** — `mission_steps` count over `maxSteps` (default 50, well above the small per-tick step-dispatch cap).
- **Retry thrash** — excess retries `(Σ attempts − step count) / step count` over `retryChurnRatio` (default 1, i.e. more retries than steps).
- **Pinned step** — any single step at `attempts ≥ maxStepAttemptsCeiling` (default 3, above the default `max_attempts` of 2 so a normal exhausted retry never trips).
- **Spend** — summed `agent_runs.spend_used_usd` over `maxSpendUsd` (default $5).

**Severity:** `runaway` when a breach is found and the mission is still **active**; `watch` when it breached but is already **terminal** (`done`/`failed`/`cancelled`) — worth a post-hoc look, not a live fire. An **unknown** status is treated as active (fail-loud toward visibility).

## Calibration (why these numbers)

The defaults are **independently-chosen heuristics that sit deliberately above the loop's own enforcement**, so a flag means "well past normal," not "near a cap." There is no hard hop ceiling in the loop (`hop_count` climbs unbounded via a DB trigger), and the real per-mission step-dispatch cap is small and per-tick (`DISPATCH_CAP`, default ~10), so `maxSteps` 50 / `maxHops` 20 only trip on genuine spinning. The per-step signal stays **above** the default retry ceiling: `mission_steps.max_attempts` defaults to 2 (at most 2 dispatches per step), so `maxStepAttemptsCeiling` 3 cannot false-positive on a normally-exhausted retry and only fires once `max_attempts` is raised. The net effect is a deliberately conservative detector: a normal long multi-step mission will not trip it.

## How it works

- **Pure detector** — [`../../src/lib/reliability/runaway.ts`](../../src/lib/reliability/runaway.ts): `assessMission` / `assessMissions` + `isTerminalStatus` / `summarizeRunaway`. Deterministic (the clock is injected as `ageMinutes`) and **total** (zero-step missions, unknown status, NaN/negative aggregates all yield a defined verdict; no divide-by-zero). Fully unit-tested (`runaway.test.ts`, 18 cases).
- **Read-only server fn** — `getRunawayMissions({ days? })` in [`../../src/lib/reliability.functions.ts`](../../src/lib/reliability.functions.ts): scans the caller's recent missions (capped at 200, with a `truncated` flag), fetches the children (`mission_steps`, `agent_runs`) for **only those mission ids**, folds them into per-mission stats, and runs the detector. User-scoped (`.eq('user_id', userId)` on the missions query; the child fetches `.in('mission_id', ids)` over the user's own ids only). No writes, no agent calls, no AI spend, no loop/chokepoint edits.

## Governance & guardrails

- Read-only over existing tables; the loop is never mutated (KI-15/16 own enforcement; this only observes).
- Distinct from `loop-health.functions.ts` (stall, the inverse) and `governance.functions.ts` (the *control* side: kill-switch, caps, approvals). This is the only surface that flags *runaway* behavior.

## Verification

- `bunx tsc --noEmit` clean; `bun --bun run build` green; `bun test` 427 pass (18 new).
- The detector is behaviorally complete and verified offline. The read fn's live query verifies on the founder's next publish (the lane's ◐ convention; DB MCPs intermittent this session).

## Wired into the UI (2026-06-21)

A calm, silent-when-healthy `ReliabilityGlance` ([`../../src/components/cockpit/ReliabilityGlance.tsx`](../../src/components/cockpit/ReliabilityGlance.tsx)) on the Missions header consumes `getRunawayMissions` (alongside `getReliabilitySlo`) and surfaces `summarizeRunaway` (e.g. "2 missions are spinning") **only** when a `runaway`-severity mission exists. Silent otherwise, per the engine-room-doctrine. Gated through `impeccable`. ◐ renders on the founder's next publish.

## Wired into the Incidents log (RUNAWAY-INCIDENTS, 2026-06-21)

A spinning mission now also lands in the operator's persistent "what went wrong" record: `getIncidentsInternal` ([`../../src/lib/incidents.functions.ts`](../../src/lib/incidents.functions.ts)) gained a **`runaway`** incident source (and `IncidentKind` gained `"runaway"`, with a `KIND_LABEL` entry the type system forces). It scans the 200 most recent user missions (no age floor, so an old still-active spinner is caught), runs the detector, and emits an incident **only** for `runaway` severity (a terminal-but-breached mission is `watch` and excluded, so the historical log is not flooded). The id is stable (`runaway:<missionId>`). The mission→stats fold was extracted into a shared pure `buildMissionStats` in [`../../src/lib/reliability/runaway.ts`](../../src/lib/reliability/runaway.ts), so this source and `getRunawayMissions` cannot drift. Live-recomputed (non-persisted), like the approval/guardrail/budget sources.

## Out of scope / follow-ups

- **Drill-in** — a list view of the flagged missions with their `reasons[]` behind the Engine Room (the calm glance only shows the count).
- **Push alerting** — a cron that turns a `runaway` verdict into an Attention (R3) nudge proactively (the incidents source above is pull, surfaced when the operator opens the log).
- **Auto-pause** — optionally feeding a confirmed runaway into the kill-switch / per-mission cancel (D4); enforcement is founder-gated.

## Related

- Gap source: [`../planning/considerations.md`](../planning/considerations.md) (AI / autonomous-agent safety lens, P1; also Loop/runaway under SRE).
- Siblings: [`reliability-slo.md`](./reliability-slo.md) (SLO/error budget) · `loop-health.functions.ts` (stall, the inverse) · [`p7-incidents.md`](./p7-incidents.md) + [`r3-notifications.md`](./r3-notifications.md) (where alerting would surface) · [`d4-mission-cancellation.md`](./d4-mission-cancellation.md) (the brake).
- Board: `RUNAWAY-DETECT` (row 153) in [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md).
- Build log: [`../../plan.md`](../../plan.md) §4.
