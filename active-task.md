# Active task — Phase 2: "The OS / Autonomous Execution" (Agentic Product OS build)

> **✅ PHASE 1 ("The Loop Runs Itself") COMPLETE 2026-06-14** — all four gaps wired on **main**, build-green, `bun test` green (14), 2-agent adversarial review passed (4 real findings fixed, 3 verified-wrong rejected). Build-log: [`plan.md`](plan.md) §4 (top entry). Feature page: [`docs/features/loop-runs-itself.md`](docs/features/loop-runs-itself.md). Decisions: [`docs/strategy/session-decisions.md`](docs/strategy/session-decisions.md) (2026-06-14).
>
> **Next up — Phase 2** ([`v6` doc](docs/strategy/v6-agentic-product-os-2026-06-13.md) §9): execution-delegation under governance; memory compounding proven + demoable; OS framing/IA; A2A contract hardened. This is where autonomous execution moves from "the loop dispatches + retries itself" to "it executes end-to-end, governed."

> **Handoff 2026-06-14.** Work directly on **main** (repo convention — all tools on main, no long-lived branches).
> **Canonical plan:** [`docs/strategy/v6-agentic-product-os-2026-06-13.md`](docs/strategy/v6-agentic-product-os-2026-06-13.md) — read **§9 (Phase 2)** + the runtime-reality audit in Appendix B.
> **Session read order:** `git pull origin main` → this file → v6 doc §9 → [`docs/README.md`](docs/README.md) (file-placement policy) → [`AGENTS.md`](AGENTS.md).

## ✅ Phase 1 — DONE (2026-06-14)
All four wired (detail in `plan.md` §4 + `docs/features/loop-runs-itself.md`):
- ☑ **Deterministic auto-advance** — `src/lib/ai/mission-advance.server.ts` (`advanceMissionCore`: reflect → dispatch ready → finalize, model-free, claim-first CAS). Folded into the `resume-runs` per-minute cron; the manual `advanceMission` fn + `mission.dispatch` tool share the same core. Missions run unattended past wave-0.
- ☑ **Bounded hop retry** — migration `20260614090000` (`mission_steps.{attempts,max_attempts,next_retry_at}` + `next_ready_mission_steps` backoff); pure policy `src/lib/ai/retry.ts`; pre-migration-tolerant probe.
- ☑ **Adaptive step budget** — `src/lib/ai/budget.ts` (`adaptiveStepBudget`: role base + arc + orchestrator-size, capped); replaces static `maxStepsFor` in `executeLoop` (both fresh + resume paths).
- ☑ **`memory_refs[]` populated** — `src/lib/ai/memory.server.ts` (`recallMemoryRefs` + `touchMemory` last_used_at); each dispatched hop threads memory; migration `20260614091000` rescopes `match_agent_memory` to `COALESCE(auth.uid(), for_user)` for the service-role path.
- ☑ **Latent bug fixed** — `maybeCompleteMission` is now DAG-aware (a wave-0 child finishing no longer prematurely completes a multi-wave mission; failure-aware final status).

## ⚠️ OPEN GATE (carry forward — same pattern as every prior phase)
The **two P1 migrations apply on the next Lovable sync**: `20260614090000_p1_mission_step_retry` (retry columns + RPC backoff) and `20260614091000_p1_memory_recall_for_user` (`match_agent_memory` `for_user`). Until then the code degrades gracefully — **auto-advance + adaptive budgets work; retry is off (a failed hop terminalizes); autonomous-path `memory_refs` carries reflections only.** After sync, verify (below).

## Verify (Phase 1 done bar)
- `bun test` + `bun run build` green. ✅ (done this session)
- After sync: on `/missions/$id`, a ≥ 2-wave orchestrated mission reaches a terminal state with **no** operator Advance press; a deliberately-failed hop shows a second child run (retry) before finalizing `completed_with_failures`; a dispatched hop's handoff payload carries non-empty `memory_refs`.

## Phase 2 — first cuts (read v6 §9 before starting; this is a sketch, not the spec)
- **Execution-delegation under governance** — extend beyond plan/dispatch/retry to agents *executing* reversible work end-to-end behind the trust arc (the North Star's "it executes, not advises"). Likely files: `src/lib/ai/loop.server.ts`, the tool registry, `trust.server.ts`.
- **Memory compounding, demoable** — make the `learnings` (`prior_ice→new_ice`) the visible moat object end-to-end; entity-link memory→the opportunity whose score moved; prove a decision's outcome re-scores a future priority on real-ish data.
- **OS framing / IA + A2A contract hardening** — per v6 §3/§5; keep the `HandoffPayload` contract as the config surface (now carrying `memory_refs[]`).

## Standing rules (non-negotiable)
- Work on **main**; commit small with a one-line **WHY**; push so other tools pulling main see it (and the migrations queue for the next sync).
- **Claim never outruns wiring** — no "fully autonomous" copy anywhere. Voice: *"the loop runs the reversible work; you make the calls."*
- **File-placement policy** (`docs/README.md`): every new file → correct subfolder + linked from that folder's index, same commit; never repo root or `docs/` top level; no duplicates/stubs; screenshots local-only under `docs/screenshots/`.
- Closed-doc loop: update `plan.md` §4 + the relevant doc in the **same commit**.
- Scan skills/agents/plugins/MCP before each task (AGENTS.md §2).
- Pure logic (policy functions) gets a `bun test` (`*.test.ts`, excluded from the build/lint surface); Supabase-coupled wiring is verified by `bun run build` + adversarial review + live e2e.

## Inherited open gates (carry forward — full tracker: `docs/planning/known-issues.md`)
- **KI-13:** live signup 500s (`handle_new_user`) — demo creds only; no new real accounts.
- **Migration-apply via Lovable sync:** the two P1 migrations + the W3/W6 Phase-0 migrations land when Lovable syncs `main` + deploys.
- **KI-14:** eval score scale mixed (seeds 0–1 vs runner 0–100).
- **KI-15 / KI-16 (new, Phase 1 review):** zero-step-mission stale-message lingering · auto-advance 20-mission/tick cap — both minor / high-scale-only.
- Do **not** touch `vite.config.ts`; do **not** merge the stale `lovable-sync-*` branch.
