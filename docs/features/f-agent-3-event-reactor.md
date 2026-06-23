# F-AGENT-3: Event reactor + auto-pipelines

> _Created: 2026-06-06 · Last updated: 2026-06-24_

> **Status:** ✅ Shipped 2026-06-06 · **Route:** `/governance` (Auto-pipelines · Reactor activity) · **Owner agents:** any agent named as a target in a subscription

> [!IMPORTANT]
> **Live-state verification (2026-06-24, lane 2 · register item `EVENT-REACTOR-LIVE`).** The v11 row asked to "turn on the dormant reactor." A code + live-DB audit (via the Lovable MCP against the production project) shows the reactor **is already wired and scheduled end-to-end** — it is cold for lack of input volume, not because the pipeline is unbuilt:
> - **Emit (live):** the three `*_reactor_fanout` `AFTER INSERT/UPDATE` triggers exist; `event_subscriptions` holds **12 enabled default rows** across the workspaces (the three seeded types). An `AFTER INSERT` trigger is path-agnostic, so every signal/opportunity/PRD write path already fans out — there is **no non-redundant application-level emit code to add** for the existing types.
> - **Consume (live):** the `event-reactor-tick` pg_cron job is **present and `active`, schedule `* * * * *`** (every minute), with the KI-27 reaper + bounded-retry hardening in the handler.
> - **Why it looks dormant:** `event_queue` has a single all-time row — an `opportunity.scored` / `confirm` event from 2026-06-11 correctly **waiting for an operator** (confirm rows never auto-dispatch). The coldness is an _input/data_ gap (no connectors bound, near-zero live signals), owned by `TEST-SEED` + `AMBIENT-SENSE`, not a reactor-code gap.
>
> **✓ Production gap found AND fixed (2026-06-24, lane 2 — KI-38).** The live `event_queue` was **missing `attempt_count`/`next_attempt_at`** while the deployed consume-tick + `dispatchEvent()` select/update them — a normal Lovable **publish does not run `supabase/migrations/*.sql`** (the columns were still absent after the founder's publish), so any `auto` dispatch would have `42703`'d. **Resolved by applying `20260620220500_ki27_reactor_reaper_retry.sql` to prod via the Lovable MCP** (idempotent). Verified live: the columns exist, the status CHECK includes `processing`, and the consume-tick's exact main query now runs clean. The `auto` path is unblocked. Tracked (resolved) in [`../planning/known-issues.md`](../planning/known-issues.md) KI-38.
>
> **Remaining scope (re-scoped, not "turn it on"):** (a) ✅ KI-27 columns live (done above); (b) **new event types** — `signal.clustered`, `outcome.recorded`, `decision.made`, `drift.detected` — each needs the `event_subscriptions.event_type` `CHECK` widened + new fanout triggers, i.e. a **migration** (do once a migration lane is free — migrations are serialized one-lane-at-a-time by the claim ledger's `supabase/migrations` prefix lock); (c) **live exercise / proof** overlaps `LOOP-PROVE` (now feasible — TEST-SEED's edges + the live reactor).

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
