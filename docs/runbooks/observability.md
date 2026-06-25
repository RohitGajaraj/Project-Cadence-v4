# Observability Runbook (AFD)

> Single front-door for activating + operating the Analytics & Failure-Detection stack.
> Plan: [`../planning/analytics-and-failure-detection-plan.md`](../planning/analytics-and-failure-detection-plan.md).

## Posture

- **Dormant by design.** Three independent off-switches must all be ON for any vendor traffic to leave the Worker:
  1. The vendor env var is set (e.g. `POSTHOG_API_KEY`).
  2. The DB gate `observability_enabled` is `true` (Admin → Observability → Enable).
  3. The caller invokes a façade fn (`track`, `captureError`, `heartbeat`, `withJobRun`) — never a vendor SDK directly.
- **EU residency** is the default in every config (`POSTHOG_HOST=https://eu.i.posthog.com`; choose Sentry EU project; Better Stack data-region EU).
- **PII** never crosses the façade — `scrubPII()` drops common keys (`email`, `name`, `phone`, etc.) and callers must pass `user_id` (UUID) not email.

## First-time activation (founder)

1. **Open vendor accounts** under a founder-owned inbox. Free tiers cover us until the thresholds in `docs/operations/procurement-inventory.md`.
   - PostHog EU → Project Settings → Project API Key (`phc_...`).
   - Sentry → New Project → Platform "Node" → copy the DSN (must be the EU host).
   - Better Stack → Heartbeats → Create one heartbeat per cron. Copy the **base** URL (drop the trailing slug) into `BETTER_STACK_HEARTBEAT_URL`; name each heartbeat after the corresponding `job_name` (e.g. `ambient.sense-tick`).
2. **Set secrets** in the Cloudflare Worker env (Lovable → Settings → Environment Variables). See `.env.example` for the full list.
3. **Deploy** — the façade now has credentials but is still dormant because the DB gate is off.
4. **Flip the gate** at `/admin/observability` → "Enable". The action is logged to `admin_audit_log`.
5. **Verify**: trigger any cron (e.g. POST `/api/public/hooks/sense-tick`), then refresh the Observability page — the run should appear in the ledger and the matching heartbeat in Better Stack.

## Day-to-day operations

- **Where to look first:** `/admin/observability` shows the gate, vendor key presence, last 50 job runs, and 7-day failure-kind breakdown.
- **Where to look for a specific incident:**
  - User-facing exception → Sentry (search by `tags.surface` or `tags.workspace_id`).
  - Cron missed → Better Stack (alerted) + `job_runs` table (`status='error'` or no row).
  - Agent run failed → `agent_runs.failure_kind` + the matching Sentry event tagged `failure_kind`.
- **Disabling the entire stack:** flip the gate OFF. All façades start no-opping within 30s (the gate is cached for 30s per Worker instance).

## Vendor swap (BUILD posture preserved)

- **Analytics:** replace `src/lib/observability/analytics.ts` (e.g. PostHog → Mixpanel). Call sites are untouched.
- **Errors:** replace `src/lib/observability/errors.ts`.
- **Uptime:** replace `src/lib/observability/uptime.ts` (heartbeat URL shape is the only assumption).
- **Leaving Lovable:** export Worker secrets, redeploy the same code to the new host. Supabase data is `pg_dump`-able. Vendor accounts move via DNS (status page) or are re-created (analytics/errors).

## Failure-kind taxonomy (`agent_runs.failure_kind`)

| kind | trigger |
| --- | --- |
| `timeout` | provider timed out |
| `user_aborted` | request was cancelled / aborted |
| `budget_kill` | per-mission cap or account credits exhausted |
| `guardrail_block` | output guardrail blocked the response |
| `injection_block` | input guardrail blocked the prompt |
| `rls_denied` | Postgres permission denied (RLS) |
| `tool_error` | tool-call / function-call failed |
| `model_error` | provider returned an error (default) |
| `unknown` | no error message captured |

## Materialised views (refreshed by `refresh_observability_mvs()`)

- `mv_decision_velocity` — decisions/week per workspace (made / shipped / superseded).
- `mv_supersession_rate` — % of decisions later superseded, per workspace × agent. **Receipts KPI.**
- `mv_agent_cost_per_decision` — rolling-30d $ per decision, per workspace × agent.

Activate the pg_cron schedule (founder step):

```sql
select cron.schedule('refresh-observability-mvs', '15 * * * *',
  $$ select public.refresh_observability_mvs(); $$);
```