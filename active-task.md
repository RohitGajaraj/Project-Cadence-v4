# Active task — Phase 3: "Proof & Launch" (Agentic Product OS build)

> **✅ PHASE 1 ("The Loop Runs Itself") COMPLETE 2026-06-14** — all four gaps wired on **main**, pushed; 2-agent review (4 fixes). **✅ PHASE 2 ("The OS / Autonomous Execution") COMPLETE 2026-06-14** — W1 memory moat · W2 unattended-execution audit · W3 A2A hardening + moat-on-cockpit, all on **main**, build-green, `bun test` 23 green, adversarial review each (W1 4 fixes · W2+W3 2 honesty fixes). Build-log: [`plan.md`](plan.md) §4. Feature page (P1): [`docs/features/loop-runs-itself.md`](docs/features/loop-runs-itself.md). Decisions: [`docs/strategy/session-decisions.md`](docs/strategy/session-decisions.md) (2026-06-14).
>
> **Next up — Phase 3** ([`v6` doc](docs/strategy/v6-agentic-product-os-2026-06-13.md) §8 gauntlet + §9 Phase 3): real-data design-partner hardening; instrument the proof-gauntlet metrics; pricing + the shareable-decision viral loop; public launch. **Gate on the §8 gauntlet, not a date.** This is a GTM + hardening phase, not a feature phase — likely starts by instrumenting the north-star metrics (calls-queue acceptance rate · real-data ritual retention · autonomy ratio) on real surfaces. (Detail in the "Phase 3" section below.)

> **Handoff 2026-06-14.** Work directly on **main** (repo convention — all tools on main, no long-lived branches).
> **Canonical plan:** [`docs/strategy/v6-agentic-product-os-2026-06-13.md`](docs/strategy/v6-agentic-product-os-2026-06-13.md) — read **§8 (gauntlet) + §9 (Phase 3)** + the runtime-reality audit in Appendix B.
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

## Phase 2 — decomposition (grounded by a code sweep; sequenced demoable units)
- ☑ **W1 — Close the memory-compounding loop (the moat) · DONE 2026-06-14.** `recordOutcome` now distils each outcome into a global-scope, embedded `agent_memory` row (`src/lib/ai/outcome-memory.ts` + `memory.server.ts → rememberOutcome`), so `match_agent_memory` returns it to future runs of any agent and P1 threading carries it across hops. Fixes the claim-vs-wiring gap (the `learnings` audit was written but never read by the loop). 23 `bun test` green; 1-agent review (4 fixes). Detail: `plan.md` §4.
- ☑ **W2 — Execution-delegation audit trail · DONE 2026-06-14.** `/missions/$id` now shows an "Executed unattended" card — side-effecting tools the loop ran inline with no gate (the arc had earned auto), each with its catalogued effect + reversibility. `getMission` flags `HopToolCall.is_unattended` via `isSideEffectingTool()`. Honest by construction: every `tool_calls` row is an inline auto-execution (gated tools queue approvals; `executeApproval` never writes `tool_calls`).
- ☑ **W3 — A2A hardening + moat on the cockpit · DONE 2026-06-14.** `enqueueHandoff` validates `memory_refs[]` against real `agent_memory` ids (drops phantom refs, best-effort). `getSwarmHud` gains `outcomes_remembered`, surfaced as "N outcomes in memory" in the Agents-tab HUD. Reused the existing Swarm HUD (the `/swarm` route is mothballed → `/missions?tab=agents`) instead of a redundant new `/system`. Artifacts left free-form (validated on use).

> **Phase 2 is functionally complete (W1·W2·W3 all on `main`).** The remaining v6 §9 Phase-2 framing item ("OS framing/IA") is satisfied by the enriched Swarm HUD; a deeper IA pass can fold into Phase 3 if real-data feedback asks for it.

## Phase 3 — "Proof & Launch" (next, gate on the §8 gauntlet, not a date)
Real-data design-partner hardening · proof-gauntlet instrumentation (≥10 PMs paying ≥$150/mo · the loop closes once on a partner's real data · autonomy ticks up on a real account) · pricing + the shareable-decision viral loop · public launch. Read v6 §8 + §9 (Phase 3) before starting. This is a go-to-market + hardening phase more than a feature phase — likely starts with instrumenting the gauntlet metrics (calls-queue acceptance rate · real-data ritual retention · autonomy ratio) on real surfaces.

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
