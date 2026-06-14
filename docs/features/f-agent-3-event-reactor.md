# F-AGENT-3: Event reactor + auto-pipelines

> **Status:** ✅ Shipped 2026-06-06 · **Route:** `/governance` (Auto-pipelines · Reactor activity) · **Owner agents:** any agent named as a target in a subscription

## What it does

Turns Cadence from "agents that act when summoned" into "agents that react." Every new signal, scored opportunity, and approved PRD fires a typed event. Operator-defined subscriptions route those events to the right agent in `auto` or `confirm` mode. The discover → define → plan chain now runs itself, end-to-end, behind governance gates.

## Why it exists

F-AGENT-1 gave Cadence a planner; F-AGENT-2 gave it memory. Without a reactor the system still required the operator to push every button, defeating the agent-native premise. F-AGENT-3 closes the autonomous loop. Full rationale: [`../../plan.md`](../../plan.md) §4 entry dated 2026-06-06 (F-AGENT-3).

## Where to find it

- **Nav:** sidebar → **Govern** group → **Governance**.
- **Auto-pipelines panel**: operator rules CRUD: `event_type → target_agent_slug` with `auto | confirm` and an optional `min_score` filter (for `opportunity.scored`).
- **Reactor activity panel**: last 50 events with status pills; pending `confirm` rows expose **Dispatch** / **Skip** buttons. (Also surfaced in the Attention queue on `/swarm`.)

## Demo script (≤ 90 seconds)

1. Sign in as `demo@redcadence.app`.
2. Click **Governance**. Show the **Auto-pipelines** panel. "Three defaults seeded for every workspace: new signals go to Discovery in auto mode; high-ICE opportunities (≥ 8.0) go to the Strategist with a confirm gate; approved PRDs go to the Orchestrator with a confirm gate."
3. In another tab, ingest or post a signal. Switch to **Reactor activity**. A `signal.created` row appears, status `dispatched`. "That fired a Discovery mission automatically."
4. Score an opportunity ≥ 8.0. A pending row appears with **Dispatch** / **Skip**. Click **Dispatch**. "Strategist now drafts a PRD. The reactor handled the routing."

## How it works

- **Tables:**
  - `event_subscriptions`: per-workspace rules: `event_type ∈ {signal.created, opportunity.scored, prd.approved} → target_agent_slug` with `approval_mode auto|confirm`, jsonb `filter`, RLS workspace-member read + owner write, `is_default` flag to distinguish seeded vs operator rules.
  - `event_queue`: one row per firing, idempotent `UNIQUE (subscription_id, source_id)` so re-firing the underlying triggers is a no-op; statuses `pending → dispatched | skipped | failed`; carries `mission_id` / `run_id` / `error`.
- **Triggers** (all SECURITY DEFINER, fan-out matching subs into the queue):
  - `signals`: AFTER INSERT.
  - `opportunities`: only on insert or ICE-input change AND `NEW.ice_score >= COALESCE(filter->>'min_score', 8.0)`.
  - `prds`: only on transition into `status='approved'`.
- **Defaults:** `seed_default_event_subscriptions(uuid)` seeds three rules per workspace owner: `signal.created → discovery (auto)`, `opportunity.scored → strategist (confirm, min_score 8.0)`, `prd.approved → orchestrator (confirm)`; wired into `handle_new_user` for new signups and backfilled for existing workspace owners.
- **Dispatch:** `dispatchEvent()` in `src/lib/reactor.functions.ts` creates a mission via `createMission` + runs `runAgentLoop` with a templated, event-type-specific goal.
- **Cron:** `/api/public/hooks/event-reactor-tick` (pg_cron `event-reactor-tick`, 1-min) drains pending `auto`-mode rows in batches of 10.
- **Operator surface:** `/governance` exposes both panels; the same `confirm` rows are also actionable from `/swarm` → Attention queue.

## Governance & guardrails

- **Idempotent dispatch.** `UNIQUE (subscription_id, source_id)` on `event_queue` makes re-firing the same trigger a no-op. The dispatch helper is also safe to retry.
- **`confirm` waits for the operator.** No auto-dispatch unless the rule says `auto`.
- **Seeded rules are conservative.** Only signals get `auto` by default; opportunities and PRDs require a click.
- **RLS:** workspace-member read on both tables; only the owner can write subscriptions.
- **SECURITY DEFINER** on the trigger fns is required (the inserting role may not have direct INSERT on `event_queue`). Do **not** switch to SECURITY INVOKER.

## Verification checklist

1. New workspace owner has three seeded `event_subscriptions` rows (`is_default = true`).
2. Inserting a signal creates a `pending` row in `event_queue` (or `dispatched` after the next tick).
3. The cron tick clears `pending` `auto` rows within ≤ 60s, sets `dispatched_at` + `mission_id` + `run_id`.
4. A `confirm` row stays `pending` until the operator clicks Dispatch (→ `dispatched`) or Skip (→ `skipped`).
5. Re-firing the same trigger does **not** create a duplicate queue row.

## Known limits / out of scope

- The dispatch helper runs `runAgentLoop` synchronously inside the cron handler. Fine for `auto` orchestrator rows (backpressure already enqueues over-cap missions); high-frequency event types should wrap with `withIdempotency` or move behind a true queue.
- Opportunity trigger only checks `>=` against `filter->>'min_score'` (default 8.0). No other comparators yet.
- No event types beyond the three listed. Adding `theme.created`, `mission.completed`, etc. is a follow-on.

## Related

- [`../../plan.md`](../../plan.md) §4, 2026-06-06 F-AGENT-3 entry
- [`../../architecture/orchestration.md`](../../architecture/orchestration.md): orchestration contract (F-AGENT-3 bullet)
- [`./f-agent-1-orchestrator.md`](./f-agent-1-orchestrator.md), [`./f-agent-2-memory-reflection.md`](./f-agent-2-memory-reflection.md), [`./f-agent-4-swarm-hud.md`](./f-agent-4-swarm-hud.md)
