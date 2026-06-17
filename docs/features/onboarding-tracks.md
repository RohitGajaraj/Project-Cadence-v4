# W6 — Persona onboarding tracks

> Status · Shipped 2026-06-17 · OAuth first-run gate fix + 4-step UI redesign 2026-06-17 · **RLS seed hotfix 2026-06-18** (track-pick crashed every new user with a `projects` RLS error; now self-heals the workspace) · **Basic-details step + credentials-only signup 2026-06-18** (single name/role capture shared by email + Google; fixes the `abc.def` display-name) · (on `main`; live UI walkthrough on next publish) · Route: `/onboarding` · Owner agent(s): none (setup flow); seeds Scout/Critic material

## What it does

A first-run user picks one of three personas (Solo PM, Founding PM, Tech Founder) as step 1 of a 4-step setup. Picking a track seeds their workspace with persona-matched sample data: a starter project, four realistic signals, and four ICE-scored opportunities (the first of which is always a teardown-worthy idea, so the WEDGE first-run has real material). The remaining steps connect data sources, review the agent staff, and hand the team a first goal. The result is a workspace that is never empty on first open.

## Why it exists

The cold-start problem: a brand-new workspace has nothing to prioritize, so the loop has no fuel and the value is invisible. Persona seeds give every new user immediate, relatable material to run a teardown against and a first-win moment without any setup work. W6 is also the delivery surface for the launch WEDGE. Build-log entry: [`../../plan.md`](../../plan.md) §4 (2026-06-17, W6).

## Where to find it

- Route: `/onboarding` (inside the authenticated shell, reached via the first-run gate in `src/lib/onboarding-gate.ts`).
- **Basic details** (`BasicDetailsStep`): the first gate, shown only when the profile has no `display_name` (every Google signup, and now every email signup since sign-up is credentials-only). Captures name + role; never counted in "step X of 4".
- Step 1 of 4: "Pick your path" (`TrackSelector`). Steps 2-4 are the ported screen-8 flow (connect sources, meet your staff, hand a first goal).
- After finish, the user lands on `/` (Today), where the seeded data drives the cold-start WEDGE card.

## Demo script (≤ 90s)

1. Sign in as a fresh (not-yet-onboarded) account; the gate routes to `/onboarding`.
2. **Basic details**: enter first/last name + role (a Google signup arrives prefilled), click "Continue · setup begins".
3. On "Pick your path", choose **Solo PM**. A toast confirms "Track selected"; the flow advances to step 2.
4. Step 2 "Where should Cadence listen?": leave connectors empty, click "Skip for now".
5. Step 3 "Meet your staff": toggle one specialist off and on (it now persists; see the fix note below), then Continue.
6. Step 4 "Hand them a first goal": the seeded themes appear as goal candidates. Pick one (or type your own), click Finish.
7. Land on Today; the seeded signals and opportunities are present and the WEDGE cold-start card has a real idea to tear down.

## How it works

