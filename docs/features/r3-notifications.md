# R3 · Notifications (in-app Attention feed & preferences)

> _Created: 2026-06-18 · Last updated: 2026-06-20_

> Status · Core feed shipped 2026-06-18 (autonomous overnight cycle 2) · Global bell shipped 2026-06-18 (cycle 15) · Drift alerts (P5-ALERT) shipped 2026-06-18 (cycle 22) · Preferences & Scaffolding (R3-PREFS) shipped 2026-06-20 (parallel/cockpit cycle 1) · Route: `/govern?tab=attention` & `/notifications` · Owner: operator-facing

## What it does

The Engine Room's **Attention** tab is one calm feed of what needs the operator right now, pulled live from the loop's own state: tool calls waiting on a human decision, spend nearing or over a cap, a stalled loop, and output drift that tripped a threshold. Each item is a severity-coded card that links straight to where you act on it.

Users can customize which notification categories (Approvals, Health, Spend, Drift) they want to receive through which channels (In-App Feed, Instant Email, or Digest rollups) via the **Notification Settings** page. The page also configures scaffolding settings for daily/weekly digest generation.

## Why it exists

The loop runs a lot unattended; the operator should hear about the few things that actually need them without hunting across tabs. R3 provides a single "what needs you" surface and channel customization so notification delivery matches the operator's preferences.

## Where to find it

- Engine Room (`/govern`) > the **Attention** tab (`?tab=attention`).
- Notification Preferences: `/notifications`.

## Demo script (<= 90s)

1. Open the Engine Room, click **Attention**.
2. Click **Notifications** in the workspace settings or navigate to `/notifications`.
3. Toggle checkmarks in the Preferences Matrix for In-App Feed, Instant Email, or Digest Summary channels per category.
4. Select a digest frequency (Daily or Weekly summary) and click **Save preferences**.
5. Save confirmation displays. In-app alerts are filtered immediately based on the selected matrix.

## How it works

- `getNotifications`, `getNotificationPreferences`, and `updateNotificationPreferences` server fns in `src/lib/notifications.functions.ts`.
- **Database Schema:** `user_notification_preferences` table maps a user's preferences per channel and category, using Row-Level Security (RLS) to ensure users can only view and update their own preferences.
- **In-App Filtering:** `getNotifications` reads `user_notification_preferences` and filters out categories where `in_app_<category>` is disabled.
- **Scaffolding helper functions:**
  - `dispatchInstantEmailScaffold(supabase, userId, notification)`: checks preferences and simulates instant email dispatch if enabled.
  - `generateDigestScaffold(supabase, userId, frequency)`: aggregates pending alerts matching preferences and generates a formatted email digest body (daily/weekly, gated scaffolding).

## Governance & guardrails

- RLS-scoped: users can only view and update their own notification preferences.
- Default fallback: if a user hasn't explicitly saved preferences, the system falls back to a clean default state with all notification channels enabled.

## Verification checklist

- [x] `tsc --noEmit` clean, `eslint` clean, `bun run build` green (2026-06-20).
- [x] Unit tests in `notifications.test.ts` pass cleanly (verify preferences filtering and digest aggregation).
- [ ] **Pending published-app verification:**
  1. Navigate to `/notifications` on the published app and customize preferences.
  2. Confirm checking/unchecking "In-App Feed" for a category hides/shows those alerts in the `/govern?tab=attention` feed and the global bell badge count.

## Known limits / out of scope

- Outbound email delivery: actual SMTP/ESP sending integration is gated/excluded and simulated via console logs in the scaffolding helpers.

## Related

- [`plan.md`](../../plan.md) §4 build log · [`notifications.functions.ts`](../../src/lib/notifications.functions.ts) · [`_authenticated.notifications.tsx`](../../src/routes/_authenticated.notifications.tsx) · [`notifications.test.ts`](../../src/lib/notifications.test.ts) · [autonomous-build-loop playbook](../operations/autonomous-build-loop.md).
