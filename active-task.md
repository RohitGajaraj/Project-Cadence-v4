# Active tasks

> **2026-06-11 — v5 Chief-of-Staff rebuild ACTIVE.** Thesis, gap analysis, phases A–E: [`docs/strategy/v5-chief-of-staff-2026-06-11.md`](docs/strategy/v5-chief-of-staff-2026-06-11.md). Now building: **`F-V5-RITUAL`** (Phase A). Felt product = Today (Calls queue) · Product · Knowledge · Chat + Trust drawer; cockpit = expansion (v4 map).

---

## `F-V5-RITUAL` — Phase A: Today becomes the Calls queue (days 1–3)

**Spec:** v5 doc, Phase A row. **Key files:** `src/routes/_authenticated.index.tsx`, `src/components/cadence/AppShell.tsx`, `src/lib/copilot.functions.ts` (`generateDailyBrief`), `src/lib/governance.functions.ts`, `src/lib/missions.functions.ts`, `src/components/governance/CriticBadge.tsx`.

- [ ] "Needs you" Calls section at top of Today: pending `agent_approvals` + Critic-flagged (revise/kill) opportunities + PRDs as call cards — evidence snippet, Critic verdict chip, inline Approve / Reject / Open
- [ ] Brief rewritten to lead with "your N calls today," then overnight agent activity (from `agent_runs`)
- [ ] **Start mission** button on Today (+ Missions surface): direct `createMission` + orchestrator dispatch — no chat-classifier dependency
- [ ] Cost chip in Today header: today's spend from `ai_events` (tap → Trust drawer/budgets)
- [ ] Approvals pinned to the workspace rail
- [ ] Verify on `demo@redcadence.app`: ≥2 real call cards on login; approve one → executes + decision logs without leaving Today
- [ ] Doc closure: backlog board + plan.md §4 + `architecture/frontend.md`; update this file → flip to `F-V5-MOTHBALL`

**Done when:** verification bar 1 in the v5 doc passes end-to-end on a demo account.

---

## Open ops task — Slack app credentials (gates `F-V5-SLACK`, Phase C — needed by ~day 4)

**Owner:** founder/workspace admin.

- [ ] Create a Slack app (OAuth, scopes: `channels:history`, `channels:read`, `chat:write` optional)
- [ ] Add client ID + secret as wrangler secrets (names TBD in Phase C migration)
- [ ] Fallback decision (day 6): if creds stall, ship `feedback@` email-forward + webhook ingest instead

## Open ops task — Calendar OAuth credentials (KI-01, unchanged)

**Owner:** workspace admin. **Decision doc:** [`docs/decisions/calendar-oauth-credentials.md`](docs/decisions/calendar-oauth-credentials.md)

- [ ] Google OAuth Client ID → secret `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID`
- [ ] Microsoft App Registration → secret `MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID`
- [ ] Smoke test both Connect buttons on `/knowledge?tab=calendar`; then flip `F-CALENDAR-PERUSER` ✅ in the backlog
