# Analytics & Failure Detection (AFD) — the build bible

> **Status:** DOCUMENTATION ONLY (no build yet). Founder approval 2026-06-25 to commit V3 (comprehensive doctrine) + V1 (phased build sequence) as the standing plan.
> **Initiative ID:** `AFD` · **Dashboard group:** `G12` · **Task IDs:** `AFD-01` … `AFD-14`.
> **Created:** 2026-06-25 · **Owner:** any session that picks an `AFD-*` row from [`feature-dashboard.md`](./feature-dashboard.md).
>
> This is the **single front-door** for everything analytics + failure-detection in Cadence. When the founder unblocks the build, the picker reads this file end-to-end, **does not re-derive the vendor choice**, and starts at `AFD-01`. Every other doc that touches observability points HERE (see §13 "Cross-doc map").

---

## 0. TL;DR (one screen)

- **What:** Two capabilities, treated as one initiative: (a) **Analytics** — product usage, AI/agent-run economics, business outcomes, infra perf; (b) **Failure detection** — server function & route errors, AI runtime failures, DB failures, background-job failures.
- **Posture:** **Hybrid (V3, recommended).** **BUY/INTEGRATE** the commodity layer (PostHog EU for product usage, Sentry EU for errors, Better Stack for uptime + on-call + status page). **BUILD in-house** the moat-adjacent layer (Decision-velocity analytics, Agent-cost analytics, in-app Incidents panel) on existing Supabase tables so the "receipts" stay on our side of the line.
- **Why this split:** PostHog/Sentry/Better Stack are mature, EU-resident, free at our scale, and have a one-line SDK; rebuilding them is months of work for a worse product. Decision/agent-cost analytics are the **moat** — they cross our private tables (`decisions`, `artifact_lineage`, `agent_runs`, `model_costs`) and are how PMs feel the value, so they stay BUILT and stay on Postgres.
- **EU residency:** every paid dependency picked has an EU region — GDPR posture by default (Cadence is a global consumer-facing PM tool; users will be from the EU).
- **Cost at our scale:** **$0/mo** through demo + early users (all free tiers). First paid tier triggers at PostHog 1M events / Sentry 5k errors / Better Stack 10 monitors — see [`../operations/procurement-inventory.md`](../operations/procurement-inventory.md).
- **Activation posture:** **Dormant by design** (mirroring the credit-engine pattern). The façade ships keyless, no-ops when env vars are absent, and is admin-flipped on at go-live. No vendor traffic happens until the founder sets the keys.
- **Exit posture:** All vendor calls go through `src/lib/observability/` façades (`track()`, `captureError()`, `setUser()`). Swapping PostHog → Mixpanel or Sentry → Honeybadger is a 1-file edit; **leaving Lovable** is exporting secrets + redeploying the same code to a new host. Moat data in Supabase is `pg_dump`-able. Founder holds the root credentials (vendor accounts are opened under a founder-owned inbox).

---

## 1. Scope (what is in / what is out)

### In scope

