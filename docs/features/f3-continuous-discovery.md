# F3 · Continuous discovery feed

> Status · Always-fresh feed shipped 2026-06-18 (autonomous overnight cycle 11) · Per-product clustering shipped 2026-06-18 12:20 (cycle 17) · Surface: `/product?tab=signals` · Owner: operator-facing

## What it does

The discovery surface keeps the signal feed live and lets each product own its own feed:

1. **Always-fresh feed (cycle 11).** Signals stream in continuously through the ingest webhook and the reactor; the Signals tab polls every 30s (pausing when the tab is unfocused, only while mounted), so newly-ingested signals appear without a manual reload.
2. **Per-product clustering (cycle 17).** When a product is active in the switcher, the signals feed, the themes, and the clustering all scope to that product, so each product gets its own discovery feed instead of one workspace-wide pile. With no product active (the all-products view), the feed is the full unscoped one, exactly as before.

## Why it exists

Pain #1 (v10): "signal is scattered; I miss things and react late." A live, per-product feed means the operator sees their product's fresh signal without hunting or manual refreshes.

## Where to find it

`/product` > the **Signals** tab. Switch products with the portfolio switcher; the feed follows the active product.

## How it works

- **No migration.** `signals` and `themes` already carry `project_id` (and `workspace_id`); F3 just started using `project_id` for the feed.
- `listSignals` / `listThemes` / `clusterSignals` / `bulkImportSignals` (in `src/lib/discovery.functions.ts`) take an optional product id. When set, reads filter on `project_id`, clustering scopes to that product's unclustered signals, and new themes are stamped with it. `createSignal` already accepted `project_id`. When absent, every query is unscoped, so the change is fully back-compatible.
- `SignalsPanel.tsx` reads the active product from `useWorkspace()` (`activeProductId`), passes it to all of the above, and includes it in the React Query keys so switching products refetches the scoped feed. `SignalDetail` and the onboarding themes read stay deliberately unscoped (a single signal's detail needs the full set; onboarding is pre-product).
- **Nothing is hidden.** Unassigned signals (no product, for example the workspace ingest webhook) live in the all-products view; they are not filed under a product, not lost. A signal whose theme was clustered under a different scope is shown as a standalone row rather than vanishing.

## Governance & guardrails

- Read scoping is an additive filter, never a security boundary: RLS still scopes every read to the caller by `user_id`. `project_id` only narrows within the user's own rows.
- Calm-front: the feed names the outcome (the product's signals), not the mechanism.

## Verification checklist

- [x] `tsc --noEmit` clean, `eslint` clean, `bun run build` green, my additions humanization-clean (2026-06-18 12:20).
- [x] Adversarial review folded: a signal whose theme is outside the current scope is shown standalone (never vanishes); back-compat preserved (no product active = unscoped, identical to before); `project_id` filter is parameterized + uuid-validated.
- [ ] **Pending published-app verification (needs the founder to publish first):** with two products, capture a signal under product A, switch to product B and confirm it does not appear; switch back to A and confirm it does; cluster under A and confirm the theme shows only under A; confirm the all-products view shows everything including webhook signals.

## Known limits / out of scope

- **Auto-cluster cron (continuous incremental re-cluster)** stays queued for the founder: it commits recurring AI spend, which the autonomous contract treats as founder-gated. The manual "Cluster N" action is per-product today.
- F3 scopes the **signals + themes** feed. Per-product scoping of opportunities/specs is separate, future work.
- Assigning an existing unassigned (webhook) signal to a product from the UI is a fast-follow; today new captures are filed under the active product at capture time.

## Related

- [`plan.md`](../../plan.md) §4 build log · [`discovery.functions.ts`](../../src/lib/discovery.functions.ts) · `SignalsPanel.tsx` · [autonomous-build-loop playbook](../operations/autonomous-build-loop.md) (cycles 11, 17).
