# In flight · DEC-02-LOOP — Critic as a routable loop step · 🔨 BUILDING

**Date:** 2026-06-17 · **Tool:** Claude Code · **Lane:** C (DECIDE) · claimed on the dashboard.

**What:** Promote the Critic from an inline function call to a **registered, agent-callable tool** (`critic.evaluate`) so the orchestrator or any specialist can challenge an opportunity/PRD in-loop, not only via the three hard-coded inline call sites. (v10 M-B item; DEC-02 inline Critic already shipped.)

**Pain:** #2 (can't defend calls) + #6 (every call should be challenged in-loop). Today `runCritic` is a private fn in `discovery.functions.ts`, reachable only from `promoteThemeToOpportunity` / `promoteSignalToOpportunity` / `generatePrd` / `runWedgeTeardown`. The agent loop cannot route to it.

## Scope decision (from the recon blueprint) — ship the SAFE increment

**Ship now (minimal blast radius):** extract the Critic logic to a shared module, register a routable `critic.evaluate` tool, make it gating-exempt like the `mission.*` tools, seed it. The Critic becomes a real loop-callable tool with **zero change** to `mission_steps`, the DAG planner, handoff/message-consumption, or retry logic.

**Defer (Phase 2):** making the Critic a full `mission_steps` DAG node. The recon flagged this touches the fragile completion-guard (a critic step that doesn't consume its handoff message hangs the mission or trips the orphan-sweep into false completion), bounded-retry on a non-deterministic judge, and verdict-routing semantics. High blast radius for no extra "routable" value. **Hard rule it surfaced: a `kill` verdict stays advisory — never auto-fail dependent steps.**

## Change set (5 files)
1. **`src/lib/ai/critic.server.ts`** (new) — move `CriticReview` + `runCritic` verbatim out of `discovery.functions.ts` (kind-aware prompts, `surface:"judge"`, gemini-2.5-pro + flash fallback, persist to `critic_review`, swallow-on-failure). Add `runCriticTool({target_kind,target_id}, ctx)` adapter returning `{ok, review}` (never throws).
2. **`src/lib/discovery.functions.ts`** — delete the moved block; `import { runCritic } from "@/lib/ai/critic.server"` + `export type { CriticReview } from "@/lib/ai/critic.server"` (≈8 modules import the type from here — keep the re-export). 4 call sites + `runCriticReview` unchanged. `callModel` import stays (7 other uses).
3. **`src/lib/ai/tools/registry.server.ts`** — `def({ name:"critic.evaluate", category:"planning", argsSchema:{target_kind,target_id}, run: runCriticTool })`; add to `TOOL_REGISTRY` array beside `mission.*`.
4. **`src/lib/ai/loop.server.ts`** — add `"critic.evaluate"` to `ORCHESTRATION_CONTROL_FLOW_TOOLS` (advisory + side-effect-free verdict; gating it could strand a run), with a comment.
5. **`supabase/migrations/20260617160000_dec02loop_critic_tool.sql`** — `CREATE OR REPLACE seed_default_agent_tools` (the fn `handle_new_user` actually calls) with a `critic.evaluate` row (category `planning`, mode `auto`, `built_in`) + the backfill `DO` loop over `profiles`. Mirrors the existing seed migration exactly; does NOT touch `handle_new_user`.

## Acceptance (DoD)
- `tsc --noEmit` 0 errors; `critic.server.ts` is `.server`-suffixed (no client-bundle leak); `bun run build` green.
- All 4 inline call sites + `runCriticReview` ("Re-run Critic" badge) behave identically (same model/surface/prompts/persist; wedge still returns `{opportunity, review}`; the 3 fire-and-forget sites still swallow failures and never block the upstream write).
- `TOOL_REGISTRY["critic.evaluate"]` resolves; an agent loop calling it runs **inline** (no `agent_approvals` row) and persists the verdict.
- Migration seeds it for new users (via `seed_default_agent_tools`) AND backfills existing users idempotently; re-run is a no-op.
- **Zero edits** to `mission-advance.server.ts` / `orchestrator.server.ts` (the DAG/handoff/retry machinery untouched).

## Build loop
1. ☑ Claim. 2. ⬜ Build (5 files). 3. ⬜ `tsc --noEmit` + `bun run build`. 4. ⬜ Adversarial review. 5. ⬜ Ship + docs (dashboard DEC-02-LOOP, `plan.md` §4, `trust-and-autonomy.md`/critic feature doc), clear claim, delete this file.
