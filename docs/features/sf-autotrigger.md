# SF-AUTOTRIGGER — Governed Signal-to-Action Auto-Trigger

> _Created: 2026-07-01 · Status: ✅ Shipped (lane 1). Activation: set `BRAIN_AUTO_TRIGGER=1` in Lovable project settings._

## What it is

SF-AUTOTRIGGER is the Phase 3 close of the Signal Fabric initiative. It completes the ambient self-initiation loop by letting the system skip the "Review & launch" click for safe, reversible analysis missions — the ones that review signals and cluster feedback — when the workspace is quiet and the daily spend cap has not been hit.

Without it: trigger-tick creates a `proposed` Watch or Listen mission. It sits in the missions queue. The PM clicks "Review & launch." The agent runs.

With it (and `BRAIN_AUTO_TRIGGER=1`): trigger-tick creates the proposed mission, immediately checks four conditions, and if all pass, flips it to `queued`. The resume-runs sweeper picks it up on the next sweep and runs it without any human click.

The HITL path is not removed — it remains the default for any mission that fails the eligibility check. This adds a fast lane for the safe subset, not a bypass for everything.

## The four conditions (all must hold simultaneously)

### 1. `BRAIN_AUTO_TRIGGER=1` — founder's circuit breaker
An environment variable in Lovable project settings. Defaults to OFF (`0` or absent). Set it to `1` to activate auto-promotion. Flip it back to `0` at any time to immediately return to full HITL — no code change, no deploy needed. This is the kill switch.

### 2. `proposal.reversible = true` — only analysis missions
The `TriggerProposal` type carries a `reversible` boolean. In the current policy (`evaluateTriggers` in `src/lib/sensing/trigger.ts`), all Watch-scan and customer-listen proposals are marked `reversible: true`. These are read-only analysis missions — the agent reviews signals and writes a summary. No external write, no code push, no stakeholder message. Future proposals that create PRs, send emails, or deploy code would carry `reversible: false` and would always require the human click regardless of the flag.

### 3. `ambientCount === 0` — ambient arc (not mid-sprint)
Count of missions currently in `running` or `in_progress` status in this workspace. If any mission is actively executing, the workspace is "mid-sprint" and auto-promotion is skipped. This prevents stacking agent runs during an active session. When the active mission completes, the next trigger-tick will re-evaluate (the proposed mission stays open and deduplication will not re-create it, but its status is still `proposed` and the auto-promotion path will retry on the next tick when `ambientCount = 0`).

### 4. `autoTodayCount < AUTO_TRIGGER_DAILY_CAP` — daily spend cap
`AUTO_TRIGGER_DAILY_CAP = 2`. At most two missions per workspace per 24-hour UTC day will be auto-promoted. This bounds the worst-case daily AI spend to ~$0.06 (two Watch/Listen runs at ~$0.03 each). The count is derived at runtime by querying `missions WHERE auto_trigger_source = 'auto' AND updated_at >= today_utc_start`. Within a single tick, the counter increments in memory after each auto-promotion so two proposals in the same tick cannot both slip through under the cap.

## Architecture

```
trigger-tick (every 15 min, pg_cron)
  │
  ├─ evaluateTriggers() → proposals[]         [pure, no I/O]
  │
  ├─ for each proposal:
  │   ├─ INSERT missions (status='proposed')   [TIER 1: HITL path, always on]
  │   ├─ INSERT decisions (status='pending')   [Trust-Ledger receipt]
  │   │
  │   └─ shouldAutoPromote() → bool?           [TIER 2: SF-AUTOTRIGGER]
  │       ├─ flag=1 + reversible + ambient + cap
  │       │
  │       ├─ IF true:
  │       │   ├─ UPDATE missions SET status='queued', auto_trigger_source='auto'
  │       │   └─ UPDATE decisions SET status='approved', rationale += [auto-promoted note]
  │       │
  │       └─ IF false: mission stays 'proposed'; human reviews it normally
  │
resume-runs sweeper (separate cron)
  └─ picks up status='queued' missions → runs agent loop (loop.server.ts)
```

**Key design decision: `loop.server.ts` is not touched.** The promotion is a plain DB status write (`proposed → queued`) in trigger-tick. The agent loop executor treats auto-promoted missions exactly like manually-promoted ones — it does not know or need to know how the mission was queued. This keeps the chokepoint-pinned file unchanged and the auto-trigger logic entirely in the trigger layer where it belongs.

## Trust-Ledger auditability

Every auto-promoted mission produces a verifiable trail:

- `missions.auto_trigger_source = 'auto'` — the column that distinguishes auto-promoted from human-promoted runs.
- `decisions.status = 'approved'` — the Trust-Ledger receipt is auto-approved (not pending).
- `decisions.rationale` — the original rationale from `evaluateTriggers()` plus an appended note: `[auto-promoted: ambient + reversible + cap 1/2]`.
- The `/trust-ledger` surface shows these receipts. A PM auditing "what did the system do without my approval this week" can filter `auto_trigger_source = 'auto'`.

## Activation

1. In Lovable project settings, add environment variable: `BRAIN_AUTO_TRIGGER=1`
2. No deploy needed — the flag is read at runtime on each trigger-tick invocation.
3. The migration `20260701000000_auto_trigger_source.sql` must be applied to add `auto_trigger_source` to the `missions` table (applied on next Lovable publish).

## Deactivation / rollback

Set `BRAIN_AUTO_TRIGGER=0` (or remove the variable). Takes effect on the next trigger-tick — no missions that are already `queued` or `running` are affected. All future proposals revert to the HITL path.

## What stays HITL-gated (unchanged)

- Any mission with `reversible: false` — writes code, sends messages, deploys.
- Any mission when `ambientCount > 0` — workspace is mid-sprint.
- Any mission when the daily cap is hit.
- SF-MCP sourced missions (Phase 3, separate item) — until explicitly scoped.
- All cluster and missed-outcome proposals from `evaluateTriggers()` — these carry no `agentSlug` and their reversibility can be debated; the current policy does not mark them `reversible: true`, so they are HITL-gated regardless of the flag.

## Cost model

| Scenario | Spend |
|---|---|
| Flag OFF (default) | $0.00 — no auto-runs |
| Flag ON, 2 Watch runs/day | ~$0.03 × 2 = ~$0.06/day/workspace |
| Flag ON, cap hit | $0.06 max/day/workspace (hard ceiling) |

## Related files

| File | Role |
|---|---|
| `src/lib/sensing/trigger.ts` | `shouldAutoPromote()` pure policy fn + `AUTO_TRIGGER_DAILY_CAP` constant |
| `src/lib/sensing/trigger.test.ts` | 7 unit tests for `shouldAutoPromote` (all conditions × combinations) |
| `src/routes/api/public/hooks/trigger-tick.ts` | Auto-promotion wiring; ambient + cap queries; the DB status flip |
| `supabase/migrations/20260701000000_auto_trigger_source.sql` | Adds `auto_trigger_source` column to `missions` |
| `docs/features/signal-fabric.md` | Parent spec; Phase 3 section updated |

## See also

- [`signal-fabric.md`](./signal-fabric.md) — the full Signal Fabric architecture (all phases)
- [`ambient-precedent.md`](./ambient-precedent.md) — the ambient arc concept and v11 North Star
- [`../strategy/v11-guiding-star.md`](../strategy/v11-guiding-star.md) — pillar 2: sense continuously; the self-initiation mandate
