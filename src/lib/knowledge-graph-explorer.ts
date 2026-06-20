import { type ArtifactKind } from "./lineage.functions";

export type LineageNode = {
  id: string;
  kind: ArtifactKind;
  title: string | null;
  rationale: string | null;
  relation: string;
  children: LineageNode[];
  depth: number;
};

type LineageEdgeRaw = {
  parent_kind: ArtifactKind;
  parent_id: string;
  child_kind: ArtifactKind;
  child_id: string;
  relation: string;
  rationale: string | null;
  created_at: string;
};

/**
 * Build a tree from lineage edges, depth-first from a root node.
 * Respects a maximum depth to prevent deep trees and infinite loops.
 *
 * @param edges All artifact_lineage edges for the user
 * @param kind The artifact kind of the root node
 * @param id The artifact ID of the root node
 * @param depth Current depth (starts at 0 for root)
 * @param maxDepth Maximum depth to traverse (default 8)
 * @param visited Set of already-visited nodes (for cycle prevention)
 * @returns A LineageNode tree rooted at the given node
 */
export function buildLineageTree(
  edges: LineageEdgeRaw[],
  kind: ArtifactKind,
  id: string,
  depth: number,
  maxDepth: number = 8,
  visited: Set<string> = new Set(),
): LineageNode {
  const nodeKey = `${kind}:${id}`;
  const isRoot = depth === 0;

  // If not the root and we've seen this node, don't recurse (cycle prevention)
  if (!isRoot && visited.has(nodeKey)) {
    return {
      id,
      kind,
      title: null,
      rationale: null,
      relation: "cycle",
      children: [],
      depth,
    };
  }

  if (!isRoot) {
    visited.add(nodeKey);
  }

  // Find all children of this node
  const childEdges = edges.filter((e) => e.parent_kind === kind && e.parent_id === id);

  // Build child nodes, unless we've hit max depth
  const children: LineageNode[] = [];
  if (depth < maxDepth) {
    for (const edge of childEdges) {
      const child = buildLineageTree(
        edges,
        edge.child_kind,
        edge.child_id,
        depth + 1,
        maxDepth,
        visited,
      );
      // Attach edge metadata to the child
      child.rationale = edge.rationale;
      child.relation = edge.relation;
      children.push(child);
    }
  }

  return {
    id,
    kind,
    title: null, // Will be hydrated separately
    rationale: null,
    relation: isRoot ? "root" : "child",
    children,
    depth,
  };
}

/**
 * Hydrate titles into a tree by batch-querying all artifact tables.
 * This walks the tree and collects all (kind, id) pairs, then fetches titles
 * in parallel batches by kind to avoid N+1 queries.
 */
export async function hydrateTreeTitles(
  tree: LineageNode,
  fetcher: (kind: ArtifactKind, ids: string[]) => Promise<Map<string, string | null>>,
): Promise<void> {
  // Collect all nodes by kind
  const nodesByKind = new Map<ArtifactKind, { node: LineageNode; id: string }[]>();

  function collect(node: LineageNode) {
    if (!nodesByKind.has(node.kind)) {
      nodesByKind.set(node.kind, []);
    }
    nodesByKind.get(node.kind)!.push({ node, id: node.id });

    for (const child of node.children) {
      collect(child);
    }
  }

  collect(tree);

  // Fetch titles for each kind in parallel
  const titlesByKey = new Map<string, string | null>();
  await Promise.all(
    [...nodesByKind.entries()].map(async ([kind, nodes]) => {
      const ids = nodes.map((n) => n.id);
      const titles = await fetcher(kind, ids);
      for (const [id, title] of titles.entries()) {
        titlesByKey.set(`${kind}:${id}`, title);
      }
    }),
  );

  // Apply titles back to the tree
  function apply(node: LineageNode) {
    node.title = titlesByKey.get(`${node.kind}:${node.id}`) ?? null;
    for (const child of node.children) {
      apply(child);
    }
  }

  apply(tree);
}
