# ORCH-DELEGATE: Build as orchestration, not codegen

**Status:** ◐ Linear-dispatch path shipped (lane 3, 2026-06-25). External coding-agent half (BLD-04) is founder-gated.

## What this is

Cadence's role in Build is to **conduct the builders**, not to write code itself. This feature makes that concrete: given an approved PRD with a generated task graph, Cadence dispatches each task to Linear as a governed issue — in dependency order, idempotently, tracked in `sync_mappings`.

## Flow

```
PRD (approved)
  ↓ generateTaskGraph()        — AI decomposes spec into seq-ordered tasks
  ↓ dispatchPRDToLinear()      — NEW: dispatches task graph to Linear
       ├─ validateDispatch()   — must have tasks; max 50
       ├─ findDanglingDeps()   — exclude tasks with broken dep refs
       ├─ topologicalOrder()   — deps created before dependents
       └─ Linear issueCreate   — one issue per task, sync_mappings record
```

## API

**`dispatchPRDToLinear({ prdId, teamId })`** — server function

- Requires Linear connected (Settings → Integrations)
- Requires task graph generated first (`generateTaskGraph`)
- Idempotent: tasks already in `sync_mappings` are skipped (re-dispatch is safe)
- Tasks with dangling `depends_on` references go to `skipped` (not dispatched)
- `sync_mappings` insert failure → task goes to `skipped` (observable via `console.error`)
- Returns `{ dispatched, skipped, alreadyDispatched, totalTasks }`

## Files

| File | Role |
|------|------|
| `src/lib/orchestrator.ts` | Pure logic: validate, dangling-dep detection, topo-sort, priority map |
| `src/lib/orchestrator.functions.ts` | Server functions: added `dispatchPRDToLinear` + `linearGql` helper |
| `src/lib/orchestrator.test.ts` | 23 tests covering all pure logic |

## What's NOT built (gated)

The external coding-agent dispatch (sending to OpenHands/Devin/Claude Code) is BLD-04 and requires the founder's `OPENHANDS_ENDPOINT` + `DELEGATE_OUTBOUND_ENABLED`. The seam (`src/lib/delegate/`) is already built and dormant. Once the founder configures the endpoint, BLD-04 adds the route to call `submitDelegation()` instead of — or alongside — Linear.

## Design notes

- **No duplication**: The Linear GraphQL client pattern mirrors `linear.functions.ts` but is not extracted to a shared module — the two call sites have different concerns (task creation vs. orchestration) and the function is small enough.
- **Idempotency**: Re-dispatch is safe. The `sync_mappings` table acts as the idempotency log.
- **Ordering**: Tasks are emitted in topological dependency order so Linear issues are created with the right sequence. `generateTaskGraph` guarantees `depends_on` only references strictly lower seqs, so there are no cycles.
- **Dangling deps**: Tasks that reference a non-existent seq (e.g. a deleted task) are excluded before dispatch rather than silently mis-ordered.
