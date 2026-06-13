# Active task — Phase 3: "Proof & Launch" (Agentic Product OS build)

> **✅ PHASE 1 ("The Loop Runs Itself") COMPLETE 2026-06-14** — all four gaps wired on **main**, pushed; 2-agent review (4 fixes). **✅ PHASE 2 ("The OS / Autonomous Execution") COMPLETE 2026-06-14** — W1 memory moat · W2 unattended-execution audit · W3 A2A hardening + moat-on-cockpit, all on **main**, build-green, `bun test` 23 green, adversarial review each (W1 4 fixes · W2+W3 2 honesty fixes). Build-log: [`plan.md`](plan.md) §4. Feature page (P1): [`docs/features/loop-runs-itself.md`](docs/features/loop-runs-itself.md). Decisions: [`docs/strategy/session-decisions.md`](docs/strategy/session-decisions.md) (2026-06-14).
>
> **🔨 PHASE 3 ("Proof & Launch") IN PROGRESS** ([`v6` doc](docs/strategy/v6-agentic-product-os-2026-06-13.md) §8 gauntlet + §9 Phase 3). **✅ Slice 1 ("Unblock + Instrument") DONE 2026-06-14** — Track 1: KI-13 signup made resilient (a real account can finally be created); Track 2: the **Gauntlet** surface (`/govern?tab=gauntlet`) instruments the three north-star metrics (acceptance rate · autonomy ratio · ritual retention) honestly on real tables. Built recon-first → parallel worktree → 12-finding adversarial review → 7 fixes; on **main**, build-green, `bun test` 32 green. **✅ KI-14 also DONE 2026-06-14** — eval-score scale standardized on 0–100 (silent overflow + false "below gate" fixed; migration `20260614160000`; 12-finding adversarial review). **Next:** the shareable-decision viral loop + pricing/paywall, then public launch. **Gate on the §8 gauntlet, not a date.** (Detail + open gate in the "Phase 3" section below.)

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

## Phase 3 — "Proof & Launch" (IN PROGRESS, gate on the §8 gauntlet, not a date)
Real-data design-partner hardening · proof-gauntlet instrumentation (≥10 PMs paying ≥$150/mo · the loop closes once on a partner's real data · autonomy ticks up on a real account) · pricing + the shareable-decision viral loop · public launch. Read v6 §8 + §9 before continuing. GTM + hardening phase, taken in slices.

### ✅ Slice 1 — "Unblock + Instrument" DONE 2026-06-14 (recon-first → parallel worktree build → adversarial review → fixes)
- ☑ **Track 1 — KI-13 signup unblock.** `20260614140000_p3_ki13_signup_resilience.sql`: each seed step in `handle_new_user` runs in its own `BEGIN..EXCEPTION` subtransaction so a fresh signup never 500s again (the app self-heals profile + workspace). Defensive-by-construction. The real-data gauntlet premise (≥8 partners on real data) needs this — it was blocked at the door. Review found Track 1 clean.
- ☑ **Track 2 — the Gauntlet surface.** `/govern?tab=gauntlet` — three north-star metrics on real owner-scoped tables with honest "not enough data yet" empty states: **A** acceptance rate (accepted={approved,executed,failed} / decided), **C** autonomy ratio (successful unattended `tool_calls` vs gated `agent_approvals`), **B** ritual retention (`ritual_sessions`, pre-migration-tolerant, per-UTC-day idempotent). `src/lib/gauntlet.functions.ts` + `gauntlet-metrics.ts`(+tests) + `GauntletMetricsPanel.tsx`. Feature doc: [`docs/features/gauntlet-metrics.md`](docs/features/gauntlet-metrics.md).
- **Method note:** two file-disjoint tracks — T2 built by a background worktree agent while T1 went on main, then a 3-lens adversarial-review workflow (`wf_27276120`) over both diffs → 12 confirmed findings (all Track 2) → 7 distinct fixes folded in before landing. `bun run build` green, `bun test` 32/32. Commits on **main**: `9401ae2` (KI-13) · `e6c8b5b` (Gauntlet).

## ⚠️ OPEN GATE — Phase 3 slice 1 (carry forward — same pattern as every prior phase)
**Three** new migrations apply on the **next Lovable sync**: `20260614140000_p3_ki13_signup_resilience` (resilient `handle_new_user` — until applied, live signup still 500s); `20260614150000_p3_ritual_sessions` (table + per-day unique index — until applied, Gauntlet Metric B reads "not enough data yet" by design; A and C are live now); and `20260614160000_p3_ki14_eval_score_0to100` (eval scores → 0–100 — until applied, a live eval run overflows the column and seeded eval scores read "below gate"). KI-13 + KI-14 can't be verified live until sync (the Supabase MCP here was unauthenticated).

### ⏭️ Next (Phase 3 — gate on §8, not a date)
- **Shareable-decision viral loop** (§7): public `/d/$slug` mirroring the `/p/$slug` prototype-share pattern; `decisions` gains `share_slug`/`is_public` + a public-select RLS policy.
- **Pricing / paywall** (§7): Free / Pro($39) / Team; charge for memory persistence; Stripe + quota enforcement.
- **KI-15 / KI-16** (low/rare): stale zero-step-mission completion · mission-advance 20/tick cap.

## Standing rules (non-negotiable)
- Work on **main**; commit small with a one-line **WHY**; push so other tools pulling main see it (and the migrations queue for the next sync).
- **Claim never outruns wiring** — no "fully autonomous" copy anywhere. Voice: *"the loop runs the reversible work; you make the calls."*
- **File-placement policy** (`docs/README.md`): every new file → correct subfolder + linked from that folder's index, same commit; never repo root or `docs/` top level; no duplicates/stubs; screenshots local-only under `docs/screenshots/`.
- Closed-doc loop: update `plan.md` §4 + the relevant doc in the **same commit**.
- Scan skills/agents/plugins/MCP before each task (AGENTS.md §2).
- Pure logic (policy functions) gets a `bun test` (`*.test.ts`, excluded from the build/lint surface); Supabase-coupled wiring is verified by `bun run build` + adversarial review + live e2e.

## Inherited open gates (carry forward — full tracker: `docs/planning/known-issues.md`)
- **KI-13:** ✅ fix landed (`20260614140000`) — resilient `handle_new_user`; applies on next Lovable sync (until then signup still 500s; verify a fresh signup after sync).
- **Migration-apply via Lovable sync:** the two P1 migrations + the W3/W6 Phase-0 migrations land when Lovable syncs `main` + deploys.
- **KI-14:** ✅ fix landed (`20260614160000`) — eval scale → 0–100 (widen + rescale eval_runs/eval_case_results/drift_snapshots); applies on next Lovable sync.
- **KI-15 / KI-16 (new, Phase 1 review):** zero-step-mission stale-message lingering · auto-advance 20-mission/tick cap — both minor / high-scale-only.
- Do **not** touch `vite.config.ts`; do **not** merge the stale `lovable-sync-*` branch.
