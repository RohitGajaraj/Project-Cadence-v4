import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ARTIFACT_KINDS, type ArtifactKind } from "./lineage.functions";
import { buildLineageTree, hydrateTreeTitles, type LineageNode } from "./knowledge-graph-explorer";
import { resolveLineageCols } from "./knowledge-graph-view.functions";

const KindSchema = z.enum(ARTIFACT_KINDS);

const TITLE_COLUMN: Record<ArtifactKind, string> = {
  signal: "title",
  theme: "title",
  opportunity: "title",
  prd: "title",
  roadmap_item: "title",
  task: "title",
  meeting: "title",
  decision: "title",
  mission: "title",
};

const TABLE: Record<ArtifactKind, string> = {
  signal: "signals",
  theme: "themes",
  opportunity: "opportunities",
  prd: "prds",
  roadmap_item: "roadmap_items",
  task: "tasks",
  meeting: "meetings",
  decision: "decisions",
  mission: "missions",
};

/**
 * Fetch the lineage tree rooted at a given artifact.
 * Returns the tree with titles hydrated from the source tables.
 */
export const getLineageTree = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ kind: KindSchema, id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    // Fetch all edges for this workspace/user
    // The artifact_lineage table is RLS-scoped to user_id.
    // #3: read the bi-temporal `valid_to` when the DBR-1.5 column is live (via the
    // shared migration-tolerant resolver, the same one the canvas read uses) so the
    // tree can fade a reversed-and-retired supersession; pre-migration it falls back
    // to the base columns and every node reads as current.
    const cols = await resolveLineageCols(supabase);
    const { data: edgesRaw, error: edgesErr } = await supabase
      .from("artifact_lineage")
      .select(cols);

    if (edgesErr || !edgesRaw) {
      throw new Error(`Failed to fetch lineage edges: ${edgesErr?.message}`);
    }

    // Build the tree
    const tree = buildLineageTree(
      edgesRaw as unknown as Array<{
        parent_kind: ArtifactKind;
        parent_id: string;
        child_kind: ArtifactKind;
        child_id: string;
        relation: string;
        rationale: string | null;
        created_at: string;
        valid_to?: string | null;
      }>,
      data.kind,
      data.id,
      0,
    );

    // Hydrate titles by batch-querying target tables
    await hydrateTreeTitles(tree, async (kind, ids) => {
      const table = TABLE[kind];
      const col = TITLE_COLUMN[kind];

      if (!table || !col) {
        return new Map();
      }

      const { data: rows } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => { in: (c: string, v: string[]) => Promise<{ data: unknown }> };
          };
        }
      )
        .from(table)
        .select(`id, ${col}`)
        .in("id", ids);

      const titleMap = new Map<string, string | null>();
      for (const row of (rows as Array<Record<string, unknown>> | null) ?? []) {
        const id = row.id as string | undefined;
        const title = row[col];
        if (id) {
          titleMap.set(id, typeof title === "string" ? title : null);
        }
      }

      return titleMap;
    });

    return tree;
  });

/**
 * Compute basic graph statistics: node counts, depth, branching factor.
 */
export function computeTreeStats(tree: LineageNode): {
  nodeCount: number;
  maxDepth: number;
  branchingFactor: number;
} {
  let nodeCount = 0;
  let maxDepth = 0;
  let totalChildren = 0;
  let nodesWithChildren = 0;

  function walk(node: LineageNode) {
    nodeCount++;
    maxDepth = Math.max(maxDepth, node.depth);

    if (node.children.length > 0) {
      nodesWithChildren++;
      totalChildren += node.children.length;
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(tree);

  return {
    nodeCount,
    maxDepth,
    branchingFactor: nodesWithChildren > 0 ? totalChildren / nodesWithChildren : 0,
  };
}
