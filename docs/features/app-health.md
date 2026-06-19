# APP-HEALTH — App-level health/readiness endpoint

> Status: ◐ Endpoint shipped 2026-06-20 (overnight cycle 50). The public health route + pure status assembly are built and unit-verified; the alerting half (wire a monitor → notify) and a status page are infra/founder + design-pass.

## What it does (one paragraph)

Exposes a public `GET /api/public/health` endpoint that an uptime monitor or load balancer can poll: it returns HTTP **200** `{ status: "ok", ... }` when the platform is healthy and HTTP **503** `{ status: "degraded", ... }` when a dependency is down, so the consumer reacts on the status code without parsing the body. It runs a cheap, timeout-bounded database reachability probe and reports per-check states (`worker`, `database`) without leaking any internal detail.

## Why it exists (one paragraph)

`considerations.md` (SRE/Platform lens) flags **"App-level monitoring + alerting (not just AI telemetry)"** as a P0 gap — uptime/errors/latency of the platform itself, plus the trust signal enterprise buyers ask about (status page, SLOs). The existing `health.functions.ts` only checks migration DRIFT for the app's own flows (SSOT finding 4), so a real external health/readiness signal was unbuilt. See [`../../plan.md`](../../plan.md) §4 (cycle 50 entry).

## Where to find it (nav path, route, panels)

`GET /api/public/health` (no UI). Hit it with `curl https://<host>/api/public/health`. Intended consumers: an uptime monitor (UptimeRobot / BetterStack / Pingdom), a load balancer / Cloudflare health check, and a future public status page (design pass).

## How it works (server fns, modules)

- `src/routes/api/public/health.ts` — the GET route. Runs `probeDatabase()`: a cheap `profiles` head-read capped at 1 row, wrapped in `Promise.race` with a 2s timeout; any answer means the DB is reachable (`ok`), a thrown/timed-out probe means `error`. Then calls the pure assembler and returns the body with the right status + `Cache-Control: no-store`.
- `src/lib/app-health.ts` — pure `assembleHealth(checks, nowIso)` → `{ body, httpStatus }`: overall `degraded` (HTTP 503) if any check is not `ok`, else `ok` (HTTP 200). Worker liveness is implicit (reaching the code means it serves). The timestamp is injected so the module stays pure + unit-tested.
- Reference architecture: [`../../architecture/runtime.md`](../../architecture/runtime.md).

## Governance & guardrails

- **Public + unauthenticated** (monitors don't auth), so it is designed not to be an attack surface: (1) **leaks nothing** beyond `ok`/`error` per-check states — no error messages, connection strings, or stack traces (a test asserts the exact response key set); (2) the DB probe is **trivially cheap** (one indexed-id head-read); (3) the probe is **timeout-bounded (2s)** so a slow/over-loaded DB cannot pile up requests into a DoS amplifier. `profiles` was verified as a real table (queried in onboarding/connections/calendar) before being used as the probe target.

## Verification checklist (concrete)

- [x] `bunx tsc --noEmit` clean (after `bun run build` regenerated `src/routeTree.gen.ts` for the new route); `bun run build` ✓; `bunx eslint` clean on the 3 new files.
- [x] `bun test src/lib/app-health.test.ts` 5/5 (ok→200, db-down→503, worker-always-ok, no-leak key set, purity). Full suite 303/303.
- [ ] Live: `curl /api/public/health` returns 200 when the DB is up and 503 when it is not (verify on the next publish — the live DB probe was not run unattended).
- [ ] An uptime monitor is pointed at the endpoint and alerts on 503 (founder, infra).

## Known limits / out of scope

- **Alerting** (wire a monitor → notify on 503) is infra/founder; this ships the surface a monitor polls, not the monitor.
- **Status page** (public uptime history) is design-pass.
- Only the database dependency is probed today; add further dependency checks (the AI gateway, etc.) here as needed — each is a new `CheckState` in `assembleHealth`.

## Related

- [`../../plan.md`](../../plan.md) §4 (cycle 50) · [`../planning/considerations.md`](../planning/considerations.md) SRE/Platform lens · sibling (different concern) `health.functions.ts` (migration drift) · [`../planning/SOURCE-OF-TRUTH.md`](../planning/SOURCE-OF-TRUTH.md)
