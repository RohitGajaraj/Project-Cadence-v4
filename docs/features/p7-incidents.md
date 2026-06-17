# P7 · Incidents log

> Status · Core shipped 2026-06-18 (autonomous overnight cycle 3) · Route: `/govern?tab=incidents` · Owner: operator-facing, read-only

## What it does

The Engine Room's **Incidents** tab is a read-only "what went wrong" record: failed tool executions and errored auto-pipeline events, newest first. Each execution incident links to its trace so you can replay exactly what happened. When nothing has failed recently, it reads "No incidents".

## Why it exists

When the loop runs unattended, failures should leave a visible, reviewable record, not vanish into the logs. P7 is that record. Build note: [`plan.md`](../../plan.md) §4.

## Where to find it

Engine Room (`/govern`) > the **Incidents** tab (`?tab=incidents`).

## Demo script (<= 90s)

1. Open the Engine Room, click **Incidents**.
2. If nothing has failed, it reads "No incidents".
3. Otherwise each failure is a card: a kind label (Execution / Pipeline), a title, the error detail, and a timestamp; execution incidents carry a "View trace" link.

## How it works

- `getIncidents` server fn in `src/lib/incidents.functions.ts`. GET, `requireSupabaseAuth`.
- No new table. Derives from confirmed logs: `agent_approvals` (status = failed, scoped by `user_id`) for execution failures, and `event_queue` (rows with a non-null `error`, scoped to the resolved workspace) for pipeline errors.
- Merges and sorts newest-first, caps at 40, and returns each incident with a `kind`, title, error detail, timestamp, and (for executions) a `trace_id`.
- `IncidentsPanel.tsx` (in `src/components/governance/`) renders the log via TanStack Query, with a "No incidents" empty state and a "View trace" link per execution incident.

## Governance & guardrails

- Read-only. No writes, no migration.
- RLS-scoped; `agent_approvals` filtered by `user_id`, `event_queue` filtered by the resolved workspace (defense-in-depth on top of RLS, matching the reactor pattern).
- Calm-front: the tab names the outcome ("Incidents" / "what went wrong").

## Verification checklist

- [x] `tsc --noEmit` clean, `eslint` clean, `bun run build` green (2026-06-18).
- [x] Adversarial review folded: explicit workspace scoping on `event_queue`, not RLS alone.
- [ ] **Pending published-app verification (needs the founder to publish first):** on the live app, with a failed tool execution present, confirm it appears in Engine Room > Incidents with the error detail and a working "View trace" link; confirm "No incidents" when clean.

## Known limits / out of scope

- Sources are execution failures and pipeline errors. Guardrail-block and cost-incident sources, and a persistent incidents table for manual logging, are the documented remainder (the partial mark on the P7 dashboard row).
- Pipeline incidents scope to the resolved workspace; a multi-workspace roll-up is a fast-follow.

## Related

- [`plan.md`](../../plan.md) §4 build log · [`incidents.functions.ts`](../../src/lib/incidents.functions.ts) · sources: `agent_approvals`, `event_queue` (reactor) · [autonomous-build-loop playbook](../operations/autonomous-build-loop.md) (cycle 3).
