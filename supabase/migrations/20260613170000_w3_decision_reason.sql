-- v6 Phase 0 / W3 — record the human's note when resolving an approval gate.
--
-- Backs the decision-first card's "Reject (+reason)" action (Appendix D).
-- `resolveApproval` (src/lib/governance.functions.ts) writes this best-effort
-- and the app tolerates its absence, so this ALTER is safe to apply at any
-- time and in any order. Additive, nullable, idempotent — no backfill, no
-- destructive change. RLS is already enforced by the table's own-row policy.

ALTER TABLE public.agent_approvals
  ADD COLUMN IF NOT EXISTS decision_reason text;
