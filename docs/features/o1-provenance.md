# O1 (provenance slice) - "why is this on the roadmap?"

**Status:** ◐ Partial (provenance shipped 2026-06-18; a full typed-graph explorer + O3 drift/skill-packs remain). **Lane:** G1 Sense & Discovery.

## What it delivers

On the opportunity drill (`/product?opp=<id>`), a **"Why this · source evidence"** card traces the opportunity all the way back to the **root source signals** — the raw user evidence the decision rests on — and links each one. The existing Lineage card shows only the immediate parents (the opportunity's theme); this walks the whole ancestor chain to the bottom, so you can see "this is on the roadmap because of these N signals."

## How it works

No new graph tables: it reuses the existing `artifact_lineage` edge table (signal → theme → opportunity → prd → task, plus opportunity → mission). `recordLineage` already writes those edges across the discovery pipeline.

`getProvenance({ kind, id })` in `src/lib/lineage.functions.ts`:
- A **bounded upward BFS** over `artifact_lineage` ancestor edges (`child_kind`/`child_id` → `parent_kind`/`parent_id`), starting at the opportunity.
- A `seen` set makes it cycle-safe; `MAX_DEPTH = 8` and `MAX_NODES = 80` cap the walk so a large or cyclic graph can never run away (a `truncated` flag is returned when a cap is hit).
- Collects every `signal` reached at the root of the chain, then hydrates their `title`/`content`/`source`/`sentiment`/`created_at`.
- Returns `{ source_signals, signal_count, depth, node_count, truncated }`.
- RLS-scoped: the user-scoped Supabase client means only edges + signals the caller owns are walked.

UI: `OpportunityDetail.tsx` calls it in a `useQuery` (`["provenance","opportunity",id]`) and renders the card next to Lineage; each source signal links to `/product?tab=signals&signal=<id>`.

## Files

- `src/lib/lineage.functions.ts` - `getProvenance` server fn + `ProvenanceSignal` type.
- `src/components/product/OpportunityDetail.tsx` - the "Why this · source evidence" card.

## Verify (live, after publish)

1. Open an opportunity that was promoted from a clustered theme. The card shows "Traces back to N source signals through M steps" and lists them; each links to the signal.
2. An opportunity added directly (no lineage) shows "No source signals traced."

## Not built (O1 / O3 remainder)

- A typed, navigable graph explorer across all artifact kinds.
- O3: fact currency / drift flags + versioned skill-pack export over MCP.
