# D4 (cancellation slice) - the per-mission brake pedal

> _Created: 2026-06-18 · Last updated: 2026-06-18_

**Status:** ✅ Shipped (cancellation 2026-06-18; replay-and-branch 2026-06-18 cycle 25; the rich replay-vs-original checkpoint-diff D4b 2026-06-22). **Lane:** G2 Decide & Plan / autonomous-spine control. **Pairs with:** [`trust-and-autonomy.md`](./trust-and-autonomy.md) (FND-0.6 kill-switch is the global brake; this is the per-mission brake).

## What it delivers

A "Cancel mission" control on the mission detail page (`/missions/$missionId`). When a mission is still active, the operator can stop it: it will not advance further, its in-flight steps and child runs stop, any held Build file locks release, and its pending approvals clear. Work already done is kept; the mission reads `cancelled` (not `failed`, not `completed`). This is the honest mid-run brake that complements the global kill-switch.

D4's full scope is "cancellation + replay-and-branch + checkpoint-diff". The cancellation and replay-and-branch halves are shipped (below). The rich checkpoint-diff (side-by-side original vs replay) remains as D4b.

## Replay-and-branch (cycle 25)

Re-run a finished mission's goal as a NEW mission, optionally with a different model. On `/missions/$missionId`:

- A **model picker + "Replay" button** in the header for a terminal, non-failed mission (completed / cancelled). Failed/halted missions keep the contextual "Replay" button in the failure panel (default model).
- Both call `startOrchestratedMission({ goal, title, model, replayedFrom: missionId })`. The server already accepted `model` (it threads to `runAgentLoop`); D4 added `replayedFrom`, which it writes to the new mission's `replayed_from_mission_id` in a separate, pre-migration-tolerant update (so chat's `createMission` path is untouched and the replay still runs if the column is not there yet).
- The new mission shows a **"Replayed from an earlier mission"** link (back to the parent). `getMission` resolves `replayed_from_mission_id` in a separate error-tolerant read, so the detail page keeps working before the migration applies.
- **Migration** `20260618160000_d4_replay_branch_link.sql`: `missions.replayed_from_mission_id uuid REFERENCES missions(id) ON DELETE SET NULL` + a partial index. Additive, idempotent, zero behavior change on apply; `ON DELETE SET NULL` so deleting an original never orphans or cascades into its replays.

Replay re-plans from the goal via the orchestrator (a fresh DAG), so a different model affects both planning and execution: the natural way to A/B a goal across models. The branch link is the lightweight diff affordance (open both missions); the rich side-by-side checkpoint-diff is D4b.

## How it works (and why it needs no loop surgery)

The autonomous loop already gates on status, so cancelling is a pure state transition, not a change to the loop:

- The auto-advance tick selects missions with `.in("status", ["running","in_progress"])` and `advanceMissionCore` early-returns for any non-running mission (`mission-advance.server.ts`). A `cancelled` mission is simply never advanced.
- The resume cron (`api/public/hooks/resume-runs.ts`) resumes individual `agent_runs` by their own status (`queued` / `running` / `waiting_approval`), independent of the mission. So cancelling the mission alone is not enough: we must also flip this mission's in-flight runs to `cancelled`, or the cron keeps resuming orphaned children. This is the one cascade that is required for correctness, not cosmetics.

### `cancelMission({ missionId })` (`src/lib/missions.functions.ts`)

1. Load + guard (RLS-scoped). A terminal mission (`completed` / `done` / `failed` / `halted` / `cancelled`) returns `{ cancelled: false, alreadyTerminal: true }`.
2. Flip the mission to `cancelled` (+ `completed_at`) **conditionally** with `.not("status","in",(terminal))` so a mission that finishes in the read-to-write window keeps its honest terminal state (no overwriting `completed` with `cancelled`). A null result means it raced to terminal.
3. Flip in-flight `agent_runs` (`queued` / `running` / `dispatched` / `waiting_approval`) to `cancelled` so the resume cron skips them.
4. Flip non-terminal `mission_steps` to `cancelled` (cockpit honesty; the tick never reads a cancelled mission's steps).
5. Release held `builder_file_claims` for the mission (`status='released'`, reason `mission_cancelled`). The DB trigger `release_claims_for_terminal_run` only fires on `completed`/`halted`/`failed`, **not** `cancelled`, so without this the per-(repo,path) locks would orphan and block future builds.
6. Best-effort: cancel `pending` `agent_approvals` tied to the mission's runs (by `run_id`) so a cancelled mission stops asking for sign-off and clears from the Attention feed.

No migration: `missions.status` and `agent_runs.status` carry no CHECK constraint, and `agent_approvals.status` already allows `cancelled`. `StatusBadge` (`Primitives.tsx`) gained a `cancelled` entry so the state renders honestly app-wide instead of falling back to a gray "planned".

## Files

- `src/lib/missions.functions.ts` - `cancelMission` server fn.
- `src/routes/_authenticated.missions.$missionId.tsx` - the Cancel control in the hero (shown only while the mission is active; destructive confirm via `useConfirm`).
- `src/components/cadence/Primitives.tsx` - `cancelled` status badge.

## Verify (live, after publish)

1. Start a mission so it is `running`. Click **Cancel mission** in the hero, confirm. The badge flips to `cancelled`, the Advance button disappears, polling stops.
2. Confirm the cron does not resume it: the mission stays `cancelled` and its runs/steps show `cancelled` (not back to `running`).
3. For a Build mission holding file claims: confirm `builder_file_claims` for the mission are `released` after cancel (a later build on the same paths is not blocked).
4. If the mission had a pending approval, confirm it clears from the Attention feed.

## D4b — replay vs original checkpoint-diff (2026-06-22)

The replay-and-branch leg records a `replayed_from_mission_id` link on every replay. D4b makes that branch legible: on a replay mission, a **side-by-side diff** shows what the re-run changed.

### Pure core — `src/lib/mission-diff.ts`

- `deriveMissionSide(MissionDetail)` rolls one mission into its comparable side: hop count, cost, tokens in/out, total / failed / unattended tool calls, duration (`completed_at - created_at`, null while unfinished), the distinct agent chain, and the final output (last hop that HAS output).
- `alignHops(original, replay)` lines hops up by position, flagging `same-agent`, `output drift`, and `original-only` / `replay-only` presence.
- `diffMissions(original, replay)` returns both sides + `deltas` (always **replay − original**, so a negative cost/duration means the replay was cheaper/faster; the `durationMs` delta is null unless BOTH sides completed, so a still-running replay never reports a false time saving) + `finalOutputChanged`.
- Server-free + totally defined (any field may be missing and it still computes); 11 bun:test cases.

### Surface — `src/components/missions/MissionDiff.tsx`

Rendered on a replay mission (one with `replayed_from_mission_id`), behind a collapsed **"Compare with original"** toggle in the detail body. It fetches the original via the existing `getMission` (RLS-scoped, same caller), runs `diffMissions`, and shows the metric columns with signed deltas, the per-hop drift list, and the "final answer changed" headline. Calm by design (engine-room doctrine): neutral ink + ▲/▼ glyphs carry the signal, `--rose` appears only on a genuine regression (more cost / more failed tool calls than the original). Degrade-silent — a missing/forbidden original renders nothing.

## Not built (D4 remainder)

- Reverse direction: from an ORIGINAL mission, jump to / diff its replay(s) (needs a `replays-of-this-mission` read; the replay→original direction ships here).
- Intra-run step-by-step checkpoint scrubbing (diffing two `agent_run_checkpoints` of the SAME run, vs the mission-vs-mission diff shipped here).
