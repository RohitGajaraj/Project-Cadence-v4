# P7 · Incidents log

> _Created: 2026-06-18 · Last updated: 2026-06-20_

> Status · Core shipped 2026-06-18 (cycle 3) · Guardrail source added 2026-06-18 (cycle 16) · Cost incident sources + persistent table added 2026-06-20 (cycle 2) · Cost-incident detector corrected 2026-06-20 (cockpit cycle 3) · Route: `/govern?tab=incidents` · Owner: operator-facing, read-only

## What it does

The Engine Room's **Incidents** tab is a read-only "what went wrong" record: failed tool executions, errored auto-pipeline events, and guardrail blocks, newest first. Each execution incident links to its trace so you can replay exactly what happened. When nothing has failed recently, it reads "No incidents".

## Why it exists

When the loop runs unattended, failures should leave a visible, reviewable record, not vanish into the logs. P7 is that record. Build note: [`plan.md`](../../plan.md) §4.

## Where to find it

Engine Room (`/govern`) > the **Incidents** tab (`?tab=incidents`).

## Demo script (<= 90s)

1. Open the Engine Room, click **Incidents**.
2. If nothing has failed, it reads "No incidents".
3. Otherwise each failure is a card: a kind label (Execution / Pipeline / Guardrail), a title, the error detail, and a timestamp; execution incidents carry a "View trace" link.

## How it works

- `getIncidents` server fn in `src/lib/incidents.functions.ts`. GET, `requireSupabaseAuth`.
- **Persistent cost incidents (cycle 2):** uses the `cost_incidents` table (scoped by `workspace_id`, insert/select RLS) to record manual/auto cost breaches. Populates `amountUsd` and `windowKind` properties for rich badge rendering.
- **Cost-incident detector (cycle 2, corrected cockpit cycle 3):** surfaces budget alerts from `ai_budget_alerts` (user-scoped) as `cost` incidents. The producer (the AI chokepoint, `runtime.server.ts`) only ever writes `kind = 'warn'`, emitted once when spend crosses the configured alert threshold (default 80% of cap); a genuine cap hit halts the next call by throwing, so no `'block'` row is ever produced and `pct` is capped at 100. The detector therefore queries `.in('kind', ['warn','block'])`, reports the true `pct` and window, and escalates the copy to "Budget cap reached" only when `pct >= 100`. The earlier `kind = 'block'`-only filter matched no real rows (silently dead) and is fixed.
- Derives from other logs: `agent_approvals` (status = failed, scoped by `user_id`) for execution failures, `event_queue` (rows with a non-null `error`, scoped to the resolved workspace) for pipeline errors, and `guardrail_hits` (action = block, scoped by `user_id`) for guardrail blocks.
- **Guardrail blocks (cycle 16):** only `action = "block"` hits are incidents (a rule that actually stopped an AI call); `warn` and `redact` are routine governance (the call still runs) and are intentionally excluded. The card surfaces the rule name and which side it fired on (a blocked prompt vs a withheld response), never the raw `matched` payload, so nothing sensitive lands in the list. Guardrail incidents carry no trace link (`guardrail_hits` keys to an `event_id`, not a trace).
- Merges and sorts newest-first, caps at 40, and returns each incident with a `kind`, title, error detail, timestamp, and (for executions) a `trace_id`.
- `IncidentsPanel.tsx` (in `src/components/governance/`) renders the log via TanStack Query, with a "No incidents" empty state, dynamic `CostIncidentBadge` visual tags for cost incidents, and a "View trace" link per execution incident.

## Governance & guardrails

- Read-only. No writes, no migration.
- RLS-scoped; `agent_approvals` and `guardrail_hits` filtered by `user_id`, `event_queue` filtered by the resolved workspace (defense-in-depth on top of RLS, matching the reactor pattern).
- Calm-front: the tab names the outcome ("Incidents" / "what went wrong").

## Verification checklist

- [x] `tsc --noEmit` clean, `eslint` clean, `bun run build` green (2026-06-18; guardrail source re-gated cycle 16).
- [x] Adversarial review folded: explicit workspace scoping on `event_queue`, not RLS alone. Cycle 16 (guardrail): excluded the raw `matched` payload from the card so nothing sensitive surfaces; filtered to `action = block` so routine warn/redact governance is not mislabelled an incident.
- [x] Cockpit cycle 3 (cost detector): an adversarial audit caught the dead `kind='block'` filter; the producer contract was verified directly against `runtime.server.ts` (warn-only, fires at the ~80% crossing, `pct` capped at 100), which also corrected the audit's suggested `pct >= 100`-only filter; rewired to `.in('kind',['warn','block'])` with honest pct/window copy; TDD red to green plus a regression test; `tsc --noEmit` 0, 11 tests pass, `bun run build` green.
- [ ] **Pending published-app verification (needs the founder to publish first):** on the live app, with a failed tool execution present, confirm it appears in Engine Room > Incidents with the error detail and a working "View trace" link; confirm "No incidents" when clean. **Guardrail:** trigger a blocking guardrail rule (a `block` action) and confirm a "Blocked by guardrail: <rule>" card appears with no trace link and no raw matched content.

## Known limits / out of scope

- Pipeline incidents scope to the resolved workspace; a multi-workspace roll-up is a fast-follow.

## Related

- [`plan.md`](../../plan.md) §4 build log · [`incidents.functions.ts`](../../src/lib/incidents.functions.ts) · sources: `agent_approvals`, `event_queue` (reactor), `guardrail_hits` · [autonomous-build-loop playbook](../operations/autonomous-build-loop.md) (cycles 3, 16).
