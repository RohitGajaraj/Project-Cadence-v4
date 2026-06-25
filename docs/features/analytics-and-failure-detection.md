# Analytics & Failure Detection (AFD) — feature spec

> **Status:** DOCUMENTATION ONLY (no build yet, founder-gated). Full doctrine + 14 task IDs in [`../planning/analytics-and-failure-detection-plan.md`](../planning/analytics-and-failure-detection-plan.md).

## What it does (one paragraph)

Cadence ships a two-layered observability stack. The **commodity layer** is bought: PostHog EU for product usage + session replay + feature flags, Sentry EU for server / route / Worker errors, Better Stack for uptime probes + on-call escalation + a public status page. The **moat layer** is built on Supabase: a `job_runs` table for cron health, a `failure_kind` taxonomy on `agent_runs`, and four SQL views that drive in-app surfaces (`/admin/ai-costs`, `/admin/incidents`, `/admin/observability`). Every vendor call is wrapped behind one façade in `src/lib/observability/` so the buy is reversible. The whole capability is **dormant by design** until an admin flips `admin_set_observability_enabled(true)`, mirroring the credit-engine pattern.

## Why it exists (one paragraph)

[`../planning/considerations.md`](../planning/considerations.md) flags **"App-level monitoring + alerting (not just AI telemetry)"** as a P0 gap, and `IncidentsPanel` was built without external feeds to fill it. The founder has explicitly asked for "analytics + failure-log detection" as a single initiative. The split (buy commodity, build moat) is the standing doctrine [`../strategy/build-buy-integrate.md`](../strategy/build-buy-integrate.md): rebuilding PostHog/Sentry would burn months for an inferior result, while rebuilding decision-velocity and agent-cost analytics is exactly the receipts moat we want on our side of the line.

## Where to find it (nav path, route, panels)

When live (post-AFD-12):
- **Admin → AI costs** → `/admin/ai-costs` — cost-per-mission, p95 latency, budget burn.
- **Admin → Incidents** (existing `IncidentsPanel`, extended) — last 24h Sentry top error_kinds, cron heartbeat status, recent `job_runs` errors.
- **Admin → Observability** → `/admin/observability` — kill-switch, sample-rate sliders, vendor reachability ping.
- **Public** → `status.cadence.app` (renameable later; hosted by Better Stack) — uptime + incident timeline.

Pre-AFD-12, none of these exist; only the doctrine + plan do.

## How it works (server fns, modules)

Will be wired at build time (cold-buildable per the plan):
- `src/lib/observability/analytics.ts` — `track()` / `identify()` / `pageView()` → PostHog.
- `src/lib/observability/errors.ts` — `captureError()` / `captureMessage()` / `setUser()` / `setTag()` → Sentry.
- `src/lib/observability/uptime.ts` — `heartbeat(jobName)` → Better Stack URL.
- `src/lib/observability/job-runs.ts` — `withJobRun(name, fn)` wrapper used by every cron in `src/routes/api/public/hooks/*`.
- `src/lib/ai/chokepoint.ts` — emits `track('agent_run_finished', …)` and writes `agent_runs.failure_kind` on every error path.
- Migrations: `job_runs` table, `agent_runs.failure_kind` column, 4 SQL views, `observability_enabled()` + `admin_set_observability_enabled()` functions.

## Activation posture

- Façade ships keyless; missing env = no-op. Zero behavior change in prod until the founder sets keys and flips the admin gate.
- Mirrors the credit-engine dormant-by-design pattern ([`../operations/credit-engine-go-live.md`](../operations/credit-engine-go-live.md)).

## Exit posture (BUILD/BUY/INTEGRATE reversibility)

- Vendor swap = edit one façade file.
- Leaving Lovable = export secrets, redeploy code, repoint DNS. Moat data is `pg_dump`-able.
- Vendor accounts opened under a founder-owned inbox; founder is owner everywhere.

## Related

- Plan + doctrine + 14 task IDs: [`../planning/analytics-and-failure-detection-plan.md`](../planning/analytics-and-failure-detection-plan.md)
- Façade contract: [`./observability-facade.md`](./observability-facade.md)
- Vendor selection ADR: [`../decisions/analytics-vendor-selection.md`](../decisions/analytics-vendor-selection.md)
- Alerting runbook: [`../operations/alerting-runbook.md`](../operations/alerting-runbook.md)
- Procurement: [`../operations/procurement-inventory.md`](../operations/procurement-inventory.md)
- Seed monitor: [`./app-health.md`](./app-health.md)
- In-app incidents (extended by AFD-11): `src/components/governance/IncidentsPanel.tsx`
