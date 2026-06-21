# BLD-04 — Delegate-out to external coding agents (DelegateProvider seam)

> Status · ◐ Dormant `DelegateProvider` seam + OpenHands adapter shipped 2026-06-21 (lane 3); off by default, live on the founder configuring a BYO endpoint/key AND a registry-wiring increment · Route(s): none (runtime seam) · Owner: the Build / agent-loop lane

## What it does

Lets a Cadence build mission hand a build task off to an **external coding agent** (OpenHands self-host first; Apache-licensed, free), still **governed** by the existing human-approval / trust dial, instead of running every build step in-house. This increment ships the **seam and the OpenHands adapter, dormant**: the contract, the request/response mapping, the resolver, and the dormancy guarantee are built and unit-tested, but outbound delegation is off until the founder supplies a BYO endpoint + key and a follow-up increment wires the tool into the agent loop.

## Why it exists

A2A-style delegate-out (the inverse of inbound A2A) lets the platform scale build throughput and offer "bring your own coding agent" without re-implementing each agent. It is high blast radius (an external agent runs against the repo), so it must stay behind the same approval gate as any irreversible external action, and it must be impossible to fire by accident. The seam follows the proven SANDBOX `ExecProvider` pattern: scaffold the abstraction + ship a safe floor, reserve the paid/BYO backends behind it, and never provision or enable spend autonomously.

## Where to find it

Runtime seam only — no UI in this increment. `src/lib/delegate/`:

- **`provider.ts`** (pure, client-safe): the `DelegateProvider` interface, `DelegateRequest`/`DelegateVerdict` types, the `nullDelegateProvider` dormant floor, the reserved-id list, and the pure OpenHands request/response mapping (`buildOpenHandsRequest`, `mapOpenHandsResponse`).
- **`openhands.server.ts`** (server-only): `delegateEnabled()` (the `DELEGATE_OUTBOUND_ENABLED` flag), the `openHandsProvider` HTTP adapter, `resolveDelegateProvider()`, and `submitDelegation()` (the entry point the future tool calls).

## How it works

- **Dormancy is structural, not a single check.** `openHandsProvider.available` is true only when BOTH `DELEGATE_OUTBOUND_ENABLED` (=`1`/`true`) AND `OPENHANDS_ENDPOINT` are set. `resolveDelegateProvider()` returns the `nullDelegateProvider` floor whenever no available adapter matches. So with the defaults (nothing configured) every delegation attempt resolves to the floor and returns `{ accepted: false, reason: "…disabled…" }` with **no network call** — proven by a unit test that fails if `fetch` is touched while dormant.
- **Fail-safe transport.** When enabled, `submit()` builds the bounded request (`buildOpenHandsRequest`, task text capped at `DELEGATE_TASK_MAX_CHARS`), POSTs to `<endpoint>/api/v1/tasks` with a 30s timeout, and maps the response. Any non-2xx or transport error returns a refusal verdict; it never throws into the caller.
- **No phantom acceptance.** `mapOpenHandsResponse` accepts only on a known accepted-status (`queued`/`running`/…) AND a present `task_id`; a malformed or empty response is a refusal.
- **Governance posture.** Delegation is an irreversible external action. The governed tool that calls `submitDelegation` (deferred — see below) must be classified high blast radius in `tool-consequences.ts` so the loop floors it to at least human `confirm`; the dormancy flag is the backstop that makes it a safe no-op until then.

## Governance & guardrails

- Dormant by default; outbound delegation requires a founder-supplied endpoint + key + the flag.
- Fail-safe (a transport fault returns a refusal, never breaks the build path) and bounded (timeout + task-size cap).
- Pure contract is client-safe; the env/network adapter is `.server.ts` (never bundled to the client).

## Deferred (the wiring increment — needs the pinned chokepoint files / founder config)

- **Tool registration:** wrap `submitDelegation` in a `delegate.openhands` `ToolDef` and add it to `TOOL_REGISTRY` (`registry.server.ts` is a pinned chokepoint file).
- **Governance classification:** add `delegate.openhands` to `tool-consequences.ts` (`irreversible` + `EXTERNAL_TOOLS`) so `isHighRiskTool` floors it, and to `HIGH_RISK_FORCE_REVIEW` / `PAUSE_ON_APPROVAL_TOOLS` (`loop.server.ts`, pinned) so the run pauses for approval.
- **Persistence + callback:** track the external job id (e.g. a `delegate_meta` column on `agent_runs`) and a poll/webhook path to pull the result back and resume the paused run.
- **Founder:** set `DELEGATE_OUTBOUND_ENABLED=1`, `OPENHANDS_ENDPOINT`, `OPENHANDS_API_KEY`.
- **UI + second adapters** (Devin / Claude-Code / SWE-agent — already reserved ids).

## Verification checklist

- [x] `bunx tsc --noEmit` clean; `bun test` green (`src/lib/delegate/provider.test.ts`, 16 cases: pure mapping, dormant floor, flag semantics, resolver fallback, no-network-when-dormant, fail-safe transport, accepted-response mapping). Build "red" is the known pre-existing Lovable vite-config ESM baseline (config-load fails before any source compiles), not this change.
- [ ] On the wiring increment + founder config: confirm a delegated task reaches OpenHands behind a human-approval gate and the external job id is recorded; confirm the tool is a safe no-op while `DELEGATE_OUTBOUND_ENABLED` is unset.
