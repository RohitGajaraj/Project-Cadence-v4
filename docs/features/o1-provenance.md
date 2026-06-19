# O1 (provenance slice) - "why is this on the roadmap?"

> _Created: 2026-06-18 · Last updated: 2026-06-18_

**Status:** ◐ Partial (provenance on the opportunity drill shipped 2026-06-18; extended to the spec/PRD detail 2026-06-18 12:48; surfaced in the shared Lineage drawer 2026-06-18 cycle 19; a full typed-graph explorer + O3 drift/skill-packs remain). **Lane:** G1 Sense & Discovery.

## What it delivers

A **"Why this · source evidence"** card traces an artifact all the way back to the **root source signals** — the raw user evidence the decision rests on — and links each one. The existing Lineage card shows only the immediate parents (e.g. an opportunity's theme); this walks the whole ancestor chain to the bottom, so you can see "this is on the roadmap because of these N signals." It is on:

- The **opportunity drill** (`/product?opp=<id>`) — "why is this on the roadmap?".
- The **spec/PRD detail** (`/prds/<id>`, card "Why this spec · source evidence") — "why is this spec being built?". A spec inherits the chain through its opportunity → theme → signals; the same `getProvenance` walks from `kind:"prd"`.
- The **shared Lineage drawer** (`LineageDrawer`, a "Traces back to" section) — wherever the drawer opens for any artifact kind, it shows the deep root signals beneath the immediate "Came from" parents. Shown only when the chain is deeper than one hop (`signal_count > 0 && depth > 1`), so it never just duplicates "Came from" for a theme (whose immediate parents already are signals). Lists up to 8, with a "+N more" overflow line.

## How it works

No new graph tables: it reuses the existing `artifact_lineage` edge table (signal → theme → opportunity → prd → task, plus opportunity → mission). `recordLineage` already writes those edges across the discovery pipeline.

`getProvenance({ kind, id })` in `src/lib/lineage.functions.ts`:
- A **bounded upward BFS** over `artifact_lineage` ancestor edges (`child_kind`/`child_id` → `parent_kind`/`parent_id`), starting at the opportunity.
- A `seen` set makes it cycle-safe; `MAX_DEPTH = 8` and `MAX_NODES = 80` cap the walk so a large or cyclic graph can never run away (a `truncated` flag is returned when a cap is hit).
- Collects every `signal` reached at the root of the chain, then hydrates their `title`/`content`/`source`/`sentiment`/`created_at`.
- Returns `{ source_signals, signal_count, depth, node_count, truncated }`.
- RLS-scoped: the user-scoped Supabase client means only edges + signals the caller owns are walked.

UI: `OpportunityDetail.tsx` (`["provenance","opportunity",id]`), `_authenticated.prds.$id.tsx` (`["provenance","prd",id]`), and `LineageDrawer.tsx` (`["provenance",kind,id]`) each call it in a `useQuery` and render the card; every source signal links to `/product?tab=signals&signal=<id>`.

## Files

- `src/lib/lineage.functions.ts` - `getProvenance` server fn + `ProvenanceSignal` type.
- `src/components/product/OpportunityDetail.tsx` - the "Why this · source evidence" card on the opportunity drill.
- `src/routes/_authenticated.prds.$id.tsx` - the "Why this spec · source evidence" card on the spec/PRD detail.
- `src/components/cadence/LineageDrawer.tsx` - the "Traces back to" section in the shared Lineage drawer.

## Verify (live, after publish)

1. Open an opportunity promoted from a clustered theme. The card shows "Traces back to N source signals through M steps" and lists them; each links to the signal.
2. An opportunity added directly (no lineage) shows "No source signals traced."
3. Open a spec (`/prds/<id>`) generated from such an opportunity. The "Why this spec · source evidence" card traces through the opportunity to the same root signals; a spec authored from scratch shows "No source signals traced."
4. Open the Lineage drawer on a deep artifact (a spec or task). Below "Came from", a "Traces back to" section lists the root source signals; it is absent on a theme (immediate parents already are signals, depth 1). With more than 8 root signals, a "+N more" line appears.

## Not built (O1 / O3 remainder)

- A typed, navigable graph explorer across all artifact kinds.
- O3: fact currency / drift flags + versioned skill-pack export over MCP.
