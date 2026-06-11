# Critic agent (F-CRITIC-AGENT, v4 station DEC-02)

The Critic is an adversarial reviewer that red-teams every new opportunity and every freshly drafted PRD before it reaches a human approval gate. It is the demo moment the Strategist → operator-approval handoff needs: instead of approving a raw ICE score, the operator approves a score plus a verdict, top risks, kill criteria, and a list of missing evidence.

## What ships

- New `critic` agent seeded per user (rose-toned, role-only — no UI presence beyond the badge).
- `runCritic(supabase, userId, target)` helper in `src/lib/discovery.functions.ts` — calls Gemini 2.5 Pro with a strict-JSON red-team prompt and writes the result to `opportunities.critic_review` / `prds.critic_review`.
- Auto-attached inline to `promoteThemeToOpportunity`, `promoteSignalToOpportunity`, and `generatePrd` so the verdict lands before the row is shown.
- `runCriticReview` server fn for manual UI re-runs.
- `CriticBadge` component (`src/components/governance/CriticBadge.tsx`) rendered in `OpportunitiesPanel` rows and the PRD detail metadata row.

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

## Related

- [`prd-rag-citations.md`](./prd-rag-citations.md) — the companion slice that gives the Scribe its evidence trail.
- [`../strategy/v4-feature-map-2026-06-11.md`](../strategy/v4-feature-map-2026-06-11.md) — DEC-02 entry.
- [`../planning/feature-backlog.md`](../planning/feature-backlog.md) — live status board entry.