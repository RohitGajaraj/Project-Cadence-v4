# Knowledge-Graph Explorer (O1 / DBR-1 v1)

> _Created: 2026-06-20._ The first lane-built increment of the Decision Brain (H1): a typed, navigable knowledge-graph explorer over the provenance the product already records. Strategic home: [`decision-brain.md`](./decision-brain.md) (the DBR-1 step). Built in the `parallel/knowledge` lane, founder-enriched + approved 2026-06-20 ("B+" scope).

## What this is (v1, the "B+" cut)

A typed `{ nodes, edges }` view of the product's own decision lineage, rendered as a bounded, Obsidian-style visual graph at `/knowledge?tab=graph`. Every signal / opportunity / theme / PRD / decision / task / mission is a typed, color-coded node; every recorded lineage relation is an edge; click any node to read its story (where it came from, what it led to, the root signals it rests on). A truthful time axis (every edge's real `created_at`) answers "what did the graph look like as of `<date>`".

It is derived **deterministically from the existing `artifact_lineage` table**. No LLM extraction, no new write-tables, migration-free, fail-safe.

## Why it is built this way (the spec's own guardrails, honored)

The Decision Brain spec sets three hard guardrails. This v1 satisfies all three precisely because it is a read-only projection:

1. **Hybrid, never graph-only.** This adds a graph *read surface* over data we already keep relationally; vector recall is untouched. No cost or latency regression on normal recall.
2. **Auto-extract, never manual.** `artifact_lineage` is already auto-written by `recordLineage` on every promotion (`promotePrdToTasks`, discovery -> opportunity, etc.). The graph builds itself from work the user already does. There is no second job.
3. **Claim never outruns wiring.** v1 only renders edges that **already exist**. It never fabricates a `contradicts` / `supersedes` edge. The bi-temporal supersession *engine* (which would infer those edges) is deferred, because inferring them needs an AI write-path (recurring spend, the AI chokepoint), which is a different lane and a founder gate.

This is a deliberate simplification of the original `O1` scope (which assumed new `kg_nodes` / `kg_edges` tables): deriving from `artifact_lineage` is leaner, deterministic, and removes the migration entirely for v1.

## Architecture

### Read model (pure, TDD) - `src/lib/knowledge-graph-explorer.ts`

A pure, server-free module so it is unit-testable in isolation (`bun:test`).

- **Types:** `GraphNodeKind` (the artifact kinds), `GraphRelation` (`cites | derived-from | promoted | depends-on | supersedes | contradicts | ...`), `GraphNode`, `GraphEdge`, `KnowledgeGraph`.
- `projectGraph(rawEdges, titleMap, focusKey, bounds)` -> `KnowledgeGraph`:
  - Typed nodes (kind from the artifact kind), `influence` = node degree, deduped.
  - Typed edges; `validFrom = created_at`; `validTo = null` (the seam).
  - Bounded by `MAX_NODES` / `MAX_DEPTH` (mirrors `getProvenance`), with a `truncated` flag.
  - Deterministic layout positions (no randomness): concentric rings by graph distance from the focus node, angular spread by stable index, so the same graph always renders the same and the layout is testable.
  - Fail-safe: empty / malformed input yields an empty graph, never throws.
- `filterByTime(graph, asOf)` -> `KnowledgeGraph`: keep only nodes/edges with `validFrom <= asOf` (and `validTo` null-or-after), the truthful time axis.

### Server - `src/lib/knowledge-graph-explorer.functions.ts`

