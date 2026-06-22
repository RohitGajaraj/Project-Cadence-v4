# M1 / LRN-01 — Support triage loop

> _Created: 2026-06-22 · Lane 2 · Status: ◐ autonomous core shipped (increment 1), UI + live channel pending_

Closes the post-launch learning loop: inbound support tickets are clustered into
recurring themes, each recurring theme is fed back into **Discover** as a first-class
`signals` row, and every clustered ticket gets a drafted acknowledgement reply. This
is the M1/LRN-01 row on the feature dashboard ("Tickets to drafted replies to bug
clusters to signals; support feeds back into Discover").

## Why it matters

Cadence's moat is the decision system. Support is the richest post-launch signal of
what is actually broken or missing, but it normally dies in a help desk. This loop
turns recurring support pain into governed product signal automatically, so the
Discover -> opportunity -> PRD pipeline can act on what customers keep reporting.

## What shipped (increment 1, autonomous, dormant-safe)

All of this is built, gate-green (tsc 0, lint 0, 33 unit tests), and **never touches
the AI chokepoint**. It is dormant until the founder applies the migration and wires
a surface, so it is `◐` not `✅` (no live-verify yet).

- **`support_tickets` table** (`supabase/migrations/20260622090000_support_tickets.sql`)
  — workspace-scoped, RLS keyed on `is_workspace_member` exactly like `signals`.
  Tracks `status` (open/triaged/closed), the assigned `cluster_key`, and the emitted
  `signal_id`. Forward-only, idempotent. **Applied on the founder's next publish.**
- **The pure triage engine** (`src/lib/support/triage.ts`) — deterministic, no AI, no
  I/O, fully unit-tested. Tokenizes (Unicode-aware), clusters recurring tickets by
  **greedy leader assignment against each cluster's common core** (the running
  intersection of its members' salient tokens), and shapes a cluster into the exact
  `signals` insert payload. Precision over recall: a one-off ticket is never emitted
  as a recurring signal, and a broad "bridge" ticket cannot weld two unrelated themes
  into one misleading signal (the single-link transitivity trap, caught in review).
- **The drafted-reply seam** (`src/lib/support/draft.ts`) — a deterministic template
  reply that works with no AI (a plain, humanized acknowledgement that names the theme
  and confirms the report is now tracked), plus a dormant `DraftProvider` interface for
  an optional AI-written draft. The AI layer is a **founder-gated** seam that, when
  wired, routes through an existing `CallSurface` on the AI chokepoint; it adds no new
  surface and is not wired here.
- **Server functions** (`src/lib/support-triage.functions.ts`) — `addSupportTicket`,
  `bulkImportSupportTickets`, `listSupportTickets`, `runSupportTriage` (cluster open
  tickets -> emit each recurring cluster as a `source='support-triage'` signal -> mark
  the cluster's tickets triaged), `listSupportClusters`, `draftSupportReply`. RLS-safe
  (workspace-membership keyed), bounded (triage batch capped at 500).

### The loop, end to end

```
inbound ticket (manual/paste now; Intercom/Zendesk/email later, founder-gated)
  -> support_tickets (status=open)
  -> runSupportTriage: clusterTickets() groups recurring themes
  -> each recurring cluster -> insert into signals (source 'support-triage')
  -> Discover clustering -> opportunity -> PRD  (the existing pipeline takes over)
  -> tickets marked triaged (cluster_key + signal_id recorded)
draftSupportReply -> a humanized acknowledgement per cluster (template now, AI later)
```

## Founder-gated / deferred (NOT autonomous)

- **Inbound channel** (Intercom / Zendesk / email ingestion) — needs a connector OAuth
  + recurring spend. Until then, tickets enter via manual add / bulk paste.
- **AI-written draft** — the dormant `DraftProvider` seam; wiring it routes through the
  AI chokepoint (a founder/attended chokepoint increment), and may add recurring AI
  spend. The template reply is the always-on floor in the meantime.
- **Dedicated UI surface** — increment 2 (a `/support` route + panel). Built next,
  autonomously; this increment is server + engine only.

## Known edges (honest)

- **Idempotency on partial failure.** `runSupportTriage` inserts a signal then marks
  tickets triaged in separate statements (no surrounding transaction). If the update
  fails after the insert, a re-run can emit a duplicate signal. Low impact today
  (dormant, no driver). The fix when the channel is wired: a unique partial index on
  `signals(workspace_id, cluster_key) where source='support-triage'` + upsert, or wrap
  the per-cluster insert+update in an RPC transaction.
- **Cluster keys are membership-derived**, not a permanent identity: as a theme's
  vocabulary grows across re-runs the top tokens can shift the key. A persistent
  cluster identity is a later increment.

## Verification

tsc `--noEmit` 0, eslint 0 (5 files), `bun test` 33/33 on the pure cores, full suite
1146/1146. Live DB introspection confirmed the `signals` insert columns and all FK /
helper-function references exist; `support_tickets` does not exist in prod yet (created
on publish), so the server functions are correctly dormant. No behavioral live-verify
yet -> `◐`.

## Where to see it (after publish + increment 2)

`Support` (new route, increment 2) — add/paste tickets, Run triage, see clusters; the
emitted signals appear under `Discover`.
