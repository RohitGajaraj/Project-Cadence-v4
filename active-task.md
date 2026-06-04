# Bundle 3 — Agent Trust Score + Autonomy Dial (C6)

Plan: `.lovable/plan.md` (approved 2026-06-04).

## Sub-steps
- [x] Migration: `agent_autonomy` table (one row per user+agent, arc enum, RLS owner-only).
- [ ] `src/lib/ai/trust.server.ts` — `computeAgentTrust`, `computeAllAgentTrust`, `resolveApprovalMode`, `suggestArc`.
- [ ] `src/lib/trust.functions.ts` — `getAllAgentTrust`, `setAgentArc` server fns (requireSupabaseAuth).
- [ ] `src/lib/ai/loop.server.ts` — replace `modeOf.get(call.name) ?? "confirm"` with `resolveApprovalMode(toolMode, arc)`; load arc once per run.
- [ ] `src/routes/_authenticated.agents.tsx` — render trust chip + arc dial on each agent card; mutation to flip arc; tooltip with breakdown.
- [ ] Doc loop: backlog C6 → shipped + How-to-use block, Live status board, plan.md §4, architecture/orchestration.md.
- [ ] Delete `active-task.md` on completion.

## Done criteria
1. `/agents` shows trust chip + arc dial on each agent card.
2. Set Discovery Scout to Trusted → dispatch a goal that uses a `confirm`-mode tool → loop executes inline (trace shows `status:"executed"`, no Decision Queue row).
3. Set the same agent back to Observing → next run queues approval again.
4. `calendar.create` still hard-forces approval even when arc=Ambient.

## Gotchas
- Safety floor: dial NEVER downgrades a tool whose own mode is `review`, and `calendar.create` stays hard-locked.
- Arc lookup happens once at the top of the loop run; do not re-read per-step.