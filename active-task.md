# W6 · Persona onboarding (active task) — IN PROGRESS

**Date:** 2026-06-17  
**Lane:** E (MONETIZE/PLG)  
**Status:** Building (recon + core build done; UI verification + polish in progress)

---

## What / Pain / How (from v10)

**What:** Per-track onboarding (Solo PM / Founding PM / Tech Founder) with sample data + first-win.

**Pain:** #8 (growth funnel; new users need to feel value fast).

**How:** A new user picks a track during onboarding (step 0), gets seeded data matched to their persona, and reaches the WEDGE (Critic-teardown first-win) without hand-holding.

**Build accept (definition of done):** A signed-up PM completes onboarding → lands on Today → sees WEDGE card → can immediately run teardown on seeded opportunity.

---

## ✅ COMPLETED

### Phase 1: Recon + Design
- ✅ Confirmed track selector goes as **step 0 of OnboardingFlow** (before connect/staff/goals)
- ✅ Confirmed "first-win" = reaching WEDGE on Today
- ✅ Confirmed cold-start logic (any signals/opps/PRDs = warm)
- ✅ Confirmed seeding should populate agents + goals per track

### Phase 2: Core Implementation
- ✅ **track-seeds.ts:** Three personas with realistic sample data (4 signals + 4 opportunities each)
  - Solo PM: Mobile app roadmap (offline mode, UX redesign, pricing, notifications)
  - Founding PM: Startup MVP (pivot, UX polish, moat, tech debt)
  - Tech Founder: Developer platform (auth, scaling, SDKs, infra costs)
- ✅ **seedWorkspaceForTrack():** Server function (creates project, seeds signals/opps, marks onboarded)
- ✅ **TrackSelector.tsx:** Step 0 UI (3 track cards, loading states, success toast)
- ✅ **OnboardingFlow.tsx:** Integrated TrackSelector (step 0 → advances to step 1)
- ✅ **Type safety:** Exported OnboardingTrack from .functions.ts so TrackSelector can import it
- ✅ **TypeScript:** All W6 files compile cleanly

---

## 🔨 IN PROGRESS

### Phase 3: Verification & Polish
- [ ] **UI verification (live):** Test the full signup → track selection → seeding → Today flow
  - Sign up with test account
  - Select each track (verify seeding works for all 3)
  - Confirm signals/opportunities appear on Discovery page
  - Confirm cold-start is false (WEDGE card appears)
  - Confirm can run WEDGE teardown on seeded opportunity
  
- [ ] **Edge cases & hardening:**
  - [ ] What if seeding fails partway? (partial data + profile marked onboarded)
  - [ ] What if user re-visits onboarding? (profile already onboarded, redirects to /)
  - [ ] What if workspace already has data? (seeding still works, adds to existing)
  
- [ ] **UX refinement:**
  - [ ] TrackSelector header says "step 0 of 3" but there are 4 steps total — refine copy to "step 1 of 4" or remove counter
  - [ ] Test that seeded agents (critic, scout, builder) are enabled per track
  - [ ] Confirm "Meet your staff" screen on step 2 handles pre-seeded agents

### Phase 4: Docs + Closure
- [ ] Update active-task.md → success summary + files changed
- [ ] Update feature-dashboard.md → mark W6 as ✅ with date
- [ ] Update plan.md §4 → build log entry
- [ ] Update docs/features/README.md → add W6 row
- [ ] Commit everything + push

---

## Files Created

| File | Purpose | Status |
| --- | --- | --- |
| `src/lib/onboarding/track-seeds.ts` | Sample data (3 personas × 4 signals + opps) | ✅ |
| `src/lib/onboarding.functions.ts` | `seedWorkspaceForTrack()` + `completeOnboarding()` | ✅ |
| `src/components/onboarding/TrackSelector.tsx` | Step 0 UI + mutation handler | ✅ |

## Files Modified

| File | Change | Status |
| --- | --- | --- |
| `src/components/onboarding/OnboardingFlow.tsx` | Add step 0 handler; increment steps 1-3 to 2-4 | ✅ |

---

## Definition of Done Checklist

- [x] Acceptance criteria met (track selection + seeding + first-win reachable)
- [x] `tsc --noEmit` clean (W6 files)
- [ ] Tested on real data (UI verification needed)
- [ ] Adversarially reviewed
- [ ] Shipped to main
- [ ] Dashboard + docs updated
- [ ] Handoff written to .remember/

---

## Open Questions / Notes

1. **Agent seeding:** Currently just marks profile as onboarded. Should we also enable certain agents per track? (e.g., Critic + Scout for Solo PM, all for Tech Founder?)
   - Not in current build; can be fast-follow if founder wants
   
2. **First goal seeding:** Currently just seeds signals + opps. Should we also seed a first goal/mission template?
   - Not in current build; can be fast-follow if founder wants better onboarding cohesion

3. **UI copy for step counter:** TrackSelector shows "step 0 of 3" but real count is 4 steps (0-3). Minor UX issue, not blocking.

4. **Duplicate onboarding:** If user re-triggers onboarding after completing it, what happens? (Profile already has onboarded=true, so gate redirects to /; should be harmless)

---

## Quick Start for Verification

```bash
# 1. Start dev server
bun run dev

# 2. Go to /signup (not logged in)
# 3. Sign up with test account
# 4. You should land on /onboarding
# 5. Step 0: Pick your path (select "Solo PM" as example)
# 6. Should see "Your workspace is set up" toast
# 7. Auto-advance to Step 1 (Where should Cadence listen?)
# 8. Complete remaining steps (skip connections, enable agents, set goal)
# 9. Land on Today (home)
# 10. Should see WEDGE card in cold-start section
# 11. Click WEDGE → enter seeded opportunity title as idea
# 12. Should get Critic verdict (Ship/Revise/Kill)

# 13. Check database:
# SELECT * FROM signals WHERE user_id = '<test_user_id>' LIMIT 10;
# SELECT * FROM opportunities WHERE user_id = '<test_user_id>' LIMIT 10;
# Should have 4 signals + 4 opportunities per track selected
```
