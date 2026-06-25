
# V3 + V1-as-§12 — doc-only commit plan, fully interlinked

Approved direction noted: **commit V3 (the comprehensive doc-only plan) with V1's phased build sequence folded in as §12**. Doc-only — no packages installed, no code touched. Below is exactly what gets written and where, plus answers to your two questions at the end.

---

## Files I will create (5)

1. **`docs/planning/analytics-and-failure-detection-plan.md`** — the build bible (the V3 + V1-§12 doc itself). Header date · `BBI:` stamp · initiative ID **AFD** · board group **G12**.
   Sections: 0 Why · 1 Scope · 2 Non-goals · 3 BBI table · 4 Vendor analysis (PostHog vs Mixpanel vs Amplitude; Sentry vs alternatives; Better Stack vs PagerDuty+StatusPage+Logtail; EU rationale) · 5 Architecture (ASCII + `src/lib/observability/` façade rule) · 6 Per-ID specs **AFD-01..AFD-14** (context · files · migration · steps · acceptance · verify) · 7 Cost & procurement · 8 Risks & founder gates · 9 Acceptance · 10 Out of scope · 11 Links · **§12 Build sequence when picked up (V1's 4 phases verbatim: Phase 1 failure detection → Phase 2 product analytics → Phase 3 in-house insights → Phase 4 DB failure surfacing)**.

2. **`docs/features/analytics-and-failure-detection.md`** — the feature doc (mandatory per AGENTS.md §5). One-line what-it-is · category/owner · use cases · how-to-run/verify checklist · cross-links to the bible.

3. **`docs/features/observability-facade.md`** — a tiny supporting feature doc for the `src/lib/observability/` façade rule (so when build picks up, every SDK lives behind one swap-in-one-file boundary).

4. **`docs/decisions/analytics-vendor-selection.md`** — a short decision record capturing the PostHog / Sentry / Better Stack picks with the rejected alternatives, so the WHY survives forever (matches the `docs/decisions/` pattern).

5. **`docs/operations/alerting-runbook.md`** — the Sev 1–4 routing policy as a runbook (channels, escalation, who-gets-paged), referenced by the bible and `app-health.md`.

## Files I will UPDATE (interlinking — no orphans)

| File | Change |
|---|---|
| `docs/planning/SOURCE-OF-TRUTH.md` | New §3 queue entry: **G12 Analytics & Failure Detection** → bible. §0 cursor untouched (not in flight). §7 doc map gets the 5 new files. |
| `docs/planning/feature-dashboard.md` | New board group **G12** with 14 rows (AFD-01..14), Priority `Tier 3` (per your "non-essential / ops hygiene" tier), all `⬜`. Run `scripts/rerank-dashboard.py` so Rank renumbers. Update v11 header block + at-a-glance %. |
| `docs/strategy/strategic-inputs-log.md` | Append the full §4 vendor analysis verbatim (PostHog/Mixpanel/Amplitude, Sentry/alts, Better Stack/PD-stack, EU rationale) — preserves the reasoning for YC/investor use. |
| `docs/strategy/session-decisions.md` | Dated entry: "Analytics & Failure Detection scoped (V3 + V1-§12); doc-only; G12 queued; AFD prefix; BBI verdicts logged." |
| `docs/operations/procurement-inventory.md` | 3 new vendor rows: PostHog Cloud EU · Sentry EU · Better Stack (what / why / cost+source / vendor options / recommendation / when-to-buy). |
| `architecture/runtime.md` | One-paragraph note: AI chokepoint will emit Sentry breadcrumbs at AFD build time; façade-only. |
| `architecture/integrations.md` | One-paragraph note: 3 new integrations live behind `src/lib/observability/` façade; vendor swap = one file. |
| `architecture/data.md` | Note the two future tables `job_runs` and `db_incidents` (90-day retention). |
| `docs/features/app-health.md` | Cross-link: AFD extends (does not replace) `IncidentsPanel`. |
| `docs/features/README.md` | New row for the feature doc. |
| `plan.md` §4 | One dated line: "AFD initiative documented; G12 queued; build deferred per founder velocity ruling." |
| `docs/planning/considerations.md` | Mark the observability/failure-detection gaps as **spec'd in AFD**. |
| `AGENTS.md` | One pointer line under §3 (after §3.0d) referencing the bible — so any tool/session sees AFD from the canonical manual. |
| `CLAUDE.md` | One pointer line in the read-order block (§1.6 area) referencing the bible. |
| `docs/README.md` | New row in the repo map for the bible + decisions/runbook files. |

## Linking discipline applied
- Every new file: header date line `> _Created: <today> · Last updated: <today>_`.
- "Related" footer block on each new file → bible · SSOT · dashboard · feature doc · architecture · decisions · runbook.
- No status duplication (status lives only in SSOT + dashboard).
- Run `bun run docs:check` after writes; fix any orphan/broken-link finding in the same commit.

## What I will NOT do (this commit)
Install packages · write migrations · touch `src/server.ts` / `runtime.server.ts` / cron hooks · sign up for vendor accounts · set Sev-1 phone routing · build any UI.

---

## Answers to your two questions (folded into §8 Risks & founder gates of the bible)

### Q1 — Status page domain (`status.cadence.app`), can we rename later?
**Yes, fully renamable.** The status page is just a DNS CNAME from your chosen subdomain to Better Stack's status-page host. Renaming later = (a) point a new CNAME (`status.<newbrand>.app`) at the same Better Stack page, (b) flip the page's "primary domain" setting in Better Stack, (c) keep the old CNAME for ~30 days as a 301 so old links don't break. Zero code changes, zero data migration, ~10 minutes of work. So `status.cadence.app` for now is a safe placeholder — I'll mark it **"Provisional domain, rename-safe"** in §8 of the bible and in the alerting runbook. Same story for PostHog/Sentry project names: they're labels, not identifiers — both vendors let you rename a project in-dashboard without breaking ingestion (the SDK uses an API key, not the project name).

### Q2 — If you sign up for everything, can I still leave Lovable later with full control?
**Yes, by design — that's exactly what the §3.0c BBI doctrine + the `src/lib/observability/` façade guarantee.** Concretely, the exit posture I'll bake into the bible is:

- **All accounts are created in your name / on your email,** not mine. I'd use a shared/forwarding inbox (e.g. `ops@cadence.app`) you own; every signup uses that. You hold the root password + 2FA recovery codes from day one. I never own a vendor account — I only operate one you own.
- **All API keys live as Lovable Cloud secrets today, but are vendor-issued and portable.** `POSTHOG_API_KEY`, `SENTRY_DSN`, `BETTER_STACK_TOKEN` are strings the vendor issues to your account. To leave Lovable: export the secrets list, paste them into your new host's env (Vercel / Cloudflare / Fly / self-host), redeploy. The code reads `process.env.*` and doesn't know or care that Lovable was the host.
- **All vendor SDKs live behind ONE file (`src/lib/observability/`)** — the façade rule. If you ever want to swap PostHog → Mixpanel, or Sentry → Rollbar, it's a one-file change with stable internal call sites. Same pattern protects you from vendor lock-in on the observability stack, not just from Lovable lock-in.
- **The moat data (the `ai_events`, `agent_runs`, `decisions`, `job_runs`, `db_incidents` tables) lives in YOUR Supabase** — never shipped to a third party. Lovable Cloud's Supabase is exportable (Lovable docs: Cloud → Database tab → CSV export per table; full `pg_dump` is on the support-request path). On exit, the schema + migration files are already in this repo (`supabase/migrations/`), so a new Supabase project + restore = same DB, anywhere.
- **Vendor data export (if you also leave PostHog/Sentry/Better Stack later):** all three offer full data export — PostHog has a `/api/event/` paginated export + S3 batch export; Sentry has issues + events JSON export; Better Stack has incident/log API export. I'll document the export endpoint for each in §11 of the bible so you're never trapped.
- **Cost guardrail:** I'll cap each vendor at its free tier and set a billing alert before any spend. If a vendor would push us off free, I stop and ask you first (this is the standing "spend approval" rung in §3.0c).

So the exit story is: **inbox you own → secrets you can export → façade behind which vendors swap → DB that's already yours.** I'll write this verbatim into §8 of the bible as the "Founder exit posture" subsection so it survives sessions.

---

## Ready to write
On approval I'll create the 5 new files + apply the 14 doc updates in one parallel batch, run `scripts/rerank-dashboard.py`, run `bun run docs:check`, fix any finding it flags, and stop. No code, no installs, no signups.
