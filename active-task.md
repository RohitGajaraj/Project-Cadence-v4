# Active tasks

> **2026-06-11 — v4 feature-map rebuild: COMPLETE.** The strategic source of truth is now [`docs/strategy/v4-feature-map-2026-06-11.md`](docs/strategy/v4-feature-map-2026-06-11.md). Next build work = **Milestone M1 "The Golden Path"** (start with `F-IA-V4`, the 7-surface IA collapse). Full session log + resume instructions: [`docs/planning/v4-rebuild-handoff-2026-06-11.md`](docs/planning/v4-rebuild-handoff-2026-06-11.md).

---

## In-flight — F-IA-V4 (7-surface IA collapse)

**Status:** Phase 1a shipped (Missions surface). Approved plan: [`.lovable/plan.md`](.lovable/plan.md).

### Done

- [x] Promote `/missions` to be the real v4 IA "Missions" station (`?tab=missions|agents`).
- [x] Convert `/cockpit` to `beforeLoad` redirect → `/missions` (preserves `?tab`).
- [x] Repoint `/swarm` redirect → `/missions?tab=agents`.
- [x] Update sidebar (`AppShell.tsx`) + command palette to `/missions`.
- [x] Update component-internal links in `_authenticated.agents.tsx` + `_authenticated.missions.$missionId.tsx`.

### Next slice (Phase 1b) — `/govern` surface

- [ ] Extract `ControlsPanel` from `_authenticated.governance.tsx` (currently inline ~600 lines) into `src/components/governance/ControlsPanel.tsx`.
- [ ] Extract `EvalsPanel`, `DriftPanel` (already exists in observe), `PromptsPanel` bodies from their full-page routes.
- [ ] Create `_authenticated.govern.tsx` with tabs: Controls · Approvals · Guardrails · Budgets · Traces · Evals · Drift · Prompts.
- [ ] Convert `/governance`, `/observe`, `/guardrails`, `/budgets`, `/evals`, `/drift`, `/prompts`, `/traces` (index) → `beforeLoad` redirects.

### Phase 1c — Product surface

- [ ] Extract panel bodies from `/discovery`, `/opportunities`, `/prds`, `/roadmap`, `/tasks`, `/outcome`.
- [ ] Create `_authenticated.product.tsx` with tabs: Signals · Opportunities · Specs · Roadmap · Releases.

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
