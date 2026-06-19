# F-AGENT-4: Swarm HUD

> _Created: 2026-06-06 · Last updated: 2026-06-14_

> **Status:** ✅ Shipped 2026-06-06 · **Route:** `/swarm` · **Owner agents:** all (read-only HUD)

## What it does

The Swarm HUD is a single live screen that answers, without tab-hopping, what every agent is doing right now, which missions are advancing or stalled, what is waiting on the operator, what the event reactor just fired, and where the swarm spent its time, tokens, and money in the last hour. It is the governor's cockpit for a multi-agent workforce. Read-only by design: the only writes are the four buttons that already exist elsewhere (Approve / Reject / Dispatch / Skip), reused unchanged.

## Why it exists

F-AGENT-1 made Cadence plan, F-AGENT-2 made it learn, F-AGENT-3 made it react. Together they produce far more concurrent activity than the operator can track from `/missions`, `/inbox`, `/agents`, and `/governance` separately. The HUD closes the agent-ecosystem bundle by giving governance one screen that scales as the swarm scales. Full rationale: [`../../plan.md`](../../plan.md) §4 entry dated 2026-06-06 (F-AGENT-4).

## Where to find it

- **Nav:** sidebar → **Agents** group → **Swarm HUD** (between Missions and Prompt Studio).
- **Route:** `/swarm` (gated by the `_authenticated` layout).
- **Panels (top to bottom):**
  1. **Header**: live agent count, missions-in-flight count, last-refresh stamp.
  2. **Throughput strip (last hour)**: total AI calls, total cost, p50 latency, 5-minute sparkline, plus a guardrail-hit count.
  3. **Attention queue**: pending `agent_approvals` and pending `confirm`-mode `event_queue` rows. Each row has inline Approve/Reject or Dispatch/Skip buttons that call the same server fns `/inbox` and `/governance` use.
  4. **Agents grid**: one card per agent: status pill, current input excerpt, step index, trust arc, "Open mission" jump.
  5. **Missions in flight**: table of `missions` with status `planning` / `running` / `completed_with_failures`, or completed in the last hour. Each row shows step progress (`done/total`) with a bar, click to jump to `/missions/$id`.
  6. **Handoff feed**: last 50 `agent_messages` rows (the A2A wire format), newest first, with `from → to · kind` and the task excerpt. Click to jump to the mission.
  7. **Reactor firings**: last 50 `event_queue` rows with `event_type → target_agent_slug`, mode, status; mirror of `/governance` Reactor activity.

## Demo script (≤ 90 seconds)

1. Sign in as `demo@redcadence.app` (see [`../operations/demo-credentials.md`](../operations/demo-credentials.md)).
2. Click **Agents → Swarm HUD** in the sidebar.
3. "This is the governor's cockpit. Every panel refreshes every two seconds."
4. Point at the **Throughput strip**: "Last hour the swarm made N AI calls for $X at p50 Yms, and we caught Z guardrail hits."
5. Point at the **Attention queue**: "Anything pending my judgment shows up here. I can Approve, Reject, Dispatch or Skip without leaving this screen."
6. Point at the **Agents grid**: "Every agent: current task, trust arc, what step they're on. Click any card to drop into the mission graph."
7. In a second tab, on `/missions`, launch a quick orchestrated mission (any short goal). Switch back to `/swarm`. "Watch the orchestrator card flip to `running` and the **Handoff feed** pick up the dispatches within one refresh tick."
8. Point at **Reactor firings**: "And here's the event reactor: every signal, opportunity, or PRD approval the system reacted to, with the agent it routed to."

## How it works