| Capability | In-house? | Vendor | Notes |
| --- | --- | --- | --- |
| Product usage (page views, feature adoption, funnels, retention, session replay, feature flags) | BUY | **PostHog EU** | One SDK covers analytics + replay + flags + A/B. |
| Agent/AI run analytics (per-mission cost, latency, tool-call mix, model mix, budget burn) | **BUILD** | — | Crosses `agent_runs`, `model_costs`, `mission_runs`. SQL views + a `/admin/ai-costs` surface. Moat. |
| Business / outcome analytics (decisions shipped, signal→outcome funnel, supersession rate, agent hit-rate) | **BUILD** | — | Crosses `decisions`, `artifact_lineage`, `outcomes`. SQL views feed the existing PM Impact Ledger + Trust Ledger. Moat. |
| Infra / perf analytics (Worker p50/p95, route error rates, cold starts, DB latency) | BUY | **Sentry EU** Performance + **Cloudflare Analytics** (free) | Sentry already covers transactions; Cloudflare's per-Worker analytics is free. |
| Server function & route errors | BUY | **Sentry EU** | Source-maps + release tracking. |
| AI runtime failures (model errors, guardrail blocks, budget kills, injection screen blocks) | **BUILD** + BUY | Sentry for the exception; in-house for the structured `agent_runs.failure_kind`. | The chokepoint (`callModel`) already writes the row; we add a typed `failure_kind` column and an in-app Incidents panel. |
| DB failures (RLS denials, constraint violations, slow queries) | BUY | Supabase logs + Sentry breadcrumbs | RLS denials are noisy; sample at 1%, alert only on >N/min per workspace. |
| Background-job failures (cron `sense-tick`, `trigger-tick`, ingest, `resume-runs`) | **BUILD** + BUY | In-house `job_runs` table + Sentry for the exception + Better Stack heartbeat. | Heartbeat misses = "the cron did not run", which Sentry can't see. |
| Uptime monitoring + on-call escalation + public status page | BUY | **Better Stack** | One vendor, free tier covers 10 monitors. |
| In-app Incidents panel (the founder/admin's single pane) | **BUILD** | — | Already exists at `src/components/governance/IncidentsPanel.tsx`; AFD wires the new feeds into it. |

### Out of scope (explicit)

- Marketing-attribution (UTM tracking beyond what PostHog auto-captures). Defer to a later initiative — the demo doesn't need it.
- Custom data warehouse (Snowflake/BigQuery). Postgres + PostHog cover us until ~10M events/mo.
- Frontend RUM beyond what PostHog + Sentry already provide.
- SOC 2 audit logging — `admin_audit_log` already exists for the security-relevant slice; expanding it is a separate Governance row.

---

## 2. Doctrine: why this split (the BUILD / BUY / INTEGRATE call)

> _This section preserves the full strategic reasoning from the 2026-06-25 founder discussion so it can be picked up cold, and so no future agent re-derives the vendor choice._

### 2.1 The doctrine in one line

> **BUILD what is the moat. BUY what is a commodity. INTEGRATE at a façade so the buy is reversible.** (Standing rule: [`../strategy/build-buy-integrate.md`](../strategy/build-buy-integrate.md).)

### 2.2 What's the moat here

The moat is **the receipts layer** — the closed loop from signal → decision → outcome → revised belief, visible on the Trust Ledger and the PM Impact Ledger. Analytics on that loop (decision velocity, supersession rate, agent hit-rate, cost-per-decision) are **how the user feels the value**. They cross private tables, drive in-app surfaces, and are differentiating. **Build them, keep them on Postgres.**

Product usage (page views, funnels, retention, replay), error capture (stack traces, source-maps, release tracking), and uptime monitoring (HTTP probes, on-call paging, status pages) are **commodities** — every observability vendor has solved them better than we will in a year. **Buy them.**

### 2.3 Why PostHog (and not Mixpanel / Amplitude / GA4)

| Vendor | Verdict | Why |
| --- | --- | --- |
| **PostHog (EU cloud or self-host)** | **PICKED** | MIT-licensed core (escape hatch: self-host if pricing turns); one SDK covers product analytics + session replay + feature flags + A/B + surveys; native EU region; generous free tier (1M events/mo + 5k replays); reverse-proxy support to bypass ad-blockers; first-class Worker SDK. |
| Mixpanel | Rejected | Closed-source (no self-host escape); no integrated replay/flags (need 2nd vendor); EU tenancy is Enterprise-tier. |
| Amplitude | Rejected | Closed-source; replay is a separate paid SKU; pricing climbs faster at 100k+ MAU. |
| GA4 | Rejected | Built for marketing, not product; sampled at scale; no event-stream export on free tier; no replay/flags. |
| Self-built on Postgres | Rejected for product usage | Reinventing funnels/retention/replay is months of work for an inferior result. Reserve build budget for the moat. |

### 2.4 Why Sentry (and not Honeybadger / Rollbar / Bugsnag / Datadog)

| Vendor | Verdict | Why |
| --- | --- | --- |
| **Sentry (EU cloud or self-host)** | **PICKED** | Best Cloudflare Workers SDK (we ship on Workers); source-map upload at build; release tracking ties errors to a commit SHA; transaction tracing (Performance) covers infra-perf in the same product; native EU region; generous free tier (5k errors/mo). |
| Honeybadger | Rejected | Smaller community; weaker Worker support; no integrated performance product. |
| Rollbar | Rejected | UI dated; EU residency is Enterprise. |
| Bugsnag (SmartBear) | Rejected | Enterprise focus; pricing climbs fast. |
| Datadog | Rejected | Excellent product, wrong cost — $15/host/mo + APM SKUs is overkill for a single-Worker app; lock-in is high. |

### 2.5 Why Better Stack (and not PagerDuty + Statuspage + UptimeRobot)

| Vendor | Verdict | Why |
| --- | --- | --- |
| **Better Stack (Uptime + Incident.io)** | **PICKED** | One vendor covers uptime probes + on-call rotation (phone/SMS/Slack) + public status page; free tier = 10 monitors + 3-min checks + 1 status page; EU region; integrates with Sentry + PostHog via webhook out of the box. Solo-founder-friendly: one vendor, one bill, one dashboard. |
| PagerDuty | Rejected | On-call best-in-class but expensive ($21/user/mo) and you still need a separate uptime vendor + status page. Multi-vendor overhead is wrong for a solo founder. |
| Statuspage (Atlassian) + UptimeRobot + PagerDuty | Rejected | Three vendors, three bills, three dashboards. Better Stack does it in one. |
| Self-hosted (Uptime Kuma + Cachet + custom on-call) | Rejected | The uptime monitor must run **outside** Cloudflare — if the Worker is down, our own monitor on Workers is also down. Hosting it ourselves means another VPS, another thing to babysit. Pay $0 for someone else to do this right. |

### 2.6 The façade rule (the exit posture)

Every vendor call goes through **one** file per concern in `src/lib/observability/`:

- `analytics.ts` — exports `track(eventName, props)`, `identify(userId, traits)`, `pageView(path)`. Calls PostHog under the hood.
- `errors.ts` — exports `captureError(err, ctx)`, `captureMessage(msg, level, ctx)`, `setUser(userId)`, `setTag(k, v)`. Calls Sentry under the hood.
- `uptime.ts` — exports `heartbeat(jobName)`. Pings Better Stack heartbeat URL.

**Rules:**
- Zero direct PostHog/Sentry/Better Stack imports outside `src/lib/observability/`.
- The façade no-ops when the env var is absent (so dev/test don't ship vendor traffic; so the app boots without keys).
- The façade is **dormant by design**: an admin RPC `admin_set_observability_enabled(true)` is the go-live switch, mirroring `admin_set_credits_enabled`.
- Swapping vendors = editing one file. **Leaving Lovable** = exporting secrets + redeploying the same code to a new host. The moat data (decisions/outcomes/agent_runs) lives in Supabase and is `pg_dump`-able.

Spec: [`../features/observability-facade.md`](../features/observability-facade.md).

---

## 3. Architecture (the picture)

```
                           ┌─────────────────────────────────────┐
                           │       Cadence (CF Worker + UI)      │
                           │                                     │
  user click ──► PostHog SDK ──┐                                 │
  page view  ──► PostHog SDK ──┤                                 │
                           │   │                                 │
  thrown error ─► captureError() ─► Sentry SDK ──────────────────┼──► Sentry EU
                           │   │                                 │
  agent run end ─► track() ───┤                                 │
                           │   └──► PostHog EU                  │
                           │                                     │
  cron tick   ──► heartbeat() ─► fetch(Better Stack URL)         │
                           │                                     │
  agent_runs    ──┐                                              │
  model_costs   ──┼─► SQL views ──► /admin/ai-costs (in-app)     │
  decisions     ──┘             └─► IncidentsPanel (in-app)      │
                           │                                     │
                           └─────────────────────────────────────┘
                                       │
                                  (probes from outside)
                                       │
                              Better Stack uptime probes
                                       │
                                       ▼
                             status.cadence.app (public)
                                       │
                              on-call: Slack + SMS + phone
```

### 3.1 In-house data model

Two new tables + one column on an existing table:

**`job_runs`** — every cron / background-job invocation:
```sql
create table public.job_runs (
  id            bigint primary key generated always as identity,
  job_name      text not null,                -- 'sense-tick' | 'trigger-tick' | 'resume-runs' | ...
  workspace_id  uuid references workspaces(id) on delete cascade,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null check (status in ('running','ok','error','timeout')),
  duration_ms   integer,
  error_kind    text,                          -- 'db_timeout' | 'model_error' | 'budget_kill' | ...
  error_message text,                          -- sanitized, no PII
  payload_size  integer
);
create index on public.job_runs (job_name, started_at desc);
create index on public.job_runs (workspace_id, started_at desc);
-- RLS: workspace_id IS NULL is admin-only; rest is RLS-scoped to the workspace.
```

**`agent_runs.failure_kind`** — typed failure taxonomy for AI runtime errors (column add, not a new table):
```sql
alter table public.agent_runs
  add column failure_kind text check (failure_kind in (
    'model_error','timeout','budget_kill','guardrail_block','injection_block',
    'tool_error','rls_denied','user_aborted'
  ));
```

**SQL views (read-only, RLS-respecting)** for the in-house analytics dashboards:
- `v_agent_cost_by_mission` — mission_id, agent_id, total_cost_usd, p50_latency_ms, p95_latency_ms.
- `v_decision_velocity` — workspace_id, week, decisions_made, decisions_shipped, decisions_superseded.
- `v_agent_hit_rate` — agent_id, workspace_id, approved, total, hit_rate.
- `v_job_health` — job_name, last_7d_ok, last_7d_error, p95_duration_ms.

### 3.2 Façade surface (the only place vendor SDKs are imported)

```
src/lib/observability/
  analytics.ts       — track / identify / pageView (PostHog)
  errors.ts          — captureError / captureMessage / setUser / setTag (Sentry)
  uptime.ts          — heartbeat (Better Stack)
  config.ts          — env-var reads; isEnabled() gate; sample rates
  index.ts           — re-exports
```

Spec: [`../features/observability-facade.md`](../features/observability-facade.md).

### 3.3 Surfaces (what the user / admin sees)

- **`/admin/ai-costs`** (admin-only) — agent-cost-by-mission + budget burn + cost-per-decision. Reads `v_agent_cost_by_mission`.
- **`/admin/incidents`** (admin-only) — extends the existing `IncidentsPanel` with the new feeds (Sentry deep-link, last cron heartbeat, recent `job_runs.error_kind`, top error_kinds last 24h).
- **`/admin/observability`** (admin-only) — the kill-switch + sample-rate sliders + vendor health (PostHog / Sentry / Better Stack reachable yes/no).
- **`status.cadence.app`** (public, hosted by Better Stack) — uptime + incident timeline. Domain is renameable later (DNS-only change, 10 min) when Cadence rebrands.

---

## 4. Alerting policy (Sev tiers + escalation)

| Sev | Definition | Channel | Ack time |
| --- | --- | --- | --- |
| **Sev 1** | App down (uptime probe fails) · DB down · go-live guard tripped · spend over hard cap | Better Stack phone + SMS + Slack `#incidents` | 5 min |
| **Sev 2** | Error rate > 1% over 5 min · cron heartbeat missed > 2× period · p95 latency > 5s for 10 min · injection-block spike | Better Stack SMS + Slack `#incidents` | 30 min |
| **Sev 3** | Error rate > 0.1% over 1h · budget burn > 80% of monthly cap · agent hit-rate drop > 20pt week-over-week | Slack `#observability` | 4h |
| **Sev 4** | Single workspace anomaly · single feature-flag regression · slow-query warn | In-app Incidents panel only | next business day |

Runbook: [`../operations/alerting-runbook.md`](../operations/alerting-runbook.md).

---

## 5. Privacy + security posture

- **No PII to PostHog.** The façade strips email/name/phone before `track()`. User identifier is the Supabase `auth.uid()` UUID (not email).
- **No PII to Sentry.** `beforeSend` hook strips request bodies + headers; only stack + URL + user UUID survives.
- **EU residency.** PostHog EU, Sentry EU, Better Stack EU regions. No cross-Atlantic data flow.
- **Right-to-erasure.** Supabase user delete cascades to in-house tables; a façade `forget(userId)` issues delete-by-distinct-id to PostHog + Sentry.
- **Subprocessor disclosure.** PostHog + Sentry + Better Stack are added to [`../features/subprocessor-disclosure.md`](../features/subprocessor-disclosure.md) when AFD goes live.
- **RLS.** All in-house views/tables are workspace-scoped; admin surfaces guard at the route level (`requireAdmin`).
- **Audit.** The admin RPC `admin_set_observability_enabled` writes to `admin_audit_log` (F-ADMIN-AUDIT).

---

## 6. Vendor-account ownership + the "leave Lovable" exit plan

> _Founder asked: "if you sign up for everything, can I still leave Lovable later?"_ Yes. Here is how.

### 6.1 Account ownership

When the founder unblocks the build, the executing agent:

1. **Asks the founder for a founder-owned inbox** (e.g. `ops@cadence.app` or `<founder>@gmail.com`). The vendor account is opened under THAT inbox, not an agent address.
2. Sets the founder as the **owner** on every vendor (PostHog org owner, Sentry org owner, Better Stack account owner). The agent's role, if any, is `admin` — revocable.
3. Records each vendor's account email + dashboard URL in [`../operations/procurement-inventory.md`](../operations/procurement-inventory.md) (the standing rule already exists).
4. Stores the API keys as Cloudflare Worker secrets (`POSTHOG_API_KEY`, `SENTRY_DSN`, `BETTER_STACK_HEARTBEAT_URL`). The founder can rotate any key from the Cloudflare dashboard.
5. Enables 2FA on every vendor account, owned by the founder.

### 6.2 Leaving Lovable

Lovable hosts the CF Worker + Supabase project. Leaving means redeploying the same code elsewhere. The AFD initiative does NOT add lock-in:

- **Code is portable.** The repo is yours; `bun run build` runs anywhere.
- **Vendor accounts are yours.** PostHog/Sentry/Better Stack accounts are not Lovable's — they're under your founder inbox.
- **Façade is reversible.** Swapping vendors = editing `src/lib/observability/*.ts`. Same façade contract, different SDK.
- **Moat data is yours.** Supabase is exportable via `pg_dump`; PostHog has a one-click event export; Sentry data is ephemeral by design (90-day retention, archive via SDK if needed).
- **Secrets are yours.** They live as Cloudflare Worker secrets — pull them out, paste into the new host's secret store, the app boots.

**Effort to leave:** ~1 day of redeploy work (DNS + secret rehydration + smoke test). Zero data loss. Zero vendor renegotiation.

---

## 7. The 14 task IDs (the cold-buildable plan)

> Each task is a single PR-sized unit of work, dependency-ordered. Status starts at ⬜ across the board. Picked from `feature-dashboard.md` (group G12) via `bash scripts/lane.sh next` after the founder unblocks.

| ID | What it does | Depends on | Surface / file | Size |
| --- | --- | --- | --- | --- |
| **AFD-01** | Vendor account setup (PostHog EU + Sentry EU + Better Stack), owner = founder inbox, secrets stored in CF | — (founder-gated) | Procurement inventory updated; secrets in CF | XS |
| **AFD-02** | Build the `src/lib/observability/` façade: `analytics.ts` + `errors.ts` + `uptime.ts` + `config.ts` + `index.ts`. Façade no-ops when env absent. | AFD-01 | `src/lib/observability/*` + unit tests | S |
| **AFD-03** | Admin gate: `admin_set_observability_enabled(boolean)` RPC + `observability_enabled()` SQL function (mirror credit-engine). Audited via `admin_audit_log`. | AFD-02 | Migration `2026MMDD_observability_gate.sql` | S |
| **AFD-04** | Wire PostHog `pageView` + `identify` at the auth boundary; wire `track('agent_run_finished', …)` at the chokepoint (`callModel`); document the typed event taxonomy. | AFD-02, AFD-03 | `src/lib/ai/chokepoint.ts` + `App.tsx` + `docs/features/analytics-event-taxonomy.md` | M |
| **AFD-05** | Wire Sentry: install `@sentry/cloudflare`, init in `worker.ts`, source-map upload in `bun run build`, release tagging via commit SHA, `beforeSend` PII stripper. | AFD-02, AFD-03 | `src/worker.ts` + build script | M |
| **AFD-06** | Add `agent_runs.failure_kind` column + chokepoint writes the typed failure kind on every error path. | AFD-05 | Migration + `src/lib/ai/chokepoint.ts` | S |
| **AFD-07** | Add `job_runs` table + a `withJobRun(name, fn)` wrapper used by every `/api/public/hooks/*` cron. | AFD-02 | Migration + `src/lib/observability/job-runs.ts` + wrap all 5 cron routes | M |
| **AFD-08** | Wire Better Stack heartbeats from every cron's `withJobRun` (fire heartbeat on `ok`). | AFD-07 | `src/lib/observability/uptime.ts` | S |
| **AFD-09** | SQL views: `v_agent_cost_by_mission` + `v_decision_velocity` + `v_agent_hit_rate` + `v_job_health`. RLS-respecting. | AFD-06, AFD-07 | Migration | M |
| **AFD-10** | Surface: `/admin/ai-costs` — agent-cost-by-mission + budget burn + cost-per-decision. Reads the views. | AFD-09 | `src/routes/_admin.ai-costs.tsx` | M |
| **AFD-11** | Extend `IncidentsPanel`: pull last 24h of Sentry top error_kinds via API + last cron heartbeat status + recent `job_runs` errors. | AFD-08 | `src/components/governance/IncidentsPanel.tsx` | M |
| **AFD-12** | Surface: `/admin/observability` — the kill-switch + sample-rate sliders + vendor reachability (PostHog/Sentry/Better Stack ping). | AFD-03, AFD-10 | `src/routes/_admin.observability.tsx` | M |
| **AFD-13** | Configure Better Stack monitors (`/api/public/health`, `/`) + on-call escalation policy (Sev 1 → phone, Sev 2 → SMS, Sev 3+ → Slack) + public status page at `status.cadence.app` (renameable). | AFD-01, app-health endpoint already live | Better Stack dashboard config; runbook updated | S |
| **AFD-14** | Subprocessor disclosure + privacy policy update + right-to-erasure façade `forget(userId)` wired to PostHog/Sentry delete APIs. | AFD-04, AFD-05 | `docs/features/subprocessor-disclosure.md` + `src/lib/observability/forget.ts` | S |

**Total estimate:** ~3-5 build days when picked up.

---

## 8. Acceptance criteria (the definition of done)

The initiative is **done** when:

1. A logged-in user clicks around → PostHog EU shows the session + events within 30s.
2. A thrown error in any route → Sentry EU shows the stack with the right release SHA within 1 min.
3. A cron that fails → `job_runs.status='error'` + Sentry exception + Better Stack heartbeat-missing alert.
4. An admin opens `/admin/ai-costs` → sees cost-per-mission for last 7d.
5. An admin opens `/admin/incidents` → sees the last 24h Sentry top kinds + cron heartbeat status.
6. An admin flips `admin_set_observability_enabled(false)` → all three vendor SDKs go silent; no telemetry leaves the Worker.
7. `status.cadence.app` (or whatever the renamed domain is) is publicly reachable with a green/red dot.
8. A user requests right-to-erasure → `forget(userId)` deletes them from PostHog + Sentry; Supabase cascade handles the rest.
9. Subprocessor disclosure lists PostHog + Sentry + Better Stack with their EU URLs.
10. `tsc 0` + tests green + lint clean.

---

## 9. Risks + mitigations

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Ad-blockers eat PostHog events (Brave/uBlock) | High | PostHog reverse-proxy through the Worker (`/_ph/*` → `https://eu.i.posthog.com/*`); first-party cookie. |
| Sentry quota explosion from a noisy error | Medium | `beforeSend` rate-limiter + `Sentry.init({ sampleRate: 0.1 })` on known-noisy routes. |
| Cron heartbeat false-positives during deploys | Low | Better Stack grace period = 2× the cron period. |
| PostHog/Sentry pricing climbs at scale | Low (we self-host escape with PostHog; Sentry self-host is heavier) | PostHog has MIT self-host; Sentry has self-host but it's an ops cost. Re-evaluate at 1M events/mo. |
| Vendor lock-in | **Mitigated by the façade.** Swapping vendors = 1 file edit. | See §6.2. |

---

## 10. The "before you build" checklist (founder-gated)

The picker MUST NOT start AFD until:

- [ ] Founder confirms a founder-owned inbox to open the vendor accounts under.
- [ ] Founder confirms the status-page domain (`status.cadence.app` for now; renameable later).
- [ ] Founder confirms the on-call channel(s): phone number for Sev 1, Slack workspace + channel name for Sev 2+.
- [ ] Founder reads §6 (exit posture) and accepts the vendor-account ownership model.

---

## 11. References

- Doctrine: [`../strategy/build-buy-integrate.md`](../strategy/build-buy-integrate.md) — when to BUILD vs BUY vs INTEGRATE.
- Procurement: [`../operations/procurement-inventory.md`](../operations/procurement-inventory.md) — the shopping list (PostHog/Sentry/Better Stack rows live there).
- Existing health endpoint: [`../features/app-health.md`](../features/app-health.md) — `GET /api/public/health`, the seed of Better Stack monitoring.
- Existing incidents panel: `src/components/governance/IncidentsPanel.tsx` — AFD extends, does not replace.
- Existing audit: [`../features/p7-incidents.md`](../features/p7-incidents.md) + F-ADMIN-AUDIT — the audit-log target for the admin kill-switch.
- Existing chokepoint: `src/lib/ai/chokepoint.ts` — where `track('agent_run_finished')` and `agent_runs.failure_kind` get written.
- Considerations: [`./considerations.md`](./considerations.md) — the SRE/Platform-lens gap this closes.
- Façade spec: [`../features/observability-facade.md`](../features/observability-facade.md).
- Vendor selection decision record: [`../decisions/analytics-vendor-selection.md`](../decisions/analytics-vendor-selection.md).
- Alerting runbook: [`../operations/alerting-runbook.md`](../operations/alerting-runbook.md).
- Feature spec: [`../features/analytics-and-failure-detection.md`](../features/analytics-and-failure-detection.md).
- Dashboard rows: [`./feature-dashboard.md`](./feature-dashboard.md) — search `AFD-` (group G12).
- SSOT entry: [`./SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md) §3 (build queue) + §7 (doc map).

---

## 12. Phased build sequence (the V1 plan, sequenced as approved)

> _Founder approval 2026-06-25: "go with V3 + V1 — V3 for the doctrine, V1 for the phased sequence." This is the V1 phased rollout, mapped to the AFD task IDs above._

### Phase 0 — Documentation freeze (THIS PR, done before any build)
- Commit this plan + the 4 sibling docs (façade spec, decision record, alerting runbook, feature spec).
- Add G12 + 14 rows to the dashboard.
- Update SSOT, AGENTS.md, CLAUDE.md, considerations, plan.md, procurement-inventory, strategic-inputs-log, session-decisions, architecture/*, app-health, features/README, docs/README, and the docs index.
- **No code changes. No vendor signup. No keys set.**

### Phase 1 — Plumbing (Day 1, 1 PR; AFD-01..03)
- AFD-01: founder opens PostHog + Sentry + Better Stack accounts under their inbox.
- AFD-02: ship the façade (no-ops without env).
- AFD-03: ship the admin gate (dormant by design).
- **Exit:** façade exists, vendor SDKs callable, gate is OFF. Zero behavior change in prod.

### Phase 2 — Capture (Days 2-3, 2 PRs; AFD-04..08)
- AFD-04: PostHog wired at chokepoint + auth.
- AFD-05: Sentry wired in Worker.
- AFD-06: `agent_runs.failure_kind` column + chokepoint writes.
- AFD-07: `job_runs` table + `withJobRun` wraps every cron.
- AFD-08: Better Stack heartbeats from every cron.
- **Exit:** keys set, gate flipped on by founder; data starts flowing.

### Phase 3 — Surfaces (Day 4, 2 PRs; AFD-09..12)
- AFD-09: SQL views.
- AFD-10: `/admin/ai-costs`.
- AFD-11: `IncidentsPanel` extended.
- AFD-12: `/admin/observability` (kill-switch + sliders + reachability).
- **Exit:** admin can see everything; can flip the kill-switch.

### Phase 4 — Operations + compliance (Day 5, 2 PRs; AFD-13..14)
- AFD-13: Better Stack monitors + escalation + status page.
- AFD-14: subprocessor disclosure + `forget(userId)` for right-to-erasure.
- **Exit:** Sev 1 alerts the founder's phone; status page is public; GDPR posture complete.

### Phase 5 — Verification (Day 5, no PR)
- Run the acceptance criteria in §8 end-to-end against the live app.
- Mark all 14 AFD-* rows ✅ in `feature-dashboard.md`.
- Move §3 SSOT cursor to "AFD complete, observability live, dormant kill-switch ready."

---

## 13. Cross-doc map (so nothing sits orphaned)

| Doc | What it carries about AFD |
| --- | --- |
| **This file** (`docs/planning/analytics-and-failure-detection-plan.md`) | The front door. Doctrine + task IDs + sequence + exit posture. |
| `docs/features/analytics-and-failure-detection.md` | The feature-level spec (what it is, where to find it, how it works at runtime). |
| `docs/features/observability-facade.md` | The façade contract (`track` / `captureError` / `heartbeat` / `forget`). |
| `docs/decisions/analytics-vendor-selection.md` | The vendor selection ADR (PostHog vs Mixpanel vs Amplitude; Sentry vs Honeybadger; Better Stack vs PagerDuty). |
| `docs/operations/alerting-runbook.md` | Sev 1/2/3/4 channels + ack times + on-call rotation. |
| `docs/operations/procurement-inventory.md` | PostHog + Sentry + Better Stack rows (cost, vendor option, recommendation, when to buy). |
| `docs/planning/SOURCE-OF-TRUTH.md` §3 + §7 | The build queue entry (deferred until founder unblocks) + doc-map row. |
| `docs/planning/feature-dashboard.md` G12 (AFD-01..14) | The 14 rows (status, picker target). |
| `docs/planning/considerations.md` | The SRE/Platform-lens "App-level monitoring + alerting" gap now points HERE for the full spec. |
| `docs/strategy/strategic-inputs-log.md` | The 2026-06-25 vendor-comparison thought-process is archived here. |
| `docs/strategy/session-decisions.md` | The 2026-06-25 founder ruling "V3 + V1" is logged here. |
| `architecture/runtime.md` | The chokepoint + cron wrappers gain `track()` / `withJobRun()` (call out the façade). |
| `architecture/integrations.md` | PostHog + Sentry + Better Stack listed as outbound integrations behind the façade. |
| `architecture/data.md` | `job_runs` + `agent_runs.failure_kind` + the 4 views documented. |
| `docs/features/app-health.md` | Linked as the seed Better Stack monitor target. |
| `docs/features/p7-incidents.md` | Linked as the in-app surface AFD extends. |
| `docs/features/subprocessor-disclosure.md` | Updated with PostHog/Sentry/Better Stack at go-live (AFD-14). |
| `docs/features/README.md` | Index row added. |
| `docs/operations/credit-engine-go-live.md` | Referenced as the dormant-by-design pattern AFD mirrors. |
| `AGENTS.md` | "If you touch observability, the spec is this file." |
| `CLAUDE.md` | Same pointer. |
| `plan.md` | A dated line in §4 ("2026-06-25 — committed AFD doc-only plan, 14 task IDs, group G12, build is founder-gated"). |
| `docs/README.md` | New row in the doc map. |

If you add a doc that touches observability, add a row HERE so it never sits orphaned.
