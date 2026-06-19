# WEDGE — the Critic-teardown first-run

> _Created: 2026-06-17 · Last updated: 2026-06-19_

> **Status:** ✅ Shipped to `main` (2026-06-17). The v10 launch wedge (P0 #2). Lane C (DECIDE).
> **One line:** point Cadence at a feature you believe in and get an evidence-backed teardown in your first session, with no setup.

## Why it exists

The felt entry. Pain #2 in the v10 map is "a PM cannot defend their calls." The wedge answers that in the first ten minutes: a brand-new account names a feature it believes in and gets an honest, adversarial red-team back, with the risks, the conditions that would kill the bet, and what the operator cannot prove yet. It needs no connected source and no seeded data, so the first win lands before any wiring. Strategy canon: [`v9-decision-wedge-and-build-next`](../strategy/v9-decision-wedge-and-build-next.md) (the Critic-teardown wedge), [`v10-master-blueprint`](../strategy/v10-master-blueprint.md) §15.

## What it does

1. On a cold-start Today (no signals, opportunities, or specs yet), the **"See why your idea might be wrong"** card leads the "Start here" section, above the signal on-ramp.
2. The operator types the idea (plus an optional problem and target user).
3. On submit, the idea is recorded as an **opportunity** verbatim (neutral ICE, no AI embellishment), and the **existing Critic** (`runCritic`, DEC-02) red-teams it inline in the same call.
4. The verdict (Ship / Revise / Kill) lands in place with the summary and three sections: **Risks**, **What would kill it**, and **What you cannot prove yet** (`missing_evidence`). The idea persists as an opportunity, so the first-run feeds straight into the normal product flow.

## How it is wired (no new AI infra, no migration)

The Critic engine, the `opportunities` table (`critic_review jsonb`), and the `VerdictChip` / `CriticBadge` renderers already existed, so the wedge is pure integration:

- **Server:** `runWedgeTeardown` in [`src/lib/discovery.functions.ts`](../../src/lib/discovery.functions.ts) — `createServerFn` + `requireSupabaseAuth`, inserts the opportunity (user-scoped RLS, scoped to the active product when present), then calls the module-private `runCritic({ kind: "opportunity", id })`. Returns `{ opportunity, review }`. The verdict can be `null` (e.g. no AI gateway in local dev); the surface shows an honest fallback rather than a broken card.
- **Surface:** [`src/components/today/WedgeTeardown.tsx`](../../src/components/today/WedgeTeardown.tsx) — a self-contained form → result state machine that reuses the `VerdictChip` tones (moss / ember / madder).
- **Mount:** the cold-start branch of [`src/routes/_authenticated.index.tsx`](../../src/routes/_authenticated.index.tsx).

### The one non-obvious correctness fix

Running the teardown creates the workspace's first opportunity, which flips `getColdStart → isCold` to `false`. The result is rendered inside the `isCold` branch, so a stray refetch would unmount it and discard the verdict the operator just earned. Two guards prevent that: the component holds the result in local state and does **not** invalidate `["cold-start"]`, and the `["cold-start"]` query sets `refetchOnWindowFocus: false` + `refetchOnReconnect: false` so it only re-evaluates on a genuine remount (the next Today visit). Engine-Room stamp lives at the top of `WedgeTeardown.tsx`.

## Verify

Local dev has no AI key, so the full cited verdict only renders on the deployed app; locally you can confirm the form and the honest "Critic could not run" fallback. On the deployed build:

1. Sign in with an **empty** workspace (no signals / opportunities / specs) so Today is in cold-start.
2. The "See why your idea might be wrong" card is the first thing under "Start here."
3. Type a feature idea (e.g. "Add an AI summary to the top of every report"), optionally a problem and a target user, and run it.
4. Within ~a minute the verdict (Ship / Revise / Kill) appears with the summary, risks, kill criteria, and evidence gaps. The idea is now in `/product?tab=opportunities` with the same Critic verdict on its card.

## Known limits / fast-follows

- The Critic currently red-teams the idea in isolation. Feeding **connected signals** into the teardown ("with receipts" from the operator's own data) is the natural next step and ties into MOAT-VIS.
- The intake is cold-start only (the build-accept is the first-run). A "tear down any idea, any time" entry for existing users is a fast-follow.
- The shareable teardown (`F-SHARE-TEARDOWN`, the viral loop) reuses this verdict on the public `/t/$slug` card — full detail in [`shareable-teardowns.md`](./shareable-links.md).

## Related

- [`critic-agent.md`](./critic-agent.md) — the Critic engine the wedge wires (DEC-02 / DEF-03).
- [`shareable-decisions.md`](./shareable-links.md) — the share rails `F-SHARE-TEARDOWN` will reuse.
- [Feature dashboard](../planning/feature-dashboard.md) · [v10 implementation plan](../planning/v10_implementation-plan.md).