- **UI**: `src/components/onboarding/TrackSelector.tsx` (step 0/1) and `src/components/onboarding/OnboardingFlow.tsx` (StepShell steps 2-4). The flow renumbered to 4 steps when TrackSelector took slot 0; state 1 is intentionally skipped (`step === 0` advances straight to `step === 2`), documented inline.
- **Basic details gate**: `src/components/onboarding/BasicDetailsStep.tsx` renders before `step === 0` when the profile has no `display_name`. It is the single identity-capture surface shared by both signup paths (sign-up is now credentials-only). It writes `profiles` (via `updateProfile`) AND auth `user_metadata` (via `supabase.auth.updateUser`), because the Today greeting reads the profiles row while the AppShell chip + chat header read `user_metadata`. Google signups prefill from `given_name`/`family_name`/`full_name`; the email local-part is never used as a name. Full rationale: [`auth-flows.md`](./auth-flows.md).
- **Seed data**: `src/lib/onboarding/track-seeds.ts` defines three `TrackSeed` objects (project, signals, opportunities) plus `trackDescriptions` for the selector cards. `getTrackSeed(track)` is exhaustively typed.
- **Server fn**: `seedWorkspaceForTrack` in `src/lib/onboarding.functions.ts` runs under `requireSupabaseAuth`. Order: guard against re-seed (rejects if any signal already exists) → **resolve/create the default workspace** (`ensureDefaultWorkspace`) → get/create project → insert signals → insert opportunities → mark `profiles.onboarded = true` **last**, so a mid-flight failure leaves the user retryable rather than half-onboarded.
- **Workspace self-heal (2026-06-18 RLS hotfix)**: post-tenancy-retrofit the write RLS on `projects` / `signals` / `opportunities` is membership-keyed (`is_workspace_member(workspace_id)`), and `workspace_id` only auto-fills from the `current_user_default_workspace()` column default — which is NULL for a user with no `workspace_members` row. A brand-new user can reach onboarding (their first write) before signup provisioning created that row (`ensure_default_workspace` runs in a swallow-all block in `handle_new_user`, isn't in our migrations, and demo accounts skip it), so the insert hit `is_workspace_member(NULL) = false` → _"new row violates row-level security policy for table projects"_. `ensureDefaultWorkspace(supabase, userId)` now resolves-or-creates the workspace + owner membership (RLS permits the user-scoped client to do both) and every insert sets `workspace_id` **explicitly** — the path migration `20260530120200_tenancy_c` documented as intended. See [`../planning/known-issues.md`](../planning/known-issues.md) for the deeper signup-provisioning follow-up.
- **Schema contract**: writes through `SupabaseClient<Database>`, so the generated types are the contract for every column (`signals.source/title/content`, `opportunities.impact/confidence/ease/problem/target_user/status`, `projects.name`, `profiles.onboarded`). A clean `tsc --noEmit` is the verification.
- **Agent toggle**: step 3 calls `setAgentEnabled({ agentId, enabled })`, keyed by the agent row id.
- **First-run gate**: `_authenticated.tsx beforeLoad` routes a user to `/onboarding` when `profiles.onboarded === false`. The gate (`src/lib/onboarding-gate.ts`) is the single source of truth: if an authenticated user has **no** profile row it creates one with `onboarded=false` (`upsert` with `ignoreDuplicates`, never clobbering an existing row) and routes them into first-run. This is what makes onboarding fire for **Google OAuth** signups, which have no client-side profile write and depend on the unreliable `handle_new_user` trigger (KI-13).
- **Design (2026-06-17 redesign)**: Ember Editorial, value-forward. Each step names the outcome, not the mechanism (engine-room-doctrine): step 1's persona cards preview the real workspace + first teardown they deliver (read from the seed data); steps 2-4 carry serif italic-em titles (`listen` / `staff` / `goal`) and value copy. Ember is reserved for the single primary CTA (role-color law); entrance is a staggered transform-only reveal with `.lift` press feedback, reduced-motion gated. Built with the `impeccable` (onboard) + `emil-design-eng` craft lenses; the user-facing copy is em-dash-free (humanized-output).

## Governance & guardrails

- All writes are scoped to the authenticated `userId`; RLS enforces per-user isolation and each mutation re-checks `.eq("user_id", userId)`.
- Idempotent: re-seeding a workspace that already has signals is refused ("Workspace already seeded. Reset in Settings if you need to re-seed.").
- No autonomous agent action happens during onboarding; seeding is plain inserts, not a mission.

## Verification checklist

- [x] `tsc --noEmit` clean (schema contract holds for all seeded columns).
- [x] `eslint` clean on `onboarding.functions.ts` and `track-seeds.ts`.
- [x] Seed order writes `onboarded` last (retryable on partial failure).
- [x] Step-3 agent toggle persists (server now keyed by `agentId`, matching the only caller).
- [x] `seedWorkspaceForTrack` resolves/creates the workspace + sets `workspace_id` explicitly (no longer trips the membership RLS for a freshly-provisioned user) — `tsc`/`eslint`/`build` green 2026-06-18.
- [ ] Live: a fresh **non-demo** signup → pick any track lands on step 2 with no RLS error (verify after republish — this was the demo-blocking crash).
- [ ] Live UI walkthrough on the hosted app after the next publish — confirm a fresh **Google** signup now lands on step 1 "Pick your path" (the gate self-heal fix), NOT straight on Home. (The 2026-06-17 publish exposed it landing on Home; root cause: no profile row for OAuth signups + a fail-open gate.)

## Known limits / out of scope

- Per-track default agent selection is not implemented. Agents default to `enabled = true` for every new user, so there is no per-track on/off curation; the earlier `agentSlugsToEnable` seed field was a no-op and was removed.
- Seeds are static sample data, not live ingest. Real signals arrive once a connector or the webhook is wired (see [`ingest-webhook.md`](./ingest-webhook.md)).
- The live UI walkthrough is verified post-publish; the local gates (tsc, eslint, logic + schema trace) stand in until then.

## Related

- [`../../plan.md`](../../plan.md) §4, build-log entry (2026-06-17, W6)
- [`wedge.md`](./wedge.md), the Critic-teardown first-run W6 feeds
- [`../planning/feature-dashboard.md`](../planning/feature-dashboard.md), G5 row + P0 pick-list
- [`auth-flows.md`](./auth-flows.md), the auth + first-run gate that routes to `/onboarding`
