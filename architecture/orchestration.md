# architecture/orchestration.md — Orchestration & automation layer

> How autonomous missions run: parallel sub-agents, parallel sessions, multi-product isolation, and the automation engine. The second invariant of the system (the first is the chokepoint — [`runtime.md`](./runtime.md)). Rules: [`AGENTS.md`](../AGENTS.md). Data: [`data.md`](./data.md). Auth/tenancy: [`security.md`](./security.md).

## The one rule
**Every autonomous, multi-step workflow goes through one orchestration layer.** Just as every AI call goes through the chokepoint, every *mission* (a goal an agent or swarm executes across steps) goes through the orchestrator. That makes parallelism, approval routing, cost caps, checkpointing, and observability uniform across the whole product.

## Core concepts

| Concept | Definition |
|---|---|
| **Mission** | A goal executed end-to-end (e.g. "discover→spec→plan→build→test→ship feature X"). Has an owner agent, a state machine, a budget, and a trace. |
| **Session** | One running execution of a mission (or sub-mission). Many sessions run in parallel across products. |
| **Orchestrator agent** | Plans the mission, spawns and coordinates sub-agents, routes approvals, manages parallelism. See roster in [`plan.md`](../plan.md). |
| **Sub-agent** | An ephemeral specialist spawned by the orchestrator for a sub-task; inherits the chokepoint, a tool allow-list, and governance; returns its result and is torn down. |
| **Step / node** | A unit of work in the mission DAG (a tool call, an agent turn, an approval gate). |

## Parallelism model
- **Many sub-agents per mission** run concurrently on independent nodes of the mission DAG; results fan back in at join nodes.
- **Many sessions in parallel** across missions and products. Each session is isolated (its own context, memory scope, budget, branch/worktree for build work).
- **Concurrency control:** Postgres advisory locks per resource (e.g. `agent_id`, mission_id) prevent double-execution; the scheduler fans out due work each tick without overlap (carried over from the legacy `agent-tick` advisory-lock fix — see [`plan.md`](../plan.md)).
- **Caps:** per-mission max-steps and max-cost; a session that exceeds caps pauses and routes to approval rather than running away.

## Mission lifecycle (state machine)
`planned → running → (awaiting_approval ⇄ running) → (completed | failed | cancelled)`
- **Checkpoints** persist after each node so a session can resume exactly where it paused (e.g. after an approval).
- **Approval gates** (`auto | confirm | review`) interrupt the machine; the run lands in the Decision Queue; approve resumes from checkpoint.
- **Cancellation** stops a session mid-run and saves the partial trace.
- **Replay-and-branch** re-runs a mission (or a node) against a different model/prompt for comparison.

## Automation engine
- **Triggers:** schedule (`pg_cron` → `/api/public/hooks/*`), event (a signal arrives, a ticket lands, a PR merges), and webhook (external).
- **Workflows:** declarative multi-step definitions binding triggers → missions → approval policy. Saved, versioned, reusable (the "skills/saved-workflow" idea, generalized).
- **Idempotency:** day/event-scoped jobs key on a natural unique tuple so re-fires do not duplicate work.

## Multi-product / multi-workspace isolation
- Every mission, session, sub-agent, memory write, and budget is scoped by `user_id` + `workspace_id` + `product_id`. RLS enforces it at the data layer ([`data.md`](./data.md)); the orchestrator enforces it at the execution layer (a session for Product A can never read Product B's context or spend its budget).
- Workspace = top-level tenancy (a company/client/initiative). Product = a product inside a workspace (A/B/C). Portfolio views aggregate across products the user owns.

## The live orchestration surface
The UI ([`design.md`](../design.md), [`frontend.md`](./frontend.md)) renders the mission DAG live: per-node status, current step, files touched, tool calls, cost, and approval state — with pause / steer / approve controls. This is the "watch the agents build/ship" surface. It reads from `ai_traces` + a `missions`/`sessions` table set and Supabase Realtime.

## Data (new tables this layer needs)
`missions`, `mission_sessions`, `mission_nodes` (DAG edges + state), `workflows` + `workflow_versions`, `automation_triggers`. All RLS-scoped by `user_id` + `workspace_id` + `product_id`. Schema authored via migrations ([`data.md`](./data.md)).

## Invariants
- No multi-step autonomous work outside the orchestrator.
- Every node logs to `ai_traces`/`tool_calls` via the chokepoint.
- Cross-product/session isolation is never bypassed.
- Side-effecting nodes honor the mission's approval policy.

Orchestration change → update this file + [`plan.md`](../plan.md) (see [`AGENTS.md`](../AGENTS.md), section 5).
