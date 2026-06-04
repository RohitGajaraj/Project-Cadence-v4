## Next up: Bundle 4 — Agent-to-Agent handoff (E1–E5)

This is the next item per the Live status board and Build-order rollup. It's the **hardest and highest-leverage** bundle on the roadmap because it's where claim **C2 ("agent-to-agent handoff is first-class — no human in the routing path")** becomes literally true. Today every mission is a single agent's loop; after this bundle, the Orchestrator can spawn specialists, pass a mission through Discovery → Strategist → Builder with structured handoffs, and run multiple missions in parallel without cross-bleed.

I'll do this in **one shippable slice** that proves the spine end-to-end, then iterate. Scope:

### What ships

1. **E1 — Sub-agent spawning.** Orchestrator role can spawn ephemeral specialist agents per task. Spawned agents inherit the chokepoint, the user's tool allow-list, the workspace brief, and the parent run's autonomy/approval rules. Lifecycle: `spawn → work → retire`, all rows in the same trace.

2. **E2 — Internal A2A messaging.** New `agent_messages` table (one row per inter-agent message: `mission_id`, `from_agent_id`, `to_agent_id`, `kind` ∈ `handoff|request|response|broadcast`, structured `payload jsonb`, `parent_message_id`, ordering). Messages are **structured artifacts**, never prompt-stuffed strings — the receiving agent reads `payload` fields directly. Loop guard: max depth + per-mission message cap.

3. **E3 — Agent transfer / handoff.** A new `mission` concept (`missions` table) groups multiple `agent_runs` under one operator intent. The `agent.handoff` agentic tool transfers a mission from agent A to agent B with: full prior context (brief + prior structured outputs + memory pointers), a typed handoff record, and zero re-derivation. Receiver's first step's system prompt includes a `--- Handoff from {agent} ---` block built from the structured payload (same pattern as the brief block).

4. **E4 — Parallel sub-agents.** Orchestrator can spawn N specialists on the same mission concurrently (e.g. Discovery + Competitive-scan in parallel before Strategist). Shared mission context; results merged by the Orchestrator's next step. Reuses the backpressure cap from FND-RUNTIME 0.9.

5. **E5 — Parallel agent sessions.** Multiple missions across workspaces run at once with isolation. Already half-true from 0.9's per-workspace concurrency cap; this just adds explicit `mission_id` scoping in the sweeper and per-mission rate limits.

### Trust/autonomy integration (closes the loop with what we just shipped)

Handoffs respect the **receiver's** autonomy arc. Observing-arc receivers force `review` on the handoff itself (operator sees the structured payload before the next agent starts). Trusted/Ambient pass through inline. Hard-locked tools on the receiver remain `confirm`.

### UI

Minimal in this slice — the proof is the trace, not new pages:
- **Traces page:** render the agent hops as a vertical timeline with `from → to` chips and a collapsible structured-payload viewer per message. Each hop links to its own `agent_run`.
- **Agents page:** add a small "Recent handoffs" count next to each agent (read-only).
- Full Mission Graph DAG (**E6**) is **deferred to Bundle 5** — that's the next bundle after this one.

### Server-side changes (the meat)

- New migration: `missions`, `agent_messages` tables (both RLS-scoped to `auth.uid()` via workspace membership, with the standard four-step grant/RLS pattern).
- `agent_runs` gains `mission_id` (nullable for back-compat — existing single-agent runs stay valid).
- New `src/lib/ai/handoff.server.ts`: `createMission`, `handoffMission(missionId, fromAgent, toAgent, payload)`, `loadHandoffContext(runId)`, `renderHandoffBlock(payload)` — mirrors the brief-block pattern.
- New agentic tools in `TOOL_REGISTRY`:
  - `agent.spawn` (write, `confirm` default) — Orchestrator-only; spawns a specialist sub-agent with a scoped task.
  - `agent.handoff` (write, mode resolved by receiver's arc) — passes the mission forward with a typed payload.
- `loop.server.ts`: when a run starts with a `mission_id`, prepend the `renderHandoffBlock` from the most recent inbound `agent_messages` row to the system prompt (after the brief, before memory recall).
- New server fns `src/lib/missions.functions.ts`: `getMission`, `listMissionHops`, `listAgentMessages(missionId)` — feeds the trace UI.
- `/api/public/hooks/resume-runs` sweeper extended to advance queued missions (next-agent-in-handoff) once the prior run completes.

### Verification (success criteria — must all pass before the bundle is "done")

1. Operator dispatches Orchestrator with intent "draft a PRD for X". Orchestrator spawns Discovery → reads signals → emits structured handoff payload → Strategist receives payload (visible in its first system prompt) → drafts PRD → handoff to PRD Writer → writes PRD. **Three hops, zero operator intervention** in the routing path (only governance gates).
2. The full chain is replayable from `/traces`: one mission, three `agent_runs`, two `agent_messages` rows, structured payloads visible.
3. Receiver-arc gating works: setting Strategist to Observing forces the handoff into the Decision Queue before Strategist runs.
4. Two missions started concurrently in the same workspace both complete without cross-bleed (`mission_id` scoping verified).
5. Brief block + handoff block both appear in the receiver's first step's system prompt (brief first, handoff second).

### Docs to update in the same unit of work (closed loop)

- `docs/feature-backlog.md` — flip E1–E5 to ☑, advance status board to Bundle 5 (E6 Mission Graph), Recent log entry.
- `plan.md` §4 — one-line build-log entry.
- `architecture/orchestration.md` — new "A2A handoff" section: mission model, message shape, handoff-block injection point, arc-gated transfer.
- New `docs/a2a-handoff.md` — canonical doc: mission vs run, structured payload contract, handoff lifecycle, operator playbook (how to pause/redirect a mission mid-flight).

### Out of scope (explicitly, to keep this shippable)

- E6 Mission Graph DAG view — **Bundle 5**, next.
- External MCP/A2A interop (Q1–Q2) — different bundle, much later.
- Auto-merge/auto-deploy in the receiver chain — Builder still uses existing `confirm` tools.
- Multi-product portfolio view (B3) — orthogonal.

### Open question for you before I start

The default behavior when a sub-agent **fails** mid-handoff — should the mission:
**(a)** auto-retry with the same agent (bounded, e.g. 2 attempts), then escalate to the Decision Queue, or
**(b)** go straight to the Decision Queue on first failure so the operator decides whether to retry, hand off to a different agent, or abandon?

I'd lean **(b)** for the MVP — it matches "agents do, humans govern at the decision points" and avoids burning budget on confused retries — but it's a real product choice. Pick one and I'll build to it.
