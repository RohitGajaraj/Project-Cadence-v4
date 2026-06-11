# Scribe RAG citations (F-SCRIBE-CITATIONS, v4 station SCR-01)

The Scribe (PRD generation) now retrieves workspace evidence (signals, docs, meetings, notes) and cites it inline. Every generated PRD body contains `[n]`-style markers wherever the model drew from a chunk, and the PRD detail page renders a Citations card linking each entry back to its source row.

## What ships

- `generatePrd` in `src/lib/discovery.functions.ts` now calls the existing hybrid retriever `retrieve()` from `src/lib/rag/retriever.server.ts` (top-k 8, MMR-diversified) with `{opportunity title}\n{brief}` as the query.
- The chunks are injected into the user message as a `CONTEXT (cite as [n]):` block and the system prompt is extended to instruct inline citation.
- The retrieved chunk list is persisted to `prds.citations jsonb` as `{n, source_kind, source_id, title, snippet, score}[]` so the UI can render and deep-link without re-running retrieval.
- New `CitationsCard` (`src/components/product/CitationsCard.tsx`) renders under the PRD body on `/prds/$id` with source-kind icons and deep links:
  - `signal` → `/product?tab=signals`
  - `doc` → `/knowledge?tab=docs`
  - `meeting` → `/knowledge?tab=calendar&meeting=<id>`

## How to use / verify

- **Find it:** scroll to the bottom of `/prds/$id` after a PRD is generated — the "Cited evidence · N" card lists numbered sources.
- **Server enforcement:** retrieval is workspace-scoped via `match_rag_chunks(user_id)`; citations are read via existing `prds` RLS.
- **Verify:**
  1. From `/product?tab=opportunities` click "Generate PRD" on any opportunity.
  2. On the resulting PRD page, the body markdown contains at least one `[n]` marker.
  3. The Citations card at the bottom lists ≥1 source whose `n` matches a marker in the body.
  4. Click a citation row → router navigates to the right surface (signal → Product · Signals, doc → Knowledge · Docs, meeting → Knowledge · Calendar with the meeting sheet open).

## Notes

- Retrieval is best-effort: if `retrieve()` throws or returns 0 chunks, the PRD still generates with an empty `citations` array. Stale embeddings or a missing RAG index degrade gracefully to "no citations" rather than blocking the spec.
- The model is asked not to invent citation numbers; the schema is "use only the numbers in CONTEXT". Drift here is rare with Gemini 2.5 Pro but worth eyeballing on a fresh demo workspace.

## Related

- [`critic-agent.md`](./critic-agent.md) — the companion slice that runs after generation.
- [`../../architecture/runtime.md`](../../architecture/runtime.md) — RAG retrieval contract.
- [`../planning/feature-backlog.md`](../planning/feature-backlog.md) — live status board entry.