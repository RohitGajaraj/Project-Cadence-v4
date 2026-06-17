# W6 · Persona onboarding (active task)

**Date:** 2026-06-17  
**Lane:** E (MONETIZE/PLG)  
**Parallel-safe with:** A, B, C  
**Blocked by:** None  

---

## What / Pain / How (from v10)

**What:** Per-track onboarding (Solo PM / Founding PM / Tech Founder) with sample data + first-win.

**Pain:** #8 (growth funnel; new users need to feel value fast).

**How:** A new user picks a track at signup, gets seeded data matched to their persona, and reaches the WEDGE (Critic-teardown first-win) without hand-holding.

**Build accept (definition of done):** A signed-up PM reaches first-win (the WEDGE teardown) without hand-holding.

---

## Acceptance criteria

1. **Track selection UI:** At signup (or post-login first-time), user selects one of three onboarding tracks:
   - Solo PM (individual, self-managed)
   - Founding PM (early-stage startup)
   - Tech Founder (technical founder, code-aware)

2. **Seeded data:** Each track receives curated sample data:
   - A sample product (or several, depending on track)
   - Starter signals/opportunities/PRD (realistic for that persona)
   - First opportunity is seeded such that running WEDGE on it is the natural first action

3. **Navigation to first-win:** After onboarding, the user lands on Today (home), sees the WEDGE card in cold-start, and can run the teardown.

4. **No hand-holding:** The flow is self-explanatory; no tooltips or forced modals. Sample data makes the next step obvious.

---

## Files to touch

### New files:
- `src/components/onboarding/TrackSelector.tsx` — persona track selection form (Solo/Founding/Tech Founder)
- `src/lib/onboarding.functions.ts` — server functions: `seedWorkspaceForTrack({ track })` + data fixtures
- `src/lib/onboarding/track-seeds.ts` — sample data per persona (products, signals, opportunities, workspace config)

### Modified files:
- `src/routes/sign-up.tsx` or entry point — wire the track selector into the post-signup flow
- `src/routes/_authenticated.index.tsx` — ensure cold-start WEDGE is visible and accessible post-onboarding

### Database:
- No migration needed (seed data writes to existing tables: `projects`, `signals`, `opportunities`, `products`)
- May add optional `workspace_onboarded_track` column to `workspaces` for future reference

---

## Implementation order

1. Spec the tracks & sample data
2. Build `track-seeds.ts` with three persona seed sets
3. Build `onboarding.functions.ts` with `seedWorkspaceForTrack`
4. Build `TrackSelector.tsx` component
5. Wire into signup/post-login flow
6. Verify data appears on Today with cold-start false

---

## Acceptance signal

User signs up → selects track → sees seeded data → can run WEDGE teardown as first action.
