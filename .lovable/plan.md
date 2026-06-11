# Next M1 Golden Path slice

## Where M1 stands (audit result)

The 10-hop golden path is ~60% complete. **Ends are strong, middle is hollow.**

| Hop | State |
|---|---|
| Slack connector | ❌ missing |
| GitHub connector | 🟡 PAT only, no OAuth |
| Scout: signals → themes → opportunities | 🟡 real AI, manual ingest only |
| Strategist ranking | 🟡 tool exists, no surfaced trigger |
| **Critic attached to Strategist** | ❌ **0%** |
| Operator approve (gate 1) | ✅ |
| **Scribe PRD with RAG citations** | 🟡 PRD generates, **no citations** |
| Operator approve PRD (gate 2) | ✅ |
| Planner task graph from PRD | 🟡 mission DAG, not engineering tasks |
| Builder PR + CI | ✅ most polished hop |
| Release notes draft | 🔴 agent seeded, no fn, no publish tool |
| Outcome card seeded | 🟡 read-only rollup, no seeding action |

Five hops are missing or stubbed. Shipping all five in one slice leaves five half-built hops. This plan picks the **two highest-leverage** ones; together they make the Strategist → gate 1 → Scribe → gate 2 segment actually demoable.

## What this slice builds

### 1. Critic agent (DEC-02)
Every opportunity and PRD gets an adversarial red-team verdict before it reaches a human. Today the operator approves a raw ICE score with no challenge.

- **DB**: migration seeds `critic` agent, adds `critic_review jsonb` on `opportunities` and `prds` (verdict, risks[], kill_criteria[], reviewer_model, reviewed_at).
- **Tool**: `critic.review` in `TOOL_REGISTRY` — takes `{ target_kind: 'opportunity'|'prd', target_id }`, loads the row, runs an adversarial prompt through `callModel` (Gemini 2.5 Pro), writes `critic_review`. Auto mode for opportunities, confirm for PRDs.
- **Auto-attach**: `promoteThemeToOpportunity`, `promoteSignalToOpportunity`, and `generatePrd` enqueue `critic.review` inline (awaited) so the verdict lands before the row appears to the operator.
- **UI**: `CriticBadge` (verdict chip + risk count) in `OpportunitiesPanel`, opportunity detail, and PRD detail. Side sheet shows full review.

### 2. RAG-cited PRDs (SCR-01)
`generatePrd` doesn't call `retrieve()` today. The retriever already exists and is production quality.

- Wire `retrieve()` from `src/lib/rag/retriever.server.ts` into `generatePrd`: query = opportunity title + summary, top-k 8 across signals/docs/meetings.
- Inject chunks as a numbered context block; instruct the model to use `[1]`-style citations.
- Persist `prds.citations jsonb` (`{n, source_kind, source_id, snippet, score}[]`) — new column in the same migration.
- PRD detail renders a Citations card linking back to each source row.

### 3. Closing the doc loop (same turn)
- Flip `F-CRITIC-AGENT` and `F-SCRIBE-CITATIONS` in `docs/planning/feature-backlog.md` Live status board with Recent log + Last updated.
- Two one-liners to `plan.md` §4.
- Update `architecture/orchestration.md` (Critic step in planner contract) and `architecture/runtime.md` (RAG injection in generatePrd).
- New `docs/features/critic-agent.md` and `docs/features/prd-rag-citations.md`, each with the How-to-use / verify block.
- `active-task.md` tracks sub-steps, deleted when both ship.

## Explicitly out of scope (next slices)

- **Slack connector** — full app-user OAuth + ingest fn → Scout.
- **PRD → engineering task graph** (Planner gap; `mission.plan` plans agents, not eng tasks).
- **Release notes + outcome-card seeding** — bundle as a "launch + learn" slice.

GitHub OAuth vs PAT is polish, not a missing hop — current PAT flow demos fine.

## Technical details

**Migration (one file)**
```sql
ALTER TABLE public.opportunities ADD COLUMN critic_review jsonb;
ALTER TABLE public.prds ADD COLUMN critic_review jsonb;
ALTER TABLE public.prds ADD COLUMN citations jsonb;

INSERT INTO public.agents (user_id, slug, name, description, system_prompt, enabled)
SELECT user_id, 'critic', 'Critic',
       'Adversarial reviewer that red-teams opportunities and PRDs before human approval.',
       '<critic prompt>', true
FROM public.agents WHERE slug = 'strategist'
ON CONFLICT (user_id, slug) DO NOTHING;
```

**Files touched**
- new: `supabase/migrations/<ts>_critic_and_citations.sql`
- new: `src/components/governance/CriticBadge.tsx`
- new: `src/components/product/CitationsCard.tsx`
- edit: `src/lib/ai/tools/registry.server.ts` (+ `critic.review`)
- edit: `src/lib/discovery.functions.ts` (`generatePrd` calls `retrieve`, persists citations; promote fns trigger critic inline)
- edit: `src/components/product/OpportunitiesPanel.tsx`, `src/routes/_authenticated.prds.$id.tsx`
- edit: `architecture/orchestration.md`, `architecture/runtime.md`, `plan.md`, `docs/planning/feature-backlog.md`
- new: `docs/features/critic-agent.md`, `docs/features/prd-rag-citations.md`
- update: `active-task.md`

**Verification**
- Promote a theme → `critic_review` non-null within the same request.
- Open the opportunity → CriticBadge renders with verdict + risks.
- Generate a PRD from it → `prds.citations` populated, body contains `[1]`-style markers, Citations card links back to source signals/docs.

## Why this slice

These two hops sit on either side of the operator's first two approval gates and together turn the demo from "AI fills forms" into "AI red-teams its own work and cites sources; human governs." That's the M1 product claim verbatim. Slack and release/outcome are valuable but don't unblock the demo narrative the way Critic + Citations do.