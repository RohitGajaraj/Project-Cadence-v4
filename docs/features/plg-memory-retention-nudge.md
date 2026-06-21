# PLG memory-retention nudge (PLG Phase 3)

> _Created: 2026-06-22_

**Status:** ✅ Shipped (Lane 1, 2026-06-22). **Register:** PLG (#57), the Phase-3 slice. **Lane:** G4 Launch & Learn / growth. **Pairs with:** [`pricing.md`](./pricing.md) (the free→paid value ladder), the entitlements model (`src/lib/entitlements.ts`), and the dormant DATA-RETENTION purge (which will populate `agent_memory.expires_at`).

## What it delivers

The free plan keeps decision memory on a rolling `FREE_MEMORY_RETENTION_DAYS` (30-day) window, then it fades; paid plans keep it forever and it starts to compound (the moat). This surfaces that value at the moment it matters: when a **free** workspace's own decision memory nears the retention window, a calm banner on Today nudges the upgrade — "keep your memory and let it compound."

It is honest and calm by construction:

- **Tier-gated.** Paid plans (`memoryRetentionDays === null`) never see it.
- **Signal-gated, never always-on** (Today calm doctrine). It fires only when at least one memory's effective fade date is within the warning window (default 7 days) or already past — not for every free user with any memory.
- **Honest framing.** Copy states the plan's stated retention as the upgrade value, not a fake deletion countdown. It reads the real `agent_memory.expires_at` when present (the future DATA-RETENTION writer / founder expiry-flip stamps it) and falls back to the policy-implied fade (`created_at + retentionDays`) before then, so it lights up the moment either signal is real (claim-never-outruns-wiring).

## How it works

### Pure core — `src/lib/plg-memory-expiry.ts`

`assessMemoryExpiry({ memories, retentionDays, nowMs, warnWithinDays })` → `MemoryExpiryState`:

- `retentionDays === null` (paid) ⇒ `{ show:false }`.
- Else the effective fade date per memory = `expires_at` if set, else `created_at + retentionDays`. A memory is at risk when that date is `<= now + warnWithinDays`. `show` is true iff `expiringCount > 0`; `soonestDays` is the whole days to the soonest fade, clamped to ≥ 0 (over-the-limit reads "now").
- Server-free + totally defined (undated rows are never counted on a guess); `nowMs` injected for determinism. 8 bun:test cases.

### Server — `getMemoryExpiry({ workspaceId })` (`src/lib/today.functions.ts`)

Resolves the workspace's plan tier (account plan wins → workspace shim → free), short-circuits to `show:false` on a paid plan (no memory read), else reads the workspace's `agent_memory` (`created_at,expires_at`; RLS-scoped to the caller) and runs the pure assessor. Fail-safe: any error returns a non-showing state, so it can never break Today.

### Surface — `src/components/plg/MemoryExpiryBanner.tsx`

Self-contained (takes `workspaceId`, runs its own query); renders nothing unless `show`. Calm bento with an `--ember` left accent + CTA (the role-color law's needs-human/CTA accent), linking to `/settings?section=billing`. Wired into Today between the hero and the "Needs you" queue; drop-in for Brain too.

## Verify (live)

1. **Negative (paid):** on a pro/paid workspace, Today shows no banner (and renders normally). ✅ live-verified on Project Glasswing (pro).
2. **Positive (free, near-limit):** on a free workspace with a memory inside the warning window, the banner shows "N decision memor(y/ies) … reach it in D days … free 30-day retention window" with the "Keep my memory →" CTA. ✅ live-verified on a free workspace with a seeded near-limit memory (seed removed after).
3. **Calm (free, no risk):** a free workspace whose memory is all well inside the window shows no banner.

## Not in scope (deliberate)

- The actual fade ENFORCEMENT (purge / stamping `expires_at`) is the dormant DATA-RETENTION item, founder-timed. This banner reads the policy/expiry and lights up when it is real.
- The paid-conversion checkout leg (Stripe) is the billing surface; this only routes the user there.
