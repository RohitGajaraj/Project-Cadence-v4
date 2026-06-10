# Active tasks

> **2026-06-11 — `F-IA-V4` (7-surface IA collapse) STRUCTURALLY COMPLETE.** Phases 1a–1d all shipped: `/missions`, `/govern`, `/product`, `/knowledge`, `/learn` live as tabbed surfaces; every absorbed legacy route flipped to `beforeLoad` redirects. Pinned rail = Today · Approvals · Knowledge · Chat. Calendar is the default tab of `/knowledge` so daily muscle memory survives.
>
> **Remaining for the F-IA-V4 ticket itself:** Phase 2 (AppShell pinned-rail rewrite to spec-literal `Home · Chat · Missions` + drop Approvals/Calendar entirely), and Phase 4 doc closure update on `architecture/frontend.md`. Both are small. Open as separate work when picked up.
>
> **Follow-ups spawned by 1d:** `F-DECISIONS-CAPTURE` — wire mission / spec / meeting extract → entries in `/knowledge?tab=decisions`. Backlog row pending.

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
- [ ] Smoke test: open `/knowledge?tab=calendar`, click Connect Google, verify popup → consent → chip appears with email
- [ ] Smoke test: same for Microsoft Outlook
- [ ] Verify Sync now pulls events from connected account
- [ ] Verify Edit / Delete on a synced event flows through to provider
- [ ] Delete this `active-task.md` and flip `F-CALENDAR-PERUSER` to ✅ in `docs/planning/feature-backlog.md`

## Done when

Both Connect buttons complete a full OAuth round trip and a real provider event is created / edited / deleted via the in-app dialog.
