# Active tasks

> **2026-06-11 — v5 Chief-of-Staff rebuild.** Spec: [`docs/strategy/v5-chief-of-staff-2026-06-11.md`](docs/strategy/v5-chief-of-staff-2026-06-11.md). Phases A (`F-V5-RITUAL`) + B (`F-V5-MOTHBALL`) ✅ shipped + walkthrough-verified (incl. AI brief via the Gemini local fallback). Phase D (`F-V5-LOOP-CLOSE`) **code landed, one gate open — see below**.

---

## `F-V5-LOOP-CLOSE` — Phase D status

- [x] Migration written: `supabase/migrations/20260611161500_f_v5_loop_close_learnings.sql` (learnings table + prds.shipped_at/outcome + profiles.voice_anchor_text + hourly outcome-tick cron) — audited purely additive
- [x] Server: `checkPrdShipped` (GitHub issue-state read, idempotent ship stamp) · `recordOutcome` (verdict → confidence ±2 → learning row with prior/new ICE) · `listLearnings` · `api/public/hooks/outcome-tick.ts`
- [x] UI: `OutcomeCard` on PRD detail (3 states) · re-score delta chip beside ICE in OpportunitiesPanel
- [x] Loop: KI-07 fixed (failed model call ⇒ run `failed`, mission `halted`) · recalled memories persisted to checkpoints + "Memory context · N" pill on mission hops · voice anchor end-to-end (settings → profiles → agent prompts)
- [x] Verify: lint + `bun run build:dev` green on all touched files
- [ ] **GATE (KI-08, founder-chosen Lovable path):** open the Lovable project so it syncs main + applies `20260611161500` — DB stays Lovable-operated until migrating off (decision 2026-06-11). Probe: REST `/rest/v1/learnings` returns rows/[] instead of PGRST205
- [ ] After apply: regenerate Supabase types (removes the untyped casts), then walk the loop end-to-end: approve a PRD with an issue → close the issue → "Check ship status" → record outcome → see the re-score chip in Opportunities
- [ ] Doc closure remainder: `architecture/orchestration.md` (halted-mission semantics) + `docs/features/` operator page for the outcome loop

## `F-V5-INGEST-WEBHOOK` — Phase C universal half: CODE LANDED 2026-06-12

- [x] `ingest_tokens` migration (idempotent) · `ingest.functions.ts` (get/rotate/revoke) · public `POST /api/public/ingest-signals` (Bearer token) · Webhook ingest card on `/sync` — lint + build green; reactor fan-out to Scout confirmed
- [ ] **GATE (KI-09): founder opens Lovable → syncs → migration applies + frontend deploys**
- [ ] Then verify: generate token on `/sync`, curl one signal, see it in Product · Signals (+ auto-discovery run)
- [ ] Post-demo hardening queued: per-token rate cap, token hashing (KI-10)

## `F-CONN` Phase 1 — Connector Platform base (BUILDING 2026-06-12)

Plan: connections (account level) · connection_bindings (workspace level) · `resolveProviderAuth` chain · GitHub App exemplar · 9 call sites migrated with env fallback preserved. Decision entry in `docs/strategy/session-decisions.md`.

### Open ops task — register the Circuit GitHub App (founder, ~10 min — gates the connect flow)

1. [ ] github.com → Settings → Developer settings → **GitHub Apps** → New GitHub App
   - Name: e.g. `circuit-cockpit` (the slug becomes `GITHUB_APP_SLUG`)
   - Homepage: `https://cadence-flow-beta.lovable.app`
   - Callback URL: `https://cadence-flow-beta.lovable.app/api/public/connect/github/callback` (add `http://localhost:8080/api/public/connect/github/callback` as a second callback for local dev)
   - ✅ "Request user authorization (OAuth) during installation" · Webhooks: **off** for now
   - Permissions: Issues **RW** · Pull requests **RW** · Contents **R** · Actions **R**
2. [ ] After creating: note the **App ID**, generate a **client secret**, and generate + download a **private key** (.pem)
3. [ ] Add backend secrets (Lovable project env): `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY` (paste PEM), and `CONNECTOR_SECRETS_KEY` (run `openssl rand -base64 32`)
4. [ ] Until these exist, the GitHub card in Settings → Connected accounts shows "setup pending" (everything else still works; old env-var path keeps the demo alive)

## ~~Slack app credentials~~ — RETIRED 2026-06-12

Founder decision: no Slack app. The **webhook ingest door is the ingest strategy** (`F-V5-INGEST-WEBHOOK`); anything — including Slack via its own outgoing-webhook/workflow tools — POSTs to `/api/public/ingest-signals`. `F-V5-SLACK` (native OAuth connector) removed from the queue.

## Open ops task — Calendar OAuth credentials (KI-01, unchanged)

**Owner:** workspace admin. **Decision doc:** [`docs/decisions/calendar-oauth-credentials.md`](docs/decisions/calendar-oauth-credentials.md)

- [ ] Google OAuth Client ID → secret `GOOGLE_APP_USER_CONNECTOR_CLIENT_ID`
- [ ] Microsoft App Registration → secret `MICROSOFT_APP_USER_CONNECTOR_CLIENT_ID`
- [ ] Smoke test both Connect buttons on `/knowledge?tab=calendar`; then flip `F-CALENDAR-PERUSER` ✅
