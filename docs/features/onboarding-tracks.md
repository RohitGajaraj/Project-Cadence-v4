# W6 — Persona onboarding tracks

> Status · Shipped 2026-06-17 (on `main`; live UI walkthrough on next Lovable publish) · Route: `/onboarding` · Owner agent(s): none (setup flow); seeds Scout/Critic material

## What it does

A first-run user picks one of three personas (Solo PM, Founding PM, Tech Founder) as step 1 of a 4-step setup. Picking a track seeds their workspace with persona-matched sample data: a starter project, four realistic signals, and four ICE-scored opportunities (the first of which is always a teardown-worthy idea, so the WEDGE first-run has real material). The remaining steps connect data sources, review the agent staff, and hand the team a first goal. The result is a workspace that is never empty on first open.

## Why it exists

The cold-start problem: a brand-new workspace has nothing to prioritize, so the loop has no fuel and the value is invisible. Persona seeds give every new user immediate, relatable material to run a teardown against and a first-win moment without any setup work. W6 is also the delivery surface for the launch WEDGE. Build-log entry: [`../../plan.md`](../../plan.md) §4 (2026-06-17, W6).

## Where to find it

- Route: `/onboarding` (inside the authenticated shell, reached via the first-run gate in `src/lib/onboarding-gate.ts`).
- Step 1 of 4: "Pick your path" (`TrackSelector`). Steps 2-4 are the ported screen-8 flow (connect sources, meet your staff, hand a first goal).
- After finish, the user lands on `/` (Today), where the seeded data drives the cold-start WEDGE card.

## Demo script (≤ 90s)

1. Sign in as a fresh (not-yet-onboarded) account; the gate routes to `/onboarding`.
2. On "Pick your path", choose **Solo PM**. A toast confirms "Track selected"; the flow advances to step 2.
3. Step 2 "Where should Cadence listen?": leave connectors empty, click "Skip for now".
4. Step 3 "Meet your staff": toggle one specialist off and on (it now persists; see the fix note below), then Continue.
5. Step 4 "Hand them a first goal": the seeded themes appear as goal candidates. Pick one (or type your own), click Finish.
6. Land on Today; the seeded signals and opportunities are present and the WEDGE cold-start card has a real idea to tear down.

## How it works

- **UI**: `src/components/onboarding/TrackSelector.tsx` (step 0/1) and `src/components/onboarding/OnboardingFlow.tsx` (StepShell steps 2-4). The flow renumbered to 4 steps when TrackSelector took slot 0; state 1 is intentionally skipped (`step === 0` advances straight to `step === 2`), documented inline.
- **Seed data**: `src/lib/onboarding/track-seeds.ts` defines three `TrackSeed` objects (project, signals, opportunities) plus `trackDescriptions` for the selector cards. `getTrackSeed(track)` is exhaustively typed.
- **Server fn**: `seedWorkspaceForTrack` in `src/lib/onboarding.functions.ts` runs under `requireSupabaseAuth`. Order: guard against re-seed (rejects if any signal already exists) → get/create project → insert signals → insert opportunities → mark `profiles.onboarded = true` **last**, so a mid-flight failure leaves the user retryable rather than half-onboarded.
- **Schema contract**: writes through `SupabaseClient<Database>`, so the generated types are the contract for every column (`signals.source/title/content`, `opportunities.impact/confidence/ease/problem/target_user/status`, `projects.name`, `profiles.onboarded`). A clean `tsc --noEmit` is the verification.
- **Agent toggle**: step 3 calls `setAgentEnabled({ agentId, enabled })`, keyed by the agent row id.

## Governance & guardrails

- All writes are scoped to the authenticated `userId`; RLS enforces per-user isolation and each mutation re-checks `.eq("user_id", userId)`.
- Idempotent: re-seeding a workspace that already has signals is refused ("Workspace already seeded. Reset in Settings if you need to re-seed.").
- No autonomous agent action happens during onboarding; seeding is plain inserts, not a mission.

## Verification checklist

- [x] `tsc --noEmit` clean (schema contract holds for all seeded columns).
- [x] `eslint` clean on `onboarding.functions.ts` and `track-seeds.ts`.
- [x] Seed order writes `onboarded` last (retryable on partial failure).
- [x] Step-3 agent toggle persists (server now keyed by `agentId`, matching the only caller).
- [ ] Live UI walkthrough on the hosted app after the next Lovable publish (gated on publish, same as other 2026-06-17 ships).

## Known limits / out of scope

- Per-track default agent selection is not implemented. Agents default to `enabled = true` for every new user, so there is no per-track on/off curation; the earlier `agentSlugsToEnable` seed field was a no-op and was removed.
- Seeds are static sample data, not live ingest. Real signals arrive once a connector or the webhook is wired (see [`ingest-webhook.md`](./ingest-webhook.md)).
- The live UI walkthrough is verified post-publish; the local gates (tsc, eslint, logic + schema trace) stand in until then.

## Related

- [`../../plan.md`](../../plan.md) §4, build-log entry (2026-06-17, W6)
- [`wedge.md`](./wedge.md), the Critic-teardown first-run W6 feeds
- [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md), G5 row + P0 pick-list
- [`auth-flows.md`](./auth-flows.md), the auth + first-run gate that routes to `/onboarding`
