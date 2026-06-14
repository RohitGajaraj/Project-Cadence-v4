# Task graph (H1 — PRD → engineering plan)

> Status · Shipped 2026-06-14 (migration `20260614190000` applies on next Lovable sync) · Route `/prds/$id` · Owner: the Planner (Strategist face)

## What it does

The Planner step of the golden path: it decomposes an approved spec (PRD) into a **dependency-ordered engineering task graph** — 4–12 concrete build tasks, each with a 1-line detail, an hour estimate, an owner (agent for code/test/infra, you for decisions/design), a risk flag, and `depends_on` edges. The tasks link to the PRD, so they populate the PRD's "linked tasks" and flow on to Build / Linear.

## Why it exists

Completes the M1 demo path: signals → opportunity → spec → **task graph** → Builder PR + CI. Spec H1 in [`../strategy/v4-feature-map-2026-06-11.md`](../strategy/v4-feature-map-2026-06-11.md); build-log [`../../plan.md`](../../plan.md) §4 (2026-06-14 · H1).

## Where to find it

`/prds/$id` → the **Task graph** card → **Generate task graph**. The button decomposes the spec and renders the tasks dependency-ordered (`#seq · title — detail · Nh · owner · after #n · risk`).

## How it works

- **`generateTaskGraph(prd_id)`** (`src/lib/discovery.functions.ts`): reuses the `generatePrd` `callModel` infra (Gemini 2.5 Pro, `responseFormat:"json_object"`). Output is capped/clamped; `depends_on` may only reference lower `seq` numbers (a valid DAG). Honesty-guarded: "only tasks the spec implies — do not invent scope."
- **Storage**: writes to `tasks` (linked by `prd_id`). Migration `20260614190000` adds `tasks.{seq, depends_on, risk, detail}` — `estimate_hours`/`assignee_kind`/`agent_id`/`prd_id` already existed.
- **Idempotent**: re-generating deletes the prior generated graph (`seq IS NOT NULL`) and re-inserts; **manually-added tasks (`seq` NULL) are never touched**. Pre-migration-tolerant: if the graph columns aren't applied yet it falls back to a flat task insert (the toast says so).

## Governance & guardrails

- Owner-scoped: the read, the delete-then-insert, and the render all run through the authenticated client + the `tasks` "own tasks" RLS — only the caller's own PRD/tasks.
- The generated tasks reuse the existing `tasks` lifecycle (status, Linear push, Build dispatch); no new execution path — the mission orchestrator already runs DAGs.

## Verification checklist

- After sync: open an approved spec → **Generate task graph** → 4–12 tasks render dependency-ordered with estimates/owners/deps/risk; the metadata row's "linked tasks" count updates; **Push to Linear** / **Send to Build** still work.
- Re-generate → the graph replaces (count stays sane); any manually-added task survives.
- Before sync: the button still creates tasks (flat); the toast notes graph fields apply after sync.

## Related

- [`../../plan.md`](../../plan.md) §4 — build log
- [`critic-agent.md`](./critic-agent.md) — DEF-03, the spec red-team that runs before this
- `src/lib/linear.functions.ts` / `src/lib/studio.functions.ts` — where the tasks flow next
