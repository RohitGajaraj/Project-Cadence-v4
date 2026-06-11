# Active tasks

> **2026-06-11 — v5 Chief-of-Staff rebuild ACTIVE.** Thesis, gap analysis, phases A–E: [`docs/strategy/v5-chief-of-staff-2026-06-11.md`](docs/strategy/v5-chief-of-staff-2026-06-11.md). Now building: **`F-V5-RITUAL`** (Phase A). Felt product = Today (Calls queue) · Product · Knowledge · Chat + Trust drawer; cockpit = expansion (v4 map).

---

## `F-V5-RITUAL` — Phase A: Today becomes the Calls queue (days 1–3)

**Spec:** v5 doc, Phase A row. **Key files:** `src/routes/_authenticated.index.tsx`, `src/components/cadence/AppShell.tsx`, `src/lib/copilot.functions.ts` (`generateDailyBrief`), `src/lib/governance.functions.ts`, `src/lib/missions.functions.ts`, `src/components/governance/CriticBadge.tsx`.

- [x] "Needs you" Calls section at top of Today (approvals + Critic-flagged opps/PRDs as call cards, inline Approve/Reject/Open via `getNeedsYou` in new `src/lib/today.functions.ts`)
- [x] Brief leads with "your calls today" + overnight agent activity (`ensureTodayBrief` rewritten)
- [x] **Start mission** button on Today → `startOrchestratedMission` direct (no chat-classifier dependency)
- [x] Cost chip in Today header (today's `ai_events` spend)
- [x] Approvals pinned to the workspace rail (Today · Approvals · Chat)
- [x] **F-V5-MOTHBALL landed same batch:** nav groups → Product · Missions · Knowledge; Trust icon row in sidebar footer (Approvals · Budgets · Engine Room · Connectors); `/build` → `/`, `/learn` → `/knowledge`, `/agents` → `/missions?tab=agents` redirects; "Chief of Staff" UI vocabulary. Build green (`bun run build:dev` exit 0); all touched files lint clean.
- [x] **Verified on `demo@redcadence.app`** (v5 bar 1, Playwright walkthrough 2026-06-11): 3 real call cards on login; inline Approve executed (queue 3→2, consistent on Govern page); Start-mission popover created + dispatched a real mission; nav = Today·Approvals·Chat + Product·Missions·Knowledge + Trust row; Engine Room 9 tabs intact; /build /learn /agents redirects pass. **Caveat:** brief-leads-with-calls could not execute locally — KI-06 (no AI-gateway key in local `.env`) blocks all model calls; verify after key added. New: KI-07 (mission stuck `running` on model failure). Screenshot: `v5-today-calls-queue.png` (repo root, untracked).
- [ ] Doc closure remainder: `architecture/frontend.md` (new nav + Today contract)
- [ ] Known risks to re-check in walkthrough: `startOrchestratedMission` awaits the full loop (30s+, possible Worker timeout → double-dispatch on retry); needs-you query has no polling; pre-existing repo-wide prettier drift (3,385 errors in untouched files — consider one-shot `eslint --fix` cleanup commit)

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
