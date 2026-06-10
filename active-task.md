# Active tasks

> **2026-06-11 — v4 feature-map rebuild: COMPLETE.** The strategic source of truth is now [`docs/strategy/v4-feature-map-2026-06-11.md`](docs/strategy/v4-feature-map-2026-06-11.md). Next build work = **Milestone M1 "The Golden Path"** (start with `F-IA-V4`, the 7-surface IA collapse). Full session log + resume instructions: [`docs/planning/v4-rebuild-handoff-2026-06-11.md`](docs/planning/v4-rebuild-handoff-2026-06-11.md).

---

## In-flight — F-IA-V4 (7-surface IA collapse)

**Status:** Phase 1a + 1b + 1b-2 + 1c shipped (Missions + Govern + Product). Approved plan: [`.lovable/plan.md`](.lovable/plan.md).

### Done

- [x] Promote `/missions` to be the real v4 IA "Missions" station (`?tab=missions|agents`).
- [x] Convert `/cockpit` to `beforeLoad` redirect → `/missions` (preserves `?tab`).
- [x] Repoint `/swarm` redirect → `/missions?tab=agents`.
- [x] Update sidebar (`AppShell.tsx`) + command palette to `/missions`.
- [x] Update component-internal links in `_authenticated.agents.tsx` + `_authenticated.missions.$missionId.tsx`.
- [x] Extract `ControlsPanel` from `_authenticated.governance.tsx` (~580 lines) into `src/components/governance/ControlsPanel.tsx`.
- [x] Create `_authenticated.govern.tsx` with 7 tabs: Controls · Approvals · Guardrails · Budgets · Analytics · Traces · Drift.
- [x] Convert `/governance` + `/observe` → `beforeLoad` redirects to `/govern` (preserves tab).
- [x] Repoint `/guardrails`, `/budgets`, `/drift`, `/traces`, `/inbox`, `/analytics` → `/govern`.
- [x] Update `AppShell.tsx` nav + footer pause-banner + `CommandPalette.tsx` to `/govern`.
- [x] Extract `EvalsPanel` from `_authenticated.evals.tsx` (~617 lines) → `src/components/governance/EvalsPanel.tsx`.
- [x] Extract `PromptsPanel` from `_authenticated.prompts.tsx` (~655 lines) → `src/components/governance/PromptsPanel.tsx`.
- [x] Add `prompts` + `evals` tabs to `/govern` (Govern now has 9 tabs); widen container to `max-w-[1400px]`.
- [x] Convert `/evals` + `/prompts` → `beforeLoad` redirects to `/govern?tab=…`.
- [x] Repoint sidebar: Prompts moved from Agents group into Govern group; both Prompts + Evals now deep-link to `/govern?tab=…`.
- [x] Extract panel bodies from `/discovery`, `/opportunities`, `/prds`, `/roadmap`, `/tasks` into `src/components/product/{Signals,Opportunities,Specs,Roadmap,Tasks}Panel.tsx`; extract the Releases slice of `/outcome` into `ReleasesPanel.tsx`.
- [x] Create `_authenticated.product.tsx` with 6 tabs: Signals · Opportunities · Specs · Roadmap · Tasks · Releases.
- [x] Convert `/discovery`, `/opportunities`, `/roadmap`, `/tasks` → `beforeLoad` redirects to `/product?tab=…`. `/prds` split into a layout + `prds.index` redirect so `/prds/$id` still renders.
- [x] Repoint sidebar: collapsed `discover` + `deliver` groups into a single **Product** group with deep-links; spun off Builder + Docs into a new **Build** group. `/outcome` group stays until Phase 1d folds Launches/Support/Learnings into Learn.

### Phase 1d — Knowledge + Learn surfaces

- [ ] `_authenticated.knowledge.tsx` (Memory · Docs · Calendar tabs); absorb `/docs`, fold `/calendar` and `/meetings` in as tabs (currently top-level).
- [ ] `_authenticated.learn.tsx` (Support · Outcomes · Learnings tabs).

### Phase 2 — AppShell rewrite

- [ ] New nav: pinned (`Home · Chat · Missions`) + collapsible groups (Product, Knowledge, Learn, Govern, Settings).
- [ ] Drop `Approvals` + `Calendar` from pinned rail (move into Home needs-you queue + Knowledge tab respectively).
- [ ] Update `architecture/frontend.md` pinned-rail contract + surface contracts.

### Done when

All 7 v4 surfaces exist as real routes, every absorbed route is a `beforeLoad` redirect, AppShell + command palette match the v4 IA, and `architecture/frontend.md` documents the new contracts. Then flip `F-IA-V4` to ☑ in the backlog and delete this section.

---

## Open ops task — Calendar OAuth credentials

**Task:** Add provider Client IDs to unlock per-user calendar connect.
**Owner:** workspace admin
**Decision doc:** [`docs/decisions/calendar-oauth-credentials.md`](docs/decisions/calendar-oauth-credentials.md)

## Sub-steps

- [ ] Create Google OAuth Client ID (Google Cloud Console)
- [ ] Add backend secret `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID`
- [ ] Create Microsoft App Registration (Entra admin center)
- [ ] Add backend secret `MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID`
- [ ] Smoke test: open `/calendar`, click Connect Google, verify popup → consent → chip appears with email
- [ ] Smoke test: same for Microsoft Outlook
- [ ] Verify Sync now pulls events from connected account
- [ ] Verify Edit / Delete on a synced event flows through to provider
- [ ] Delete this `active-task.md` and flip `F-CALENDAR-PERUSER` to ✅ in `docs/feature-backlog.md`

## Done when

Both Connect buttons complete a full OAuth round trip and a real provider event is created / edited / deleted via the in-app dialog.