- `getKnowledgeGraph({ focusKind?, focusId? })`: walks `artifact_lineage` **both** directions from the focus (bounded), hydrates artifact titles (reuses the `hydrateTitles` shape from `lineage.functions.ts`), and returns `projectGraph(...)`. **RLS-scoped** via the authed Supabase client (only the caller's edges + artifacts). **Fail-safe**: returns an empty graph on any error, never throws to the UI.
  - **Auto-focus**: with no explicit `focusId`, the focus defaults to the caller's most recent decision -> opportunity -> prd (the "why is this decision here" framing).
  - **Lineage-anchored fallback** (O1 close, 2026-06-22): a workspace's lineage often lives entirely off its newest decision (e.g. early `signal->theme` promotions with no decision attached). When the auto-focus has **zero** incident edges, `getKnowledgeGraph` re-anchors on the child of the most recent `artifact_lineage` row (`resolveLineageFocus` -> pure `pickLineageFocus`) and re-runs the BFS, so a workspace that HAS edges never renders the empty state just because its newest decision is disconnected. An **explicit** focus the user clicked is always respected (the fallback is gated on `!focusId`), even when it stands alone.
- Node "story" reuses the existing `getLineage` (immediate parents/children) + `getProvenance` (root signals). No redundant fetch path.

### UI - `/knowledge?tab=graph`

A new `graph` tab on the existing `_authenticated.knowledge.tsx` (`validateSearch` + `TabRow` + panel-per-tab pattern; add `?focusKind` / `?focusId`).

- `GraphPanel.tsx`: focus picker (default = a recent decision/opportunity), the canvas, the node-story side-panel, the time filter, the truncation notice, and Ember loading / empty / error states.
- `GraphExplorer.tsx`: the dependency-free **SVG canvas** (deterministic layout, color-by-type, size-by-influence, pan/zoom, click-to-select). All rendered titles are user data, so they are escaped (React text nodes, never `dangerouslySetInnerHTML`).
- `GraphNodeStory.tsx`: the selected node's provenance + descendants, reusing `getLineage` / `getProvenance`.

## The supersession seam (write-path SHIPPED as DBR-1.5, dormant)

`GraphEdge.relation` already includes `supersedes | contradicts`; `GraphEdge.validTo: string | null`. The renderer styles `supersedes` / `contradicts` edges distinctly (e.g. dashed / madder). The read v1 never emits them itself; the **write-path** that does now exists: **DBR-1.5** (`src/lib/ai/supersession.server.ts`) infers `supersedes`/`contradicts` edges from recorded outcomes and stamps `valid_to`/`invalidated_by`/`inference` on `artifact_lineage` (migration `20260621030000`). It is **flag-gated OFF** (`DECISION_BRAIN_SUPERSESSION`), so the seam stays empty until the founder activates it. Because the engine writes real `relation` values into the same table this surface reads (and the explorer selects an explicit column list that excludes the 3 new bi-temporal columns), the edges render with **zero UI change** the day the flag flips. The graph is bi-temporal-shaped from night one. Spec: [`../planning/supersession-engine-plan.md`](../planning/supersession-engine-plan.md).

### Supersession legibility (read-side, F-IA-BRAIN-GRAPH, SHIPPED ◐)

Styling the supersession edges distinctly is not the same as making them *legible*: a madder dashed line does not tell a PM "this decision was reversed by a later outcome." This slice puts the mechanic into words, derived from the `relation` field `getLineage` already returns, plus the bi-temporal `valid_to` stamp it returns via its `*` select (regression-safe: the column is simply absent until the DBR-1.5 migration applies, so a retired assertion just reads as current pre-migration). Additive, fail-safe, and it never touches the canvas's explicit column list (so no 42703 on the live DB).

- **Pure core** (`src/lib/knowledge-graph-view.ts`): `buildSupersessionStory(ancestors, descendants)` reads each node's incident `supersedes` / `contradicts` edges and phrases them from that node's point of view. Direction follows the parent-to-child edge convention: an **ancestor** edge (this node is the child) means it **was superseded / contradicted by** the parent (its belief was revised); a **descendant** edge means this node **supersedes / contradicts** the child. `isSupersessionRelation` is the shared predicate. **Bi-temporal:** an edge whose `valid_to` is stamped is a *retired* assertion (invalidate-don't-delete, the moat's distinguishing property) — it carries `retired` + `retiredAt`, sorts after current links, and is EXCLUDED from `revised` (a reversed revision no longer means the belief is currently revised). Self-revised links sort first; dedup by edge id; fail-safe on null/malformed/blank input. Unit-tested (`buildSupersessionStory` + `isSupersessionRelation`, 10 cases incl. the bi-temporal paths).
- **Node-story panel** (`GraphNodeStory.tsx`): a "decision history" section renders the story (madder-accented, links recenter the graph on the counterpart), with a one-line banner when this node's belief is *currently* revised. Retired assertions stay visible as history but are de-emphasized (dimmed, label struck, a "no longer current · <date>" marker, date-guarded so a malformed stamp never renders "Invalid Date"). The generic "came from" / "led to" lists now exclude supersession edges, so the mechanic reads once in its own section, not as a cryptic `supersedes` tag.
- **Canvas summary** (`GraphCanvasView.tsx`): two graph-level lines, both honoring the "as of" time axis. One reads "N links here mark a belief a recorded outcome later revised" (current revisions); the other "M revisions were themselves later reversed, kept as faded history" (retired). The counts split on the bi-temporal state, so a reversed revision is never double-counted as a current one.
- **Canvas edge styling** (`GraphExplorer.tsx` + the pure core): the SVG now renders a *retired* supersession edge as faded, finely-dotted history (lower opacity, denser dash) versus a current revision's bolder madder dash. `projectGraph` derives `GraphEdge.retired` (set only on a supersession edge with a stamped `valid_to`), and `filterByTime` recomputes it against the "as of" instant, so an assertion reversed *after* that instant still reads current then (true bi-temporal honesty), and retired edges are kept on the canvas, never dropped (invalidate-don't-delete).

