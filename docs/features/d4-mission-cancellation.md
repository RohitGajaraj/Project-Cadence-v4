# D4 (cancellation slice) - the per-mission brake pedal

**Status:** ◐ Partial (cancellation shipped 2026-06-18; replay-and-branch + checkpoint-diff remain). **Lane:** G2 Decide & Plan / autonomous-spine control. **Pairs with:** [`trust-and-autonomy.md`](./trust-and-autonomy.md) (FND-0.6 kill-switch is the global brake; this is the per-mission brake).

## What it delivers

A "Cancel mission" control on the mission detail page (`/missions/$missionId`). When a mission is still active, the operator can stop it: it will not advance further, its in-flight steps and child runs stop, any held Build file locks release, and its pending approvals clear. Work already done is kept; the mission reads `cancelled` (not `failed`, not `completed`). This is the honest mid-run brake that complements the global kill-switch.

D4's full scope is "cancellation + replay-and-branch + checkpoint-diff". This slice is the cancellation half. Replay (re-run a run with a different model/prompt) and checkpoint-diff are not built yet.

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

## Not built (D4 remainder)

- Replay-and-branch: re-run a completed/failed run with a different model or prompt and diff the result.
- Checkpoint-diff: compare two checkpoints of a run.
