# v6 P3 T2 — The Gauntlet (proof metrics)

> Status · Shipped 2026-06-14 (ritual_sessions migration applies on next Lovable sync) · Memory-compounds moat metric added 2026-06-14 (M-B) · Route `/govern?tab=gauntlet` · Owner: the loop (no single agent)

## What it does

A read-only tab in Govern that surfaces the three north-star proof metrics on a real surface: **Acceptance rate** (how often you approve the loop's calls), **Autonomy ratio** (how much side-effecting work the loop runs unattended vs gates for you), and **Ritual retention** (how many days you opened Today to clear the queue). Each card shows a headline number, a trend direction, and one plain-language line of what it means. Every number is computed from real tables — when a window is sparse the card says "not enough data yet" instead of inventing a figure. A fourth, full-width card below them, **Memory compounds** (the M-B moat metric), is the scale-independent proof that the decision memory compounds: of the memories the loop stored, the share it has recalled back at least once, plus weekly growth and the count of recorded outcomes that moved a priority. NDR is deferred to billing (M-C), stated plainly on the card rather than invented.

## Why it exists

Phase 3 ("Proof & Launch") needs the proof metrics instrumented on a surface, not asserted in a deck. These three are the evidence that the loop is real and trusted: that the agents' proposals match your judgment (A), that the reversible work is genuinely being carried unattended while the consequential work still comes to you (C), and that the daily ritual is sticky (B). See [`../../plan.md`](../../plan.md) §4 for the build-log entry.

## Where to find it

Govern surface → **Gauntlet** tab (inserted after Analytics). Direct link: `/govern?tab=gauntlet`. The ritual-retention metric is fed by a fire-and-forget write from the **Today** surface (`/`) on each load.

## Demo script (≤ 90s)

1. Open **Govern → Gauntlet**. Three cards render: Acceptance rate · Autonomy ratio · Ritual retention.
2. Read **Acceptance rate**: "Of the calls you actually decided, the share you approved." The sub-line shows `N approved · M rejected · last 14d`; the chip shows whether it's rising vs the prior 7 days.
3. Read **Autonomy ratio**: "the share the loop ran unattended vs the share it gated for your call." Sub-line: `X ran unattended · Y came to you`. Emphasise: rising does **not** mean no human — the gated count is exactly the work still coming to you.
4. Read **Ritual retention**: days-active this week + current streak, tagged "real inputs" or "demo seed" (a user-wide signal; the tag is omitted if it can't be determined).
5. On a fresh account, point out that sparse cards honestly read "not enough data yet" — the claim never outruns the wiring.

## How it works

- Server functions live in [`../../src/lib/gauntlet.functions.ts`](../../src/lib/gauntlet.functions.ts) (TanStack `createServerFn` + `requireSupabaseAuth` middleware + zod validator — same shape as `analytics.functions.ts`). Pure, testable helpers (`trendOf`, `isMissingRelation`) are split into [`../../src/lib/gauntlet-metrics.ts`](../../src/lib/gauntlet-metrics.ts) (client-safe) with unit tests in `gauntlet-metrics.test.ts`.
- **Metric A — `getAcceptanceRate`**: `accepted / (accepted + rejected)` over a 14d window, counting only DECIDED calls (`decided_at` set). `accepted` = the calls you approved — status in {approved, executed, failed} (an approved call that then ran is still an acceptance; counting only `status='approved'` would silently drop those and read artificially low). `rejected` = status `rejected`. Trend compares the recent 7d to the prior 7d. User-wide via RLS (the table is owner-scoped). Per-agent acceptance already exists in `ai/trust.server.ts`; this is the user rollup.
- **Metric C — `getAutonomyRatio`**: `unattended / (unattended + gated)` where `unattended` = SUCCESSFUL (`ok = true`) side-effecting `tool_calls` rows (every `tool_calls` row is an inline auto-execution; a failed attempt isn't "carried work") and `gated` = side-effecting `agent_approvals` rows. Side-effecting is decided by `isSideEffectingTool()` from [`../../src/lib/tool-consequences.ts`](../../src/lib/tool-consequences.ts). Mirrors `HopToolCall.is_unattended` in `missions.functions.ts`.
- **Metric B — `getRitualRetention`**: distinct days-active (7/14/30) + current streak from `ritual_sessions`, plus a user-wide real-vs-demo signal computed on the fly (≥1 connected `connections` row OR ≥1 `signals` row; returns null and the tag is omitted if the probe errors, rather than wrongly asserting "demo"). **Pre-migration tolerant**: a missing-relation error (Postgres `42P01`/`42703`, PostgREST `PGRST205`, or a "relation does not exist" message) is caught and returns `tableReady: false` → the card reads "not enough data yet" rather than throwing — the same probe idiom as `ai/mission-advance.server.ts:hasRetryColumns`.
- **`recordRitualSession`**: best-effort, fire-and-forget from `_authenticated.index.tsx` on mount (ref-guarded to fire once per mount); an idempotent upsert on `(user_id, opened_on)` writes at most one row per user per UTC day, so repeated opens never accumulate. `workspace_id` is left null (unused by the metric; a client-supplied id isn't trusted — cross-tenant). Never blocks render; swallows every failure (incl. table-missing → `{ recorded: false }`).
- **Metric D — `getMemoryCompounding`** (M-B, the moat metric): owner-scoped head counts over `agent_memory` — `stored` (all-time), `recalled` (rows with `last_used_at` set), `reuseRate = recalled / stored`, and `newThisWeek` — plus `prioritiesMoved` = `learnings` rows whose recorded outcome moved the opportunity's ICE (a rounded compare, so a sub-0.1 drift never reads as a move). Pure helpers (`reuseRate`, `countPriorityMoves`) split into [`../../src/lib/memory-compounding.ts`](../../src/lib/memory-compounding.ts) with unit tests in `memory-compounding.test.ts`. Missing-relation tolerant (degrades to `tableReady: false`); the secondary probes are best-effort (under-report rather than fail the whole card). No trend chip by design: reuse-rate over time needs snapshots we do not store, so growth shows as a plain `+N this week` count, never a fabricated arrow. Complements the `/memory` browse surface ([`memory-view.md`](./memory-view.md)) — that one shows the rows, this one measures the compounding.
- UI: [`../../src/components/observe/GauntletMetricsPanel.tsx`](../../src/components/observe/GauntletMetricsPanel.tsx), styled to match `AnalyticsPanel` (bento cards, `MonoLabel`, serif tabular headline). Wired into [`../../src/routes/_authenticated.govern.tsx`](../../src/routes/_authenticated.govern.tsx) as the `gauntlet` tab.
- Migration: [`../../supabase/migrations/20260614150000_p3_ritual_sessions.sql`](../../supabase/migrations/20260614150000_p3_ritual_sessions.sql).

## Governance & guardrails

- All three reads and the write are **owner-scoped** — RLS (`auth.uid() = user_id`) on `agent_approvals`, `tool_calls`, `signals`, `connections`, and `ritual_sessions`. A user can only ever see their own activity. No service-role path.
- Read-only surface: no approval modes, no kill-switch. `recordRitualSession` is the only write — an idempotent one-row-per-UTC-day upsert, owner-scoped, `workspace_id` null. Bounded and harmless.

## Verification checklist

- `/govern?tab=gauntlet` renders three cards; the tab sits between Analytics and Traces.
- With no decided approvals, Acceptance rate reads `—` + "not enough data yet — no calls decided in 14d".
- With no side-effecting actions, Autonomy ratio reads `—` + "not enough data yet — no side-effecting actions in 14d".
- Before the migration applies, Ritual retention reads `—` + "ritual tracking lights up on next sync"; after it applies, opening Today increments days-active.
- `bun run build` is green; `bun test src/lib/gauntlet-metrics.test.ts` passes (9 tests); `bun test src/lib/memory-compounding.test.ts` passes (14 tests, including the real numeric-as-string wire shape).
- The **Memory compounds** card shows `reuse %` over `stored · +new this week · moved a priority` on a seeded account, and reads "Not enough data yet" when nothing is stored. It states NDR is gated on billing rather than showing an empty figure.

## Known limits / out of scope

- **Ritual retention is empty until `ritual_sessions` applies on the next Lovable sync.** This is expected and handled — the code degrades to "not enough data yet" until then.
- Metrics are user-wide (via RLS), not split per workspace — the source tables carry no `workspace_id`. `ritual_sessions` has a (nullable, currently-null) `workspace_id` column reserved for a future per-workspace breakdown; it is not populated or sliced today.
- No charts/sparklines — single headline + trend chip per card, by design (proof, not analytics).
- **NDR is not instrumented** — it needs recurring revenue, and billing is an M-C item; the Memory-compounds card says so plainly rather than showing an empty NDR figure. Reuse-rate is shown without a trend (no historical snapshots); week-over-week growth is the `+N this week` count an operator watches climb.

## Related

- [`../../plan.md`](../../plan.md) §4 — build log entry
- [`loop-runs-itself.md`](./loop-runs-itself.md) — the v6 P1 autonomous loop these metrics measure
- [`trust-and-autonomy.md`](./trust-and-autonomy.md) — per-agent trust score (Acceptance rate's per-agent sibling)
- [`../strategy/v6-agentic-product-os-2026-06-13.md`](../strategy/v6-agentic-product-os-2026-06-13.md) — the North Star these metrics prove
