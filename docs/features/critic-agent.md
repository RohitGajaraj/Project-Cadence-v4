# Critic agent (F-CRITIC-AGENT, v4 stations DEC-02 · DEF-03)

> _Created: 2026-06-11 · Last updated: 2026-06-19_

The Critic is an adversarial reviewer that red-teams every new opportunity and every freshly drafted PRD before it reaches a human approval gate. It is the demo moment the Strategist → operator-approval handoff needs: instead of approving a raw ICE score, the operator approves a score plus a verdict, top risks, kill criteria, and a list of missing evidence.

**Two lenses (same infra).** Opportunities get the **bet-evaluation** lens (DEC-02). Specs get a **spec-specific red-team** lens (DEF-03): ambiguity, untestable/unmeasurable acceptance criteria, scope creep, unstated assumptions, and missing edge cases, guard-railed to judge only what the spec actually says, never to invent requirements.

## What ships

- New `critic` agent seeded per user (rose-toned, role-only, no UI presence beyond the badge).
- `runCritic(supabase, userId, target)` helper in `src/lib/ai/critic.server.ts` (moved there in DEC-02-LOOP; re-exported from `discovery.functions.ts` for back-compat), calls Gemini 2.5 Pro with a strict-JSON red-team prompt and writes the result to `opportunities.critic_review` / `prds.critic_review`.
- Auto-attached inline to `promoteThemeToOpportunity`, `promoteSignalToOpportunity`, and `generatePrd` so the verdict lands before the row is shown.
- `runCriticReview` server fn for manual UI re-runs.
- `CriticBadge` component (`src/components/governance/CriticBadge.tsx`) rendered in `OpportunitiesPanel` rows and the PRD detail metadata row.
- **DEF-03 spec lens:** when `runCritic`'s target is a PRD it uses a spec red-team prompt (ambiguity · untestable criteria · scope creep · unstated assumptions · edge cases) instead of the bet prompt; the JSON shape is unchanged (reuses `critic_review`), and `CriticBadge` relabels its sections per kind: the generic "Missing evidence" becomes "Untestable criteria & open questions", and the sheet reads "Spec red-team". The opportunity path is unchanged.

## Verdict shape

```json
{
  "verdict": "ship | revise | kill",
  "summary": "max 240 chars",
  "risks": ["..."],
  "kill_criteria": ["..."],
  "missing_evidence": ["..."],
  "confidence": 0.0,
  "reviewer_model": "google/gemini-2.5-pro",
  "reviewed_at": "ISO timestamp"
}
```

## How to use / verify

- **Find it:** `/product?tab=opportunities` (chip under each title) and `/prds/$id` (chip in the metadata row).
- **Open:** click any chip → side sheet with risks, kill criteria, missing evidence, and a "Re-run Critic" button.
- **Server enforcement:** `runCritic` is best-effort. Failures are swallowed so a missing Critic never blocks the upstream write. Per-row reads use existing `opportunities` / `prds` RLS.
- **Verify:**
  1. Promote a theme via `/product?tab=signals` → open `/product?tab=opportunities` → new row has a verdict chip within ~5s.
  2. Click the chip → side sheet renders the four sections.
  3. Generate a PRD from the opportunity → PRD detail metadata row has a verdict chip.
  4. Click "Re-run Critic" → toast confirms and the chip refreshes with a new `reviewed_at`.

## Routable in-loop (DEC-02-LOOP, 2026-06-17)

Beyond the inline auto-attach, the Critic is a **registered agent-loop tool**: `critic.evaluate` (`{ target_kind: "opportunity" | "prd"; target_id }`) in `TOOL_REGISTRY`, backed by `runCriticTool` in `src/lib/ai/critic.server.ts`. The orchestrator or any specialist can call it to red-team a target **in-loop**, persisting the same `critic_review` — not only via the three inline promotion/spec paths. It is seeded into every user's `agent_tools` (mode `auto`, `built_in`; migration `20260617160000`, new + backfilled users) and is **gating-exempt** (listed in `ORCHESTRATION_CONTROL_FLOW_TOOLS` in `loop.server.ts`) because the verdict is advisory and side-effect-free beyond the row's own column, so it runs inline and can never strand a run waiting on an approval. The verdict never auto-fails dependent work; the caller decides. Promoting the Critic to a full `mission_steps` DAG node (a routed specialist step) is the deferred Phase 2 — it would touch the handoff completion-guard and retry machinery, so it was scoped out to keep this increment's blast radius near zero.

## Related

- [`prd-rag-citations.md`](./prd-rag-citations.md): the companion slice that gives the Scribe its evidence trail.
- [`../strategy/archive/v4-feature-map.md`](../strategy/archive/v4-feature-map.md): DEC-02 (opportunities) + DEF-03 (specs) entries.
- [`../planning/feature-backlog.md`](../planning/feature-backlog.md): live status board entry.