# Decision — Analytics & Failure Detection vendor selection

> _Created: 2026-06-25 · Status: Accepted (doctrine only; build founder-gated)._

**Date:** 2026-06-25
**Status:** Accepted
**Scope:** AFD initiative (group G12, task IDs `AFD-01`..`AFD-14`). See [`../planning/analytics-and-failure-detection-plan.md`](../planning/analytics-and-failure-detection-plan.md).

## Context

The founder asked: "add analytics and failure-log detection to our application; what's the infra?" Two layers were considered together because they overlap (an error capture vendor often offers performance/RUM; an analytics vendor often offers replay/flags).

Cadence is a Cloudflare-Worker + Supabase app, EU-residency-aware, solo-founder operated, with a strong existing receipts moat (decisions/outcomes/agent_runs/model_costs). The doctrine [`../strategy/build-buy-integrate.md`](../strategy/build-buy-integrate.md) says **BUILD the moat, BUY the commodity, INTEGRATE at a façade so the buy is reversible.**

## Decision

**Hybrid (V3): BUY the commodity, BUILD the moat.**

| Capability | Choice | Why |
| --- | --- | --- |
| Product usage + session replay + feature flags + A/B | **PostHog EU** | MIT core (self-host escape), one SDK covers 4 capabilities, EU region, generous free tier (1M events/mo + 5k replays), excellent Worker SDK. |
| Server / route / Worker errors + performance | **Sentry EU** | Best Cloudflare Workers SDK, source-map upload, release tracking, transaction tracing, EU region, free tier 5k errors/mo. |
| Uptime probes + on-call + status page | **Better Stack** | One vendor covers all three (vs PagerDuty + Statuspage + UptimeRobot = three bills), free tier 10 monitors, EU region. |
| Agent-cost analytics, decision-velocity analytics, business-outcome analytics, in-app incidents panel | **BUILD in-house** on Postgres | This is the moat. Crosses private tables. Drives the Trust Ledger + PM Impact Ledger + admin surfaces. |

## Alternatives considered + rejected

### Product analytics
- **Mixpanel** — rejected: closed-source (no self-host escape), no integrated replay/flags, EU tenancy is Enterprise-tier.
- **Amplitude** — rejected: closed-source, replay is a separate paid SKU, pricing climbs faster at 100k+ MAU.
- **GA4** — rejected: marketing-oriented, sampled at scale, no event-stream export on free tier.
- **Self-build on Postgres** — rejected for product usage: reinventing funnels/retention/replay is months of work for an inferior result. Reserve build budget for the moat.

### Error capture + performance
- **Honeybadger** — rejected: weaker Worker support, no integrated performance product.
- **Rollbar** — rejected: UI dated, EU residency is Enterprise.
- **Bugsnag (SmartBear)** — rejected: Enterprise focus, pricing climbs fast.
- **Datadog** — rejected: excellent product, wrong cost ($15/host/mo + APM SKUs is overkill for a single-Worker app), heavy lock-in.

### Uptime + on-call + status page
- **PagerDuty (+ separate uptime + separate Statuspage)** — rejected: best-in-class on-call but $21/user/mo and you still need 2 more vendors; wrong fit for a solo founder.
- **Statuspage (Atlassian) + UptimeRobot + PagerDuty** — rejected: three vendors, three bills, three dashboards.
- **Self-hosted (Uptime Kuma + Cachet)** — rejected: the uptime monitor must run OUTSIDE Cloudflare (if our Worker is down, our self-hosted monitor on Workers is also down), so we'd need a separate VPS. Pay $0 for someone else to do this right.

## Why EU residency for all three

Cadence is a global consumer-facing PM tool; users will be from the EU. GDPR posture by default avoids a later DPA scramble. Every chosen vendor has a native EU region with the same SDK contract.

## Cost posture (web-verified 2026-06-25)

| Vendor | Free tier | First paid trigger | Source |
| --- | --- | --- | --- |
| PostHog EU | 1M events/mo + 5k replays | Beyond free is usage-priced (~$0.00031/event) | posthog.com/pricing |
| Sentry EU | 5k errors/mo + 10k performance units | Team plan $26/mo | sentry.io/pricing |
| Better Stack | 10 monitors + 3-min checks + 1 status page | Team plan $25/mo | betterstack.com/pricing |

**Demo + early users = $0/mo.** Re-verify before paying.

## Exit posture (the reversibility commitment)

- All vendor SDKs called only from `src/lib/observability/*.ts` (the façade). Spec: [`../features/observability-facade.md`](../features/observability-facade.md).
- Swap vendors = 1 file edit.
- Leaving Lovable: secrets are CF Worker secrets (founder-rotatable); vendor accounts are owned by the founder inbox; moat data lives in Supabase and is `pg_dump`-able. ~1 day of redeploy work, zero data loss, zero vendor renegotiation.
- The dormant-by-design admin gate (`admin_set_observability_enabled`) lets the founder cut all vendor traffic in one RPC call.

## Consequences

- Three new subprocessors (PostHog, Sentry, Better Stack) added to [`../features/subprocessor-disclosure.md`](../features/subprocessor-disclosure.md) at AFD-14.
- Three new env vars (`POSTHOG_API_KEY`, `SENTRY_DSN`, `BETTER_STACK_HEARTBEAT_URL`).
- One ESLint rule (no direct vendor SDK imports outside `src/lib/observability/`).
- One new admin RPC + migration (the gate) + one new migration (the `job_runs` table) + one column add (`agent_runs.failure_kind`) + 4 views.

## Related

- Plan: [`../planning/analytics-and-failure-detection-plan.md`](../planning/analytics-and-failure-detection-plan.md)
- Feature spec: [`../features/analytics-and-failure-detection.md`](../features/analytics-and-failure-detection.md)
- Façade contract: [`../features/observability-facade.md`](../features/observability-facade.md)
- Procurement rows: [`../operations/procurement-inventory.md`](../operations/procurement-inventory.md)
- Doctrine: [`../strategy/build-buy-integrate.md`](../strategy/build-buy-integrate.md)