**Built migration-tolerantly so it ships before the column is live.** The canvas BFS still uses an explicit column list (it can't `*`-select like the node-story path without pulling every column), so it would `42703` the whole graph to empty if it named `valid_to` before the migration applied. Instead `getKnowledgeGraph` runs one cheap probe (`resolveLineageCols`) that prefers the bi-temporal columns and falls back to the base set when `valid_to` is absent, so the canvas reads `valid_to` the moment it goes live and degrades silently before then. Combined with the outer `try/catch -> emptyGraph`, there is no failure path that blanks the graph.

Dormant-safe by construction: with zero supersession edges (the current state until the founder publishes + flips the flag) every surface renders nothing new, and pre-migration the probe falls back so behavior is byte-identical. So this stays `◐` until live-verify on a workspace with seeded outcome-driven edges (the founder's publish applies migration `20260621030000` + flips `DECISION_BRAIN_SUPERSESSION=1`).

## Deferred -> the next DBR increment (AI / attended lane)

- ~~The contradiction / supersession **write engine**~~ — SHIPPED as DBR-1.5 (flag-gated OFF). Remaining: the Critic reasoning over the written edges multi-hop (DBR-2), which is the read-side AI spend, founder-gated.
- A materialized `kg_nodes` / `kg_edges` store (only needed once we persist *inferred* edges).
- Whole-product mega-graph + clustering + level-of-detail.
- Entity resolution ("the checkout redesign" == "Project Swift").

## Testing

- **Unit (`bun:test`) on the pure core:** node typing, degree/influence, bounding (`MAX_NODES` / `MAX_DEPTH` + `truncated`), the time filter, supersession-edge classification, the supersession-story builder (direction + ordering + dedup + fail-safe), deterministic layout, and the fail-safe empties.
- **Server fn + UI:** `tsc --noEmit` + `bun run build` green; live-verify on publish (so the row lands `partial`).

## Gate

`bunx tsc --noEmit` + `bun run build` + the projector tests, all green -> adversarial self-review (RLS scope, SVG title-escaping, fail-safe paths) -> doc-loop -> commit explicit paths with a WHY -> fast-forward push.
