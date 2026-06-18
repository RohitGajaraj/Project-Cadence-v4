# P7 · Incidents log

> Status · Core shipped 2026-06-18 (autonomous overnight cycle 3) · Guardrail source added 2026-06-18 (cycle 16) · Route: `/govern?tab=incidents` · Owner: operator-facing, read-only

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
- No new table. Derives from confirmed logs: `agent_approvals` (status = failed, scoped by `user_id`) for execution failures, `event_queue` (rows with a non-null `error`, scoped to the resolved workspace) for pipeline errors, and `guardrail_hits` (action = block, scoped by `user_id`) for guardrail blocks.
- **Guardrail blocks (cycle 16):** only `action = "block"` hits are incidents (a rule that actually stopped an AI call); `warn` and `redact` are routine governance (the call still runs) and are intentionally excluded. The card surfaces the rule name and which side it fired on (a blocked prompt vs a withheld response), never the raw `matched` payload, so nothing sensitive lands in the list. Guardrail incidents carry no trace link (`guardrail_hits` keys to an `event_id`, not a trace).
- Merges and sorts newest-first, caps at 40, and returns each incident with a `kind`, title, error detail, timestamp, and (for executions) a `trace_id`.
- `IncidentsPanel.tsx` (in `src/components/governance/`) renders the log via TanStack Query, with a "No incidents" empty state and a "View trace" link per execution incident.

## Governance & guardrails

- Read-only. No writes, no migration.
- RLS-scoped; `agent_approvals` and `guardrail_hits` filtered by `user_id`, `event_queue` filtered by the resolved workspace (defense-in-depth on top of RLS, matching the reactor pattern).
- Calm-front: the tab names the outcome ("Incidents" / "what went wrong").

## Verification checklist

- [x] `tsc --noEmit` clean, `eslint` clean, `bun run build` green (2026-06-18; guardrail source re-gated cycle 16).
- [x] Adversarial review folded: explicit workspace scoping on `event_queue`, not RLS alone. Cycle 16 (guardrail): excluded the raw `matched` payload from the card so nothing sensitive surfaces; filtered to `action = block` so routine warn/redact governance is not mislabelled an incident.
- [ ] **Pending published-app verification (needs the founder to publish first):** on the live app, with a failed tool execution present, confirm it appears in Engine Room > Incidents with the error detail and a working "View trace" link; confirm "No incidents" when clean. **Guardrail:** trigger a blocking guardrail rule (a `block` action) and confirm a "Blocked by guardrail: <rule>" card appears with no trace link and no raw matched content.

## Known limits / out of scope

- Sources are execution failures, pipeline errors, and guardrail blocks (cycle 16). A cost-incident source (a budget cap reached recorded as an incident, not just a live Attention alert) and a persistent incidents table for manual logging are the documented remainder (the partial mark on the P7 dashboard row).
- Pipeline incidents scope to the resolved workspace; a multi-workspace roll-up is a fast-follow.

## Related

- [`plan.md`](../../plan.md) §4 build log · [`incidents.functions.ts`](../../src/lib/incidents.functions.ts) · sources: `agent_approvals`, `event_queue` (reactor), `guardrail_hits` · [autonomous-build-loop playbook](../operations/autonomous-build-loop.md) (cycles 3, 16).
