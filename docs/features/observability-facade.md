# Observability façade — the one-file vendor seam

> **Status:** DOCUMENTATION ONLY. Will be built by **AFD-02** (see [`../planning/analytics-and-failure-detection-plan.md`](../planning/analytics-and-failure-detection-plan.md) §7).
>
> Every vendor SDK import lives behind this façade. The rest of the codebase imports from `src/lib/observability` only.

## The contract

```ts
// src/lib/observability/index.ts

// Analytics (PostHog under the hood)
export function track(event: string, props?: Record<string, unknown>): void
export function identify(userId: string, traits?: Record<string, unknown>): void
export function pageView(path: string): void

// Errors (Sentry under the hood)
export function captureError(err: unknown, ctx?: Record<string, unknown>): void
export function captureMessage(msg: string, level: 'info'|'warning'|'error', ctx?: Record<string, unknown>): void
export function setUser(userId: string | null): void
export function setTag(key: string, value: string): void

// Uptime (Better Stack under the hood)
export function heartbeat(jobName: string): Promise<void>

// Job wrapper (in-house job_runs table + Better Stack heartbeat)
export function withJobRun<T>(jobName: string, fn: () => Promise<T>): Promise<T>

// Right-to-erasure
export function forget(userId: string): Promise<void>

// Gate read (mirrors credits_enabled())
export function observabilityEnabled(): boolean
```

## Rules

1. **One-way street:** the rest of `src/` may import from `src/lib/observability/*`. Nothing in `src/` may import `posthog-js`, `@sentry/*`, or `betterstack-*` directly. An ESLint rule (added at build time) enforces this.
2. **No-op without env:** every façade fn returns synchronously / resolves to `void` when its env var is absent. Dev/test do not ship vendor traffic. The app boots with no keys.
3. **Dormant by design:** even with keys present, vendor calls are skipped when `observabilityEnabled()` is `false`. The admin flips it via `admin_set_observability_enabled(true)`, audited in `admin_audit_log`.
4. **PII stripping:** `track()` never sees email/phone/name (caller responsibility, lint-checked); `captureError`'s `beforeSend` strips request bodies + auth headers.
5. **EU residency:** the SDK config pins `eu.posthog.com` + `o*.ingest.de.sentry.io` + Better Stack EU.
6. **Sample rates** live in `src/lib/observability/config.ts` and are admin-tunable from `/admin/observability` (AFD-12).

## Why a façade

So the "buy" is reversible. Swapping PostHog → Mixpanel is editing `analytics.ts`. Leaving Lovable is exporting secrets + redeploying. See the doctrine in [`../strategy/build-buy-integrate.md`](../strategy/build-buy-integrate.md) and the exit posture in the plan §6.

## Related

- Plan: [`../planning/analytics-and-failure-detection-plan.md`](../planning/analytics-and-failure-detection-plan.md)
- Vendor ADR: [`../decisions/analytics-vendor-selection.md`](../decisions/analytics-vendor-selection.md)
- Feature spec: [`./analytics-and-failure-detection.md`](./analytics-and-failure-detection.md)
