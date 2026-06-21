// O1 / DBR-1 v1 - the server seam for the knowledge-graph explorer.
//
// Reads the caller's `artifact_lineage` (RLS-scoped) with a bounded both-ways
// walk from a focus artifact, hydrates artifact titles, and hands the rows to
// the pure `projectGraph` core. Fail-safe by contract: any failure returns an
// empty graph, never throws to the UI. Spec: docs/features/knowledge-graph-explorer.md
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  projectGraph,
  nodeKey,
  DEFAULT_BOUNDS,
  GRAPH_NODE_KINDS,
  type GraphNodeKind,
  type GraphBounds,
  type KnowledgeGraph,
  type RawLineageEdge,
} from "./knowledge-graph-view";

const KindSchema = z.enum(GRAPH_NODE_KINDS);

/**
 * A FRESH empty graph each call. Never return a shared singleton: on Cloudflare
 * Workers module-level state is shared across requests in an isolate, so a
 * by-reference empty would be mutable shared state.
 */
function emptyGraph(): KnowledgeGraph {
  return {
    nodes: [],
    edges: [],
    focusKey: null,
    stats: { nodeCount: 0, edgeCount: 0, rootSignals: 0, maxRing: 0 },
    truncated: false,
  };
}

/** Artifact-kind -> (table, title column). Mirrors lineage.functions.ts. */
const TITLE_TABLE: Record<GraphNodeKind, { table: string; col: string }> = {
  signal: { table: "signals", col: "title" },
  theme: { table: "themes", col: "title" },
  opportunity: { table: "opportunities", col: "title" },
  prd: { table: "prds", col: "title" },
  roadmap_item: { table: "roadmap_items", col: "title" },
  task: { table: "tasks", col: "title" },
  meeting: { table: "meetings", col: "title" },
  decision: { table: "decisions", col: "title" },
  mission: { table: "missions", col: "title" },
};

const LINEAGE_COLS = "id,parent_kind,parent_id,child_kind,child_id,relation,rationale,created_at";
/** Same row plus the bi-temporal `valid_to` stamp (DBR-1.5), used once the migration is live. */
const LINEAGE_COLS_BITEMPORAL = `${LINEAGE_COLS},valid_to`;

/** A PostgREST "column does not exist" error (42703) - the pre-migration signal for `valid_to`. */
function isMissingColumnError(
  err: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!err) return false;
  if (err.code === "42703") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("does not exist") && m.includes("valid_to");
}

/**
 * Pick the lineage column set for THIS request: prefer the bi-temporal columns,
 * but fall back to the base set if `valid_to` is not live yet (the DBR-1.5 migration
 * applies on the founder's next publish). One cheap probe keeps the BFS itself simple
 * and means adding `valid_to` here can never 42703 the whole graph to empty.
 */
export async function resolveLineageCols(supabase: SupabaseClient): Promise<string> {
  try {
    const { error } = await supabase.from("artifact_lineage").select("valid_to").limit(1);
    return isMissingColumnError(error) ? LINEAGE_COLS : LINEAGE_COLS_BITEMPORAL;
  } catch {
    return LINEAGE_COLS;
  }
}

/** Batch `.in()` id lists so a PostgREST URL can never run long, even at the node cap. */
const IN_BATCH = 25;
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type FocusNode = { kind: GraphNodeKind; id: string };

/** Pick the focus: the explicit one, else the caller's most recent decision / opportunity / prd. */
async function resolveFocus(
  supabase: SupabaseClient,
  focusKind?: GraphNodeKind,
  focusId?: string,
): Promise<FocusNode | null> {
  if (focusKind && focusId) return { kind: focusKind, id: focusId };
  const fallbacks: [GraphNodeKind, string][] = [
    ["decision", "decisions"],
    ["opportunity", "opportunities"],
    ["prd", "prds"],
  ];
  for (const [kind, table] of fallbacks) {
    const { data } = await supabase
      .from(table)
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1);
    const id = (data as { id?: string }[] | null)?.[0]?.id;
    if (id) return { kind, id };
  }
  return null;
}

