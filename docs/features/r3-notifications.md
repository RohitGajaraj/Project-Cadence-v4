# R3 · Notifications (in-app Attention feed)

> Status · Core shipped 2026-06-18 (autonomous overnight cycle 2) · Route: `/govern?tab=attention` · Owner: operator-facing, read-only

## What it does

The Engine Room's **Attention** tab is one calm feed of what needs the operator right now, pulled live from the loop's own state: tool calls waiting on a human decision, spend nearing or over a cap, and a stalled loop. Each item is a severity-coded card that links straight to where you act on it. When nothing needs you, it says so ("All clear").

## Why it exists

The loop runs a lot unattended; the operator should hear about the few things that actually need them without hunting across the Approvals, Spend, and Loop-health tabs. R3 is that single "what needs you" surface. Build note: [`plan.md`](../../plan.md) §4.

## Where to find it

Engine Room (`/govern`) > the **Attention** tab (`?tab=attention`).

## Demo script (<= 90s)

1. Open the Engine Room, click **Attention**.
2. If the loop is clean, it reads "All clear".
3. With a pending approval, a near-cap budget, or a stalled run, each shows as a card: a severity label ("Needs you" / "Warning" / "Heads up"), a title, and a one-line detail.
4. Click a card to jump to its home (Approvals, Spend, or Loop health).

## How it works

- `getNotifications` server fn in `src/lib/notifications.functions.ts`. GET, `requireSupabaseAuth`.
- Derives the feed with no new table, reading three sources RLS-scoped by `user_id`: `agent_approvals` (status = pending), `agent_runs` (running/queued past a 30-minute stall window), and `ai_budgets` (daily/monthly used vs cap and `alert_at_pct`).
- Returns a severity-sorted `AppNotification[]` (action > warning > info) with a deep-link `href` per item and a `count` for a future bell badge. Each probe degrades to a safe default so a transient error never breaks the surface.
- `NotificationsPanel.tsx` (in `src/components/governance/`) renders the feed via TanStack Query, with the "All clear" empty state.

## Governance & guardrails

- Read-only. No writes, no migration.
- RLS-scoped to the caller; a user only ever sees their own approvals, runs, and budget.
- Calm-front: the tab names the outcome ("Attention" / "what needs you"), not the mechanism.

## Verification checklist

- [x] `tsc --noEmit` clean, `eslint` clean, `bun run build` green (2026-06-18).
- [x] Adversarial review folded: Attention placed second so the default leftmost tab stays Controls.
- [ ] **Pending published-app verification (needs the founder to publish first):** on the live app, create a pending approval (or a near-cap budget) and confirm it appears in Engine Room > Attention with the right severity and a card that links to the correct tab; confirm "All clear" when the loop is clean.

## Known limits / out of scope

- In-app only for now. Email, digests, and per-user notification preferences are the documented remainder (the partial mark on the R3 dashboard row).
- A global bell badge in the app chrome is a fast-follow; the `count` is already returned for it.
- The feed is point-in-time (refreshes on mount and window focus); a live push or poll is a later enhancement.

## Related

- [`plan.md`](../../plan.md) §4 build log · [`notifications.functions.ts`](../../src/lib/notifications.functions.ts) · sources: `loop-health.functions.ts` (E8), `budgets.functions.ts`, `agent_loop.functions.ts` · [autonomous-build-loop playbook](../operations/autonomous-build-loop.md) (cycle 2).
