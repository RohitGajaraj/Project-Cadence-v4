# SANDBOX — the Build / execution spine (`ExecProvider` seam + the $0 CI floor)

> _Created: 2026-06-21 · Owner: the loop (Lane 3) · Tier 1, Build cluster (HYBRID: integrate behind a seam)_

> Status · Shipped ◐ 2026-06-21 (lane 3). The `ExecProvider` seam + the GitHub Actions $0 CI floor are wired and unit-tested; the paid microVM adapter (Cloudflare Sandbox SDK) is reserved behind the seam, gated on the founder's compute-spend confirmation (sourcing-map founder call #4).

## What it does

A build needs somewhere to run its checks before it can merge or be previewed. Today there is no Cadence execution sandbox — `src/lib/ai/studio-ci.ts` says so outright: checks run in the connected repo's GitHub Actions CI. SANDBOX turns that implicit dependency into an explicit, swappable seam and ships the free floor:

1. **The `ExecProvider` seam** (`src/lib/exec/provider.ts`) — one interface for "where a build's checks run, and whether the result clears it to merge / preview". A paid microVM backend (Cloudflare Sandbox SDK first, then E2B / Vercel one swap away for untrusted code) plugs in behind the same interface when the founder confirms the spend.
2. **The $0 native floor** — `githubActionsProvider`, always available, never metered. Its `verdictFromChecks` reuses `studio-ci.ts` (`overallFromChecks` + `mergeReadinessFromCi`), so an `ExecProvider` verdict and the `studio.pr.merge` gate can never disagree on what "green" means.
3. **The $0 CI workflow** (`.github/workflows/ci.yml`) — runs the green correctness gates (`tsc --noEmit` + `bun test`) on every push to `main` and every PR, in GitHub Actions' free tier. This is the floor's actual signal, live from day one.

## Why this shape (sourcing-map doctrine)

The Build/execution cluster is **HYBRID**: integrate a provider behind a swappable seam rather than build a sandbox from scratch (`docs/strategy/sourcing-map.md`, line 55 + agent doctrine #2-3). The un-gated prep — scaffold the seam, ship the $0 floor — is autonomous. The founder-only actions are explicitly **not** done here: no metered compute, no paid account, no secret/OAuth client, no outward surface, no relaxed gate.

## Design

- **`ExecProvider`** — `{ id, available, verdictFromChecks(checks) }`. `ExecVerdict = { provider, overall, mayProceed, reason }`.
- **`githubActionsProvider`** — `available: true`; delegates the "what is green" decision to `studio-ci.ts` (no logic re-implemented, so the two readers cannot drift).
- **`RESERVED_PROVIDER_IDS`** = `cloudflare-sandbox | e2b | vercel` — named, reserved, **not yet wired**.
- **`resolveExecProvider(preferred?)`** — returns the floor by default; a reserved / unknown / absent preference falls back to the floor and **never strands a build**. When a paid adapter is added to the wired registry (with its `available` gated on the founder flag), the resolver picks it up with no call-site change.

### The CI floor's exclusions (deliberate)

`build` and the full `lint` are **not** run in CI: both carry pre-existing red baselines — the Lovable vite-config ESM-require cycle that fails `vite build` at config-load, and ~4k legacy eslint findings in untouched files. Including them would make the floor red on day one and drown out real regressions. `tsc --noEmit` + `bun test` are the gates the repo already keeps green every cycle, so they are the floor's true signal. The workflow uses `permissions: contents: read`, a concurrency-cancel group, and `bun install --frozen-lockfile` (installs the locked versions, so the `bunfig.toml` `minimumReleaseAge` supply-chain guard — which gates new *resolutions* — does not block it).

## Deferred (not done here)

- **The Cloudflare Sandbox SDK adapter** — a real `ExecProvider` that runs untrusted code / build previews in a microVM. Needs the founder's compute-spend confirmation (sourcing-map call #4) before its `available` flag can flip on.
- **Wiring the seam into a live consumer** — e.g. routing the `studio.pr.merge` gate through `resolveExecProvider().verdictFromChecks` (behaviour-identical today since the floor reuses `studio-ci.ts`), or a preview surface. The seam is scaffolded; this is the next increment.
- **The A2A delegate-out posture** (`BLD-04`) — separate, founder-gated.

## Verify

- `bun test src/lib/exec/provider.test.ts` (9 tests: the floor verdict for empty/green/failing/pending, and the resolver's floor-fallback for default / wired / reserved / unknown ids).
- After merge, the first push to `main` runs `.github/workflows/ci.yml`; confirm it goes green (tsc + tests).
