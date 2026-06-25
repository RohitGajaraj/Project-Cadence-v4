# SANDBOX — the Build / execution spine (`ExecProvider` seam + the $0 CI floor)

> _Created: 2026-06-21 · Owner: the loop (Lane 3) · Tier 1, Build cluster (HYBRID: integrate behind a seam)_

> Status · Shipped ◐ 2026-06-21 (lane 3); seam made load-bearing 2026-06-25 (lane 3). The `ExecProvider` seam + the GitHub Actions $0 CI floor are wired and unit-tested, **and the seam now drives a live consumer** — the Build CI panel reads its merge readiness through `resolveExecProvider()`, so the merge decision and the gate share one verdict and a future paid backend changes the surface with no call-site edit. The paid microVM adapter (Cloudflare Sandbox SDK) is reserved behind the seam, gated on the founder's compute-spend confirmation (sourcing-map founder call #4).

## What it does

A build needs somewhere to run its checks before it can merge or be previewed. Today there is no Cadence execution sandbox — `src/lib/ai/studio-ci.ts` says so outright: checks run in the connected repo's GitHub Actions CI. SANDBOX turns that implicit dependency into an explicit, swappable seam and ships the free floor:

1. **The `ExecProvider` seam** (`src/lib/exec/provider.ts`) — one interface for "where a build's checks run, and whether the result clears it to merge / preview". A paid microVM backend (Cloudflare Sandbox SDK first, then E2B / Vercel one swap away for untrusted code) plugs in behind the same interface when the founder confirms the spend.
2. **The $0 native floor** — `githubActionsProvider`, always available, never metered. Its `verdictFromChecks` reuses `studio-ci.ts` (`overallFromChecks` + `mergeReadinessFromCi`), so an `ExecProvider` verdict and the `studio.pr.merge` gate can never disagree on what "green" means.
3. **The $0 CI workflow** (`.github/workflows/ci.yml`) — runs the green correctness gates (`tsc --noEmit` + `bun test`) on every push to `main` and every PR, in GitHub Actions' free tier. This is the floor's actual signal, live from day one.

## Why this shape (sourcing-map doctrine)

The Build/execution cluster is **HYBRID**: integrate a provider behind a swappable seam rather than build a sandbox from scratch (`docs/strategy/sourcing-map.md`, line 55 + agent doctrine #2-3). The un-gated prep — scaffold the seam, ship the $0 floor — is autonomous. The founder-only actions are explicitly **not** done here: no metered compute, no paid account, no secret/OAuth client, no outward surface, no relaxed gate.

## Design

- **`ExecProvider`** — `{ id, label, available, verdictFromChecks(checks) }`. `ExecVerdict = { provider, overall, mayProceed, reason }`. `label` is the human-facing name (engine-room doctrine: name the place the checks ran, never the raw id) — a paid backend brings its own.
- **`githubActionsProvider`** — `label: "GitHub Actions"`, `available: true`; delegates the "what is green" decision to `studio-ci.ts` (no logic re-implemented, so the two readers cannot drift).
- **`RESERVED_PROVIDER_IDS`** = `cloudflare-sandbox | e2b | vercel` — named, reserved, **not yet wired**.
- **`resolveExecProvider(preferred?)`** — returns the floor by default; a reserved / unknown / absent preference falls back to the floor and **never strands a build**. When a paid adapter is added to the wired registry (with its `available` gated on the founder flag), the resolver picks it up with no call-site change.
- **`execGateFromChecks(checks, preferred?)` → `ExecGate { provider, providerLabel, mayProceed, reason }`** — the point-of-decision merge gate, derived *through* the seam. Pure (no I/O), so the same verdict is computed wherever the checks are already in hand. This is the function the live consumer calls.

### The CI floor's exclusions (deliberate)

`build` and the full `lint` are **not** run in CI: both carry pre-existing red baselines — the Lovable vite-config ESM-require cycle that fails `vite build` at config-load, and ~4k legacy eslint findings in untouched files. Including them would make the floor red on day one and drown out real regressions. `tsc --noEmit` + `bun test` are the gates the repo already keeps green every cycle, so they are the floor's true signal. The workflow uses `permissions: contents: read`, a concurrency-cancel group, and `bun install --frozen-lockfile` (installs the locked versions, so the `bunfig.toml` `minimumReleaseAge` supply-chain guard — which gates new *resolutions* — does not block it).

## The live consumer (2026-06-25, lane 3)

The "preview surface" increment is shipped: the seam now drives the **Build CI panel** at the point of merge decision.

- `getStudioSession` (`studio.functions.ts`, not chokepoint-pinned) builds its `StudioCi` snapshot's new `gate` field via `execGateFromChecks(checks)`. The verdict's internal `overallFromChecks(checks)` equals the stored `r.overall` (same `github.ci.read` snapshot), so the gate cannot drift from the verdict chip shown above it.
- `CiPanel.tsx` surfaces `gate.reason` (the plain-language merge readiness — "CI is red. Read the failing check…", coral only on an actual failure) plus `ran on · {gate.providerLabel}` provenance. It renders only once checks exist, so the empty `neutral` state defers to the single "checks haven't started yet" line (caught + fixed in the 2026-06-25 adversarial review).
- This makes the seam **load-bearing**: a real call site reads merge readiness from `resolveExecProvider()`, so wiring a paid backend later updates the surface with no call-site change.

## Deferred (founder- / chokepoint-gated)

- **The Cloudflare Sandbox SDK adapter** — a real `ExecProvider` that runs untrusted code / build previews in a microVM. Needs the founder's compute-spend confirmation (sourcing-map call #4) before its `available` flag can flip on. (The SDK shape is best fixed *with* that account/binding, so a dormant stub is deliberately not shipped here.)
- **Routing the `studio.pr.merge` gate itself through the seam** — `registry.server.ts` is **chokepoint-pinned** (the `ai/*` runtime is reserved to the core lane), so the gate's own `mergeReadinessFromCi(overallFromChecks(...))` call is unchanged. Behaviour-identical today (both read `studio-ci.ts`); fold this when the chokepoint is touched for the paid adapter.
- **The A2A delegate-out posture** (`BLD-04`) — separate, founder-gated.

## Verify

- `bun test src/lib/exec/provider.test.ts` (15 tests: the floor verdict for empty/green/failing/pending; the resolver's floor-fallback for default / wired / reserved / unknown ids; the `label` is a human name distinct from the id; and `execGateFromChecks` clears green / blocks red / blocks pending / cannot-gate-on-absent-CI / stays on the floor label for a reserved preference).
- On a Build session with an open PR, the CI panel shows the merge-readiness reason + `ran on · GitHub Actions` once checks report; a fresh PR with no checks yet shows only "No checks reported yet."
- After merge, the first push to `main` runs `.github/workflows/ci.yml`; confirm it goes green (tsc + tests).
