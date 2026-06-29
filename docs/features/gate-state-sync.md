# BLD-GATE-SYNC — truthful human-gate state for missions & approvals

> _Created: 2026-06-29 (Lane 2). Status: ✅ code shipped + gate-green + adversarially reviewed (3 lenses, 0 findings, ship); live data reconciled. Activation is automatic — the existing per-minute `resume-runs` and `approvals-tick` crons carry it. No migration, no AI spend, no frozen-core edits._

## The problem (found against the live DB)

A mission driven by a single agent run that **pauses on a HITL gate** (e.g. `studio.commit`) stayed `missions.status='running'` forever. `advanceMissionCore` only syncs missions that have a `mission_steps` DAG, and the frozen AI core (`loop.server.ts`) marks the **run** `waiting_approval` without touching the parent mission. The Delegate Desk maps mission status to a lane (`laneForStatus`: `running → working`, `blocked → needsYou`), so the mission sat in **"working"** — the operator was never told *they* were the blocker. This is the felt "why is the loop idle?" bug.

Live evidence: mission `0d0db176` was `running` for **88 hours**, 0 steps, one run `waiting_approval` on a pending `studio.commit`. Separately, a `failed`+decided `studio.stage` approval kept `escalation_state='pending'`, so it haunted every Needs-You surface (Today / governance read `escalation_state`, not `status`) as a phantom the operator could never clear.

Root cause of both lives in the **frozen** AI core, so the fix is **deterministic reconciliation in the existing cron sweepers** — the Kubernetes-controller pattern this codebase already uses (KI-02/KI-15/KI-16/KI-17, RUNAWAY-DETECT, RELIABILITY-SLO).

## What it does

Pure engine — [`src/lib/reliability/gate-state.ts`](../../src/lib/reliability/gate-state.ts), 21 unit tests, no DB / no publish / total (never throws):

- **`classifyMissionGate(mission, runStatuses, pendingGateCount) → 'block' | 'unblock' | 'none'`** — symmetric, mutually-exclusive on a single gate state:
  - `block`: a `running`/`in_progress` mission whose work is fully parked on a pending human gate (≥1 run `waiting_approval`, ≥1 genuinely-pending gate, and **no** run still progressing — fan-out safe). → set `blocked`.
  - `unblock`: a `blocked` mission no longer gate-blocked (operator decided / runs terminal). → set `running` so the existing resume + `maybeCompleteMission` flow re-engages.
  - The `approved`-but-unexecuted window maps to `running`/working (the human decided; it is the system's turn), not needs-you.
- **`needsEscalationResolve(approval) → boolean`** — true when an approval is decided/terminal (`decided_at` set, or status in executed/denied/failed/cancelled/approved/resolved) but still flagged `pending`/`expired`. Deliberately leaves a consistently auto-expired row (`status='expired'` + `escalation_state='expired'`, undecided) alone.

Wiring (deterministic, idempotent, CAS-guarded):

- [`resume-runs.ts`](../../src/routes/api/public/hooks/resume-runs.ts): **un-block pass FIRST** (before runs resume — `maybeCompleteMission` only finalizes `running`/`in_progress`), **block pass LAST** (after advance + KI-17 replan, so a mission that progressed this tick is never blocked). Both updates are conditional (`.eq("status","blocked")` / `.in("status",["running","in_progress"])`) so overlapping ticks and mid-tick finalizes are safe no-ops.
- [`approvals-tick.ts`](../../src/routes/api/public/hooks/approvals-tick.ts): a reconcile pass clears stale `escalation_state` → `resolved` for decided-but-flagged approvals, narrowed DB-side by `.neq("status","pending")` and gated by `needsEscalationResolve`, so a genuinely-pending gate is never hidden and the auto-expire pairing is never undone.

## Why the invariant holds (the load-bearing detail)

`maybeCompleteMission` (`handoff.server.ts`) finalizes a mission only `.in("status", ["running","in_progress"])`, and the resume sweeper resumes runs by their **own** status, independent of mission status (documented in `missions.functions.ts`). So a mission must be flipped back to `running` **before** its run resumes/completes — hence the un-block pass runs first. A mission can therefore never get permanently stuck `blocked`: the tick the gate is decided, un-block fires and the normal completion path takes over.

## Scope boundary

This is **orthogonal to BLD-RELIABILITY** (closed 2026-06-29 — *Cadence governs, OpenHands builds; don't invest in in-house codegen*). BLD-GATE-SYNC does not touch codegen; it makes the human-gate state truthful for **any** mission (in-house or delegated). It does not edit the pinned AI core (`loop.server.ts` et al.).

## Verification

- `tsc` 0 errors; `bun test src/lib/reliability/` 78 pass; full suite 1633 pass / 0 fail.
- Adversarial review (3 distinct lenses — deadlock/liveness, race/idempotency, surfacing-truth — + Opus synthesis): **0 findings, ship**.
- Live data: the 88h mission `0d0db176` was cancelled (mirroring the app's `cancelMission` cascade); the remaining live phantom approvals are decided+flagged and self-heal on the next `approvals-tick` after deploy.

## Known follow-ons (non-blocking, noted by review)

- `pendingGatesOf` is mission-scoped while resume-resumability is run-scoped: an orphaned `status='pending'` approval on a dead run could delay an un-block by ~1 tick (self-healing; pre-existing out-of-scope data condition).
- A second live stuck "Studio work order" (`057e8e8f`) is an instance of the in-house-builder `studio.stage` failure (BLD-RELIABILITY won't-fix territory); surfaced to the founder, not auto-cancelled.
