# Agent-to-Agent (A2A) Handoff

> Canonical guide to **Bundle 4 (E1–E5)** — the moment Cadence stops being a
> single-agent loop and becomes a multi-agent system. This is where claim
> **C2** ("agent-to-agent handoff is first-class — no human in the routing
> path") becomes literally true.

## What ships

- **Mission** — groups multiple `agent_runs` under one operator intent.
  One row in `public.missions` with title, goal, status, current agent, hop count.
- **Agent message** — one structured A2A payload, one row in `public.agent_messages`.
  Kind is currently `handoff` (others reserved).
- **`agent.handoff` tool** — defaults to `confirm`. From inside a mission an
  agent calls it to enqueue the next hop with a structured payload.
- **Receiver context injection** — when a run starts with a `mission_id`, the
  loop calls `consumeInboundHandoff()` and prepends a `renderHandoffBlock()`
  to the system prompt, immediately after the workspace brief block.
- **`/missions` + `/missions/$id`** — the operator surface: list of missions
  and a hops timeline with collapsible structured payloads.

## Why structured payloads, not pasted prompts

The receiver does not get a giant string of "everything the previous agent
said". It gets a typed JSON payload:

```ts
type HandoffPayload = {
  task: string;                          // headline the receiver should solve
  context?: Record<string, unknown>;     // structured context, free-form
  artifacts?: { kind, id, title? }[];    // stable IDs the receiver reads with its own tools
  open_questions?: string[];             // explicitly left to the receiver's judgement
  constraints?: string[];                // hard limits the receiver must respect
};
```

The receiver re-reads referenced artifacts with its own tools
(`workspace.search`, direct table reads). This keeps tokens low, prevents
drift via game-of-telephone summarization, and means the operator can audit
the exact payload that crossed the wire.

## Lifecycle

```
operator dispatch (asMission=true)
  ↓ runAgent → createMission → runAgentLoop (mission_id set)
Agent A run
  ↓ tool: agent.handoff { to_agent_slug, task, context, artifacts, ... }
  ↓ confirm-gate (unless arc=trusted/ambient — see trust-and-autonomy.md)
  ↓ enqueueHandoff → agent_messages row + queued agent_runs row (same mission_id)
resume-runs sweeper (next tick)
  ↓ resumeAgentLoop(receiver_run_id)
Agent B run
  ↓ consumeInboundHandoff — marks the message consumed_by_run_id
  ↓ renderHandoffBlock injected into system prompt after workspace brief
  ↓ ... receiver can hand off again, or emit final
If no further outbound handoff: maybeCompleteMission marks mission complete.
```

## Failure policy (MVP)

**Option (b):** on hop failure the mission stops at the failed run. The
operator sees it on `/missions/$id` (status `halted`/`failed`) and on
`/traces`, and re-dispatches manually — either retry the same agent, hand
off to a different agent, or abandon. No automatic retry. This matches
"agents do, humans govern at the decision points" and avoids burning budget
on confused agents that just keep failing the same way.

## Trust + autonomy interaction

`agent.handoff` is a `write` tool with default mode `confirm`. The agent's
autonomy arc (`agent_autonomy.arc`) composes with that via
`resolveApprovalMode`:

| Receiver-side intent | Sender's arc | Effective behavior |
|---|---|---|
| Send a handoff (sender's arc decides) | observing | queues a review — operator sees the payload + receiver before anything moves |
| | proving | one-click confirm before enqueuing |
| | trusted | runs inline (handoff enqueued without confirmation) |
| | ambient | runs inline |

The receiver's own tools then run under the receiver's arc. There is no
separate "handoff acceptance" gate — the receiver simply starts its run and
each tool it calls re-passes through its own arc.

## Multi-hop concurrency (E4 + E5)

- Two missions in the same workspace run concurrently up to
  `MAX_RUNNING_PER_WORKSPACE` (5) — see the FND-RUNTIME 0.9 backpressure cap.
  Above that, additional missions sit in `agent_runs.status='queued'` until a
  slot frees up.
- Parallel sub-agents on a single mission are supported by the schema (no
  serial constraint on `agent_messages`) but **not yet** exposed in the UI —
  the registry-level `agent.handoff` tool is one-to-one. A future
  `agent.spawn`-style fan-out tool can land without schema changes.

## Operator playbook

1. **Start a mission** from `/agents`: tick "Start as mission" before
   dispatch. The Orchestrator (or any agent) becomes the starting hop.
2. **Watch hops land** in `/missions/$id`. Hops auto-refresh while the
   mission is `running`.
3. **Inspect a payload** by expanding the `payload` JSON between hops —
   that is exactly what the receiver got.
4. **Pause** by setting the receiver's autonomy arc to `observing` on
   `/agents` — the next inbound handoff will queue for review instead of
   starting a new run.
5. **Redirect** by failing the current hop (reject pending approvals)
   and dispatching a fresh agent on the same mission goal.

## Files

- Schema: `supabase/migrations/<ts>_a2a_handoff.sql`
- Server: `src/lib/ai/handoff.server.ts`, `src/lib/missions.functions.ts`
- Tool: `src/lib/ai/tools/registry.server.ts` (`agentHandoff`)
- Loop: `src/lib/ai/loop.server.ts` — brief + handoff block injection
- UI: `src/routes/_authenticated.missions.tsx`, `src/routes/_authenticated.missions.$missionId.tsx`

## Related

- Trust score + autonomy arcs — `docs/trust-and-autonomy.md`
- Workspace brief block — `src/lib/briefs.functions.ts → renderBriefBlock`
- Orchestration contract — `architecture/orchestration.md`
- Governance & approval gates — `architecture/security.md`
- AI runtime chokepoint — `architecture/runtime.md`
- Feature ticket (Bundle 4 / E1–E5) — `docs/feature-backlog.md`
- Parent index — `docs/README.md`