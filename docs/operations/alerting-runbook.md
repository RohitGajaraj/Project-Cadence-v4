# Alerting runbook (AFD)

> **Status:** DOCUMENTATION ONLY until **AFD-13** ships. See [`../planning/analytics-and-failure-detection-plan.md`](../planning/analytics-and-failure-detection-plan.md) for the full initiative.

## Sev tiers

| Sev | Definition | Channels | Ack target | Who |
| --- | --- | --- | --- | --- |
| **Sev 1** | App down (Better Stack `/api/public/health` probe fails 2 consecutive checks) · DB unreachable · `go-live guard` tripped · spend over hard cap | Phone call (Better Stack) → SMS → Slack `#incidents` | 5 min | Founder (on-call always) |
| **Sev 2** | Error rate >1% over 5 min · cron heartbeat missed >2× period · p95 latency >5s for 10 min · injection-block spike >10/min | SMS + Slack `#incidents` | 30 min | Founder |
| **Sev 3** | Error rate >0.1% over 1h · monthly budget burn >80% · agent hit-rate drop >20pt week-over-week · `job_runs.status='error'` rate >1/h | Slack `#observability` | 4h | Founder (next reasonable window) |
| **Sev 4** | Single workspace anomaly · single feature-flag regression · slow-query warn · single failed cron tick | In-app `IncidentsPanel` only | Next business day | Whoever opens the panel |

## Channels (post AFD-13)

- **Better Stack on-call rotation:** founder phone (Sev 1), founder phone via SMS (Sev 2), Slack webhook (Sev 3+). Configured in Better Stack UI; renameable.
- **Slack workspace + channels:** `#incidents` (Sev 1-2), `#observability` (Sev 3). Webhook URLs stored as CF Worker secrets.
- **In-app `/admin/incidents`:** the always-available pane; pulls last 24h from Sentry + last 7d from `job_runs`.
- **Public status page:** `status.cadence.app` (Better Stack-hosted; DNS-renameable when Cadence rebrands).

## Triage steps (Sev 1)

1. Hit `https://cadence-flow-beta.lovable.app/api/public/health` — confirm the 503.
2. Check Better Stack dashboard for which probe failed (Worker / DB / cron heartbeat).
3. Check Sentry "issues" EU dashboard for new exceptions in the last 15 min.
4. Check `/admin/incidents` for `job_runs.status='error'` in the last hour.
5. If DB: check Supabase status page + Lovable status page.
6. If Worker: check Cloudflare status page + recent deploys (last green release SHA in Sentry).
7. Rollback to last green deploy if a deploy is the cause (`bash scripts/active-claims-watch.sh` to find it; deploy via Lovable publish).
8. Post-mortem within 48h to `docs/operations/post-mortems/YYYY-MM-DD-<slug>.md` (file does not yet exist; create on first incident).

## Triage steps (Sev 2-3)

- Open Sentry → group by `error_kind` → check the release that introduced the regression.
- Open `/admin/ai-costs` → check whether the spike is a single mission or a workspace-wide pattern.
- If guardrail/injection-block spike: open `IncidentsPanel` for the screen logs; consider tightening the screen if a new attack pattern.
- If budget burn: open `/admin/observability` → kill switch if needed; coordinate with `admin_set_credits_enabled` flow.

## Activation (AFD-13)

The runbook is **live the moment AFD-13 ships** (Better Stack monitors + escalation configured). Before then, only `/admin/incidents` exists, and only the founder polls it.

## Related

- Plan: [`../planning/analytics-and-failure-detection-plan.md`](../planning/analytics-and-failure-detection-plan.md)
- Feature spec: [`../features/analytics-and-failure-detection.md`](../features/analytics-and-failure-detection.md)
- Seed monitor: [`../features/app-health.md`](../features/app-health.md)
- Existing incidents panel: `src/components/governance/IncidentsPanel.tsx` + [`../features/p7-incidents.md`](../features/p7-incidents.md)
- Credit-engine runbook (pattern AFD's dormant gate mirrors): [`./credit-engine-go-live.md`](./credit-engine-go-live.md)
