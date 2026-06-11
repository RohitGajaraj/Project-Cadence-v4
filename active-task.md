# Active tasks

> **2026-06-11 — v5 Chief-of-Staff rebuild.** Spec: [`docs/strategy/v5-chief-of-staff-2026-06-11.md`](docs/strategy/v5-chief-of-staff-2026-06-11.md). Phases A (`F-V5-RITUAL`) + B (`F-V5-MOTHBALL`) ✅ shipped + walkthrough-verified (incl. AI brief via the Gemini local fallback). Phase D (`F-V5-LOOP-CLOSE`) **code landed, one gate open — see below**.

---

## `F-V5-LOOP-CLOSE` — Phase D status

- [x] Migration written: `supabase/migrations/20260611161500_f_v5_loop_close_learnings.sql` (learnings table + prds.shipped_at/outcome + profiles.voice_anchor_text + hourly outcome-tick cron) — audited purely additive
- [x] Server: `checkPrdShipped` (GitHub issue-state read, idempotent ship stamp) · `recordOutcome` (verdict → confidence ±2 → learning row with prior/new ICE) · `listLearnings` · `api/public/hooks/outcome-tick.ts`
- [x] UI: `OutcomeCard` on PRD detail (3 states) · re-score delta chip beside ICE in OpportunitiesPanel
- [x] Loop: KI-07 fixed (failed model call ⇒ run `failed`, mission `halted`) · recalled memories persisted to checkpoints + "Memory context · N" pill on mission hops · voice anchor end-to-end (settings → profiles → agent prompts)
- [x] Verify: lint + `bun run build:dev` green on all touched files
- [ ] **GATE (founder): authorize the migration apply to the live DB** (KI-08) — until then outcome/learnings/voice-anchor features are inert; everything else deployed is unaffected
- [ ] After apply: regenerate Supabase types (removes the untyped casts), then walk the loop end-to-end: approve a PRD with an issue → close the issue → "Check ship status" → record outcome → see the re-score chip in Opportunities
- [ ] Doc closure remainder: `architecture/orchestration.md` (halted-mission semantics) + `docs/features/` operator page for the outcome loop

## Open ops task — Slack app credentials (gates `F-V5-SLACK`, Phase C)

**Owner:** founder. Day-6 fallback: `feedback@` email-forward + webhook ingest instead.

- [ ] Create a Slack app (scopes: `channels:history`, `channels:read`)
- [ ] Provide client ID + secret as wrangler secrets

## Open ops task — Calendar OAuth credentials (KI-01, unchanged)

**Owner:** workspace admin. **Decision doc:** [`docs/decisions/calendar-oauth-credentials.md`](docs/decisions/calendar-oauth-credentials.md)

- [ ] Google OAuth Client ID → secret `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID`
- [ ] Microsoft App Registration → secret `MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID`
- [ ] Smoke test both Connect buttons on `/knowledge?tab=calendar`; then flip `F-CALENDAR-PERUSER` ✅
