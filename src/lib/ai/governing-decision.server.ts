/**
 * Governing-decision retrieval - server IO (Decision Brain, DBR-3).
 *
 * The pure traversal lives in `governing-decision.ts`; this module supplies its EDGES. A
 * governing walk is only correct if it is fed the structural `supersedes` CHAIN, not a
 * similarity-bounded subset - so a bounded forward-closure assembles the chain, plus the
 * `contradicts` edges that flag a precedent invalidated with no replacement. Reusable by
 * any decision surface (the Critic, the proactive precedent nudge) so the moat is "one
 * graph in, every surface out". Fail-safe by construction: every query is try/caught to
 * [], and an empty graph yields no governing items (the caller's correction is absent).
 *
 * .server.ts - Worker-only; never bundled to the client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveLineageCols } from "@/lib/knowledge-graph-view.functions";
import type { RawLineageEdge } from "@/lib/knowledge-graph-view";
import {
  nextSupersessionFrontier,
  selectGoverningDecisions,
  type GoverningDecisionItem,
} from "@/lib/ai/governing-decision";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bound on closure expansion rounds: real supersession chains are 1-3 hops, so 8 rounds
 * is generous while capping a pathological/cyclic graph. Each round is one indexed query. */
const CLOSURE_MAX_ROUNDS = 8;
/** Per-query chunk size: a wide frontier is queried in batches of this size (never sliced
 * and silently truncated), so every frontier node's chain is followed. */
const CLOSURE_MAX_FRONTIER = 50;
/** Hard cap on total visited nodes, so a pathological wide/cyclic graph cannot run away. */
const CLOSURE_MAX_NODES = 500;

/**
 * Assemble the `supersedes` CHAIN reachable from the seed nodes (BFS child_id -> parent_id)
 * so the governing walk reaches the true terminal current node, not a focus-incident
 * intermediate. A similarity-bounded fetch only returns edges touching the seeds, so the
 * structural chain (intermediate nodes that are never similarity matches) must be assembled
 * by following the relation outward. Bounded (rounds + frontier + a `seen` set) so a
 * cycle/fan-out can never run away. Migration-tolerant (resolveLineageCols) + fail-safe.
 */
export async function loadSupersedesClosure(
  supabase: SupabaseClient,
  userId: string,
  seedIds: string[],
): Promise<RawLineageEdge[]> {
  let frontier = Array.from(new Set(seedIds.filter((id) => UUID_RE.test(id))));
  if (!frontier.length) return [];
  try {
    const cols = await resolveLineageCols(supabase);
    const byId = new Map<string, RawLineageEdge>();
    const seen = new Set<string>(frontier);
    for (let round = 0; round < CLOSURE_MAX_ROUNDS && frontier.length; round++) {
      // Query the WHOLE frontier in bounded chunks (never a single `.slice`, which would
      // silently drop nodes 51+ and miss their chains). One bad chunk skips, never aborts.
      const batch: RawLineageEdge[] = [];
      for (let i = 0; i < frontier.length; i += CLOSURE_MAX_FRONTIER) {
        const chunk = frontier.slice(i, i + CLOSURE_MAX_FRONTIER);
        const { data, error } = await supabase
          .from("artifact_lineage")
          .select(cols)
          .eq("user_id", userId)
          .eq("relation", "supersedes")
          .in("child_id", chunk)
          .limit(200);
        if (error || !data) continue;
        for (const e of data as unknown as RawLineageEdge[]) {
          if (e && typeof e.id === "string") {
            byId.set(e.id, e);
            batch.push(e);
          }
        }
      }
      if (seen.size >= CLOSURE_MAX_NODES) break; // defensive cap on a pathological graph
      frontier = nextSupersessionFrontier(batch, seen)
        .filter((id) => UUID_RE.test(id))
        .slice(0, CLOSURE_MAX_NODES);
      for (const id of frontier) seen.add(id);
    }
    return Array.from(byId.values());
  } catch {
    return [];
  }
}

/**
 * Load the CONTRADICTS edges that target any seed node (a later outcome invalidated a
 * precedent with no replacement decision). One bounded query; fail-safe.
 */
async function loadContradictsForNodes(
  supabase: SupabaseClient,
  userId: string,
  nodeIds: string[],
): Promise<RawLineageEdge[]> {
  const ids = Array.from(new Set(nodeIds.filter((id) => UUID_RE.test(id))));
  if (!ids.length) return [];
  try {
    const cols = await resolveLineageCols(supabase);
    const { data, error } = await supabase
      .from("artifact_lineage")
      .select(cols)
      .eq("user_id", userId)
      .eq("relation", "contradicts")
      .in("child_id", ids)
      .limit(100);
    if (error || !data) return [];
    return data as unknown as RawLineageEdge[];
  } catch {
    return [];
  }
}

/**
 * Resolve a set of decision nodes to their GOVERNING decisions: assemble the supersedes
 * chain (closure) + the contradicts edges on the seeds, optionally union with edges the
 * caller already loaded (the Critic reuses its DBR-2 focus edges to avoid re-querying),
 * then run the pure selector. Returns only the STALE nodes (superseded or contradicted).
 * Self-contained + fail-safe: any failure yields [].
 */
export async function resolveGoverningForNodes(
  supabase: SupabaseClient,
  userId: string,
  nodes: { kind: string; id: string }[],
  opts: { extraEdges?: readonly RawLineageEdge[] } = {},
): Promise<GoverningDecisionItem[]> {
  if (!nodes.length) return [];
  const ids = nodes.map((n) => n.id);
  try {
    // The caller's extraEdges (the Critic's DBR-2 focus edges) already include the
    // contradicts edges on these seeds, so only query contradicts when none were passed
    // (the getDecisionPrecedent nudge path), avoiding a redundant round-trip in the Critic.
    const [closure, contradicts] = await Promise.all([
      loadSupersedesClosure(supabase, userId, ids),
      opts.extraEdges
        ? Promise.resolve([] as RawLineageEdge[])
        : loadContradictsForNodes(supabase, userId, ids),
    ]);
    const byId = new Map<string, RawLineageEdge>();
    for (const e of opts.extraEdges ?? []) if (e && typeof e.id === "string") byId.set(e.id, e);
    for (const e of closure) if (e && typeof e.id === "string") byId.set(e.id, e);
    for (const e of contradicts) if (e && typeof e.id === "string") byId.set(e.id, e);
    return selectGoverningDecisions(Array.from(byId.values()), nodes);
  } catch {
    return [];
  }
}