/** Bounded both-directions BFS over artifact_lineage. Collects edges + visited node ids. */
async function fetchSubgraph(
  supabase: SupabaseClient,
  focus: FocusNode,
  bounds: GraphBounds,
  cols: string,
): Promise<{ edges: RawLineageEdge[]; nodes: Map<string, FocusNode> }> {
  const nodes = new Map<string, FocusNode>([[nodeKey(focus.kind, focus.id), focus]]);
  const edges: RawLineageEdge[] = [];
  const edgeIds = new Set<string>();
  let frontier: FocusNode[] = [focus];
  let depth = 0;

  while (frontier.length && depth < bounds.maxDepth && nodes.size < bounds.maxNodes) {
    depth++;
    const byKind = new Map<GraphNodeKind, string[]>();
    for (const n of frontier) {
      const arr = byKind.get(n.kind) ?? [];
      arr.push(n.id);
      byKind.set(n.kind, arr);
    }
    const next: FocusNode[] = [];
    for (const [kind, ids] of byKind) {
      for (const batch of chunk(ids, IN_BATCH)) {
        const { data: up } = await supabase
          .from("artifact_lineage")
          .select(cols)
          .eq("child_kind", kind)
          .in("child_id", batch);
        const { data: down } = await supabase
          .from("artifact_lineage")
          .select(cols)
          .eq("parent_kind", kind)
          .in("parent_id", batch);
        // The dynamic `cols` string defeats the client's row-type inference (it
        // returns GenericStringError[]); cast through unknown, the same escape hatch
        // hydrateTitles uses for its dynamic table name.
        const rows = [
          ...((up ?? []) as unknown as RawLineageEdge[]),
          ...((down ?? []) as unknown as RawLineageEdge[]),
        ];
        for (const e of rows) {
          if (!edgeIds.has(e.id)) {
            edgeIds.add(e.id);
            edges.push(e);
          }
          const ends: FocusNode[] = [
            { kind: e.parent_kind, id: e.parent_id },
            { kind: e.child_kind, id: e.child_id },
          ];
          for (const end of ends) {
            const key = nodeKey(end.kind, end.id);
            if (!nodes.has(key) && nodes.size < bounds.maxNodes) {
              nodes.set(key, end);
              next.push(end);
            }
          }
        }
      }
    }
    frontier = next;
  }
  return { edges, nodes };
}

/** Hydrate titles for every visited node, grouped by table. */
async function hydrateTitles(
  supabase: SupabaseClient,
  nodes: Map<string, FocusNode>,
): Promise<Map<string, string>> {
  const byKind = new Map<GraphNodeKind, string[]>();
  for (const { kind, id } of nodes.values()) {
    const arr = byKind.get(kind) ?? [];
    arr.push(id);
    byKind.set(kind, arr);
  }
  const titleMap = new Map<string, string>();
  for (const [kind, ids] of byKind) {
    const spec = TITLE_TABLE[kind];
    if (!spec) continue;
    // Dynamic table name needs a cast (the typed client can't infer it), the
    // same pattern lineage.functions.ts uses for title hydration.
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => { in: (c: string, v: string[]) => Promise<{ data: unknown }> };
        };
      }
    )
      .from(spec.table)
      .select(`id, ${spec.col}`)
      .in("id", ids);
    for (const row of (data as Array<Record<string, unknown>> | null) ?? []) {
      const id = row.id as string | undefined;
      const title = row[spec.col];
      if (id) titleMap.set(nodeKey(kind, id), typeof title === "string" ? title : "");
    }
  }
  return titleMap;
}

/**
 * O1: the typed knowledge-graph around a focus artifact. RLS-scoped, bounded,
 * fail-safe. With no focus, centres on the caller's most recent decision.
 */
export const getKnowledgeGraph = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        focusKind: KindSchema.optional(),
        focusId: z.string().uuid().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }): Promise<KnowledgeGraph> => {
    const { supabase } = context;
    try {
      const focus = await resolveFocus(supabase, data.focusKind, data.focusId);
      if (!focus) return emptyGraph();
      const focusKey = nodeKey(focus.kind, focus.id);
      const cols = await resolveLineageCols(supabase);
      const { edges, nodes } = await fetchSubgraph(supabase, focus, DEFAULT_BOUNDS, cols);
      const titleMap = await hydrateTitles(supabase, nodes);
      return projectGraph(edges, titleMap, focusKey, DEFAULT_BOUNDS);
    } catch {
      return emptyGraph();
    }
  });