- **Route:** `src/routes/_authenticated.swarm.tsx`, TanStack Query with `refetchInterval: 2000` on a single server fn, suspense + error + not-found boundaries.
- **Server fn:** `getSwarmHud()` in `src/lib/swarm.functions.ts`. One round-trip; every query fires in parallel with `Promise.all`; all reads are RLS-scoped to `auth.uid()` and (where relevant) the current workspace via the `current_user_default_workspace` RPC.
- **No new tables, no new tools.** All data is read from existing sources:
  - `agents` + `agent_runs` (latest non-terminal run per agent, prioritised `running > paused > queued > terminal`) + `agent_autonomy` (arc).
  - `missions` filtered to `planning | running | completed_with_failures` OR `completed_at >= now() - 1h`; joined to `mission_steps` for `done / total / failed` counts.
  - `agent_messages` last 50 (the A2A wire format from `architecture/orchestration.md`).
  - `agent_approvals` WHERE `status = 'pending'` (same shape as `/inbox`).
  - `event_queue` last 50 (same shape as `/governance` Reactor activity).
  - `ai_events` last 60 minutes, bucketed in JS into 5-minute windows for the sparkline.
  - `guardrail_hits` count last hour.
- **Writes:** the HUD does not own any mutations. Approve / Reject calls `resolveApproval` from `src/lib/governance.functions.ts`. Dispatch / Skip calls `decideEventDispatch` from `src/lib/reactor.functions.ts`. Both invalidate the `["swarm","hud"]` query key on success.
- **Components:** the page composes section components inline (`ThroughputStrip`, `AttentionQueue`, `AgentsGrid`, `MissionsTable`, `HandoffFeed`, `ReactorFirings`), small, focused, in one file.

## Governance & guardrails

- **RLS:** every query is filtered by `user_id = auth.uid()` (and `workspace_id` where the table is workspace-scoped). A second account in a different workspace sees only its own swarm.
- **Approval modes preserved:** the HUD never bypasses an approval gate. Approve/Reject and Dispatch/Skip go through the same server fns as the existing surfaces, which enforce arc-gating and ownership checks.
- **Kill-switches:** the workspace-level pause set on `/governance` continues to apply. The HUD only observes; it does not start runs.

## Verification checklist

1. Navigate to `/swarm`; page renders with the seven panels listed above.
2. Open the browser network panel: a single request to `getSwarmHud` every ~2s, no per-panel waterfall.
3. Start an orchestrated mission from `/missions`. Within one refresh tick (≤ 2s), the orchestrator's card flips to `running` and a row appears in **Missions in flight**.
4. Confirm the **Handoff feed** picks up a row with the correct `from → to` slugs and a mission link that lands on `/missions/$id`.
5. Trigger a pending approval (or use a seeded one), and it appears in the **Attention queue** with Approve/Reject buttons that succeed and clear the row.
6. If a `confirm`-mode reactor row is pending, it appears in **Attention queue** with Dispatch/Skip; both succeed.
7. The **Throughput strip** count and sum-cost match a direct SQL spot-check on `ai_events` for the last hour for that `user_id`.
8. Sign in as `demo2@redcadence.app`, and the HUD shows only that workspace's agents/missions/queue rows (RLS holds).

## Known limits / out of scope

- **Read-only HUD.** No new write surfaces beyond the four reused buttons. Pause/steer-from-graph remains on `/missions/$id` (still deferred per the orchestration deferred list).
- **Workspace-scoped only.** No cross-workspace aggregate (matches every other Cadence surface).
- **Throughput strip uses `est_cost_usd` at ingest time.** No retro-priced re-calculation.
- **`agent_autonomy` does not yet track a `trust_score` column.** Only the arc (Observing → Proving → Trusted → Ambient) is shown.
- **No new index.** If `getSwarmHud()` p50 climbs above ~200ms on a large workspace, add covering indexes on `agent_messages(created_at desc)` and `event_queue(created_at desc)`.

## Related

- [`../../plan.md`](../../plan.md) §4: 2026-06-06 F-AGENT-4 entry
- [`../../architecture/orchestration.md`](../../architecture/orchestration.md): agent orchestration contract (Swarm HUD bullet)
- [`../planning/feature-backlog.md`](../planning/feature-backlog.md): F-AGENT-4 ledger row
- [`./f-agent-1-orchestrator.md`](./f-agent-1-orchestrator.md), [`./f-agent-2-memory-reflection.md`](./f-agent-2-memory-reflection.md), [`./f-agent-3-event-reactor.md`](./f-agent-3-event-reactor.md)
- [`./trust-and-autonomy.md`](./trust-and-autonomy.md): what the arc pills on the Agents grid mean
- [`./a2a-handoff.md`](./a2a-handoff.md): the contract behind the Handoff feed
