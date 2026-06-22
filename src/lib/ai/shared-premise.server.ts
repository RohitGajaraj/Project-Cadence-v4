/**
 * DBR multi-hop: Shared-premise precedent - server IO (Decision Brain).
 *
 * The pure two-directional walk lives in `shared-premise.ts`; this module supplies its
 * EDGES and the cousins' OUTCOMES. A correct shared-premise walk needs the structural
 * derivation graph around the target - the premise ANCESTORS (walk up) and their other
 * DESCENDANTS (walk down) - so two bounded BFS closures assemble it from `artifact_lineage`,
 * then the cousins that are PRDs are joined to their recorded outcome on `prds.outcome`.
 * Reusable by any decision surface (the Critic today; the proactive nudge later) so the
 * moat stays "one graph in, every surface out".
 *
 * Fail-safe by construction: every query is try/caught to [] and the orchestrator to "",
 * so a missing table/column, an RLS denial, or an empty graph yields no block - the caller
 * stays byte-identical until the data exists. `.server.ts` - Worker-only, never bundled.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawLineageEdge } from "@/lib/knowledge-graph-view";
import {
  collectPremiseAncestors,
  collectSharedPremiseCousins,
  selectSharedPremisePrecedents,
  formatSharedPremisePrecedent,
  canonicalizeEdges,
  type SharedPremiseOutcome,
  type SharedPremiseVerdict,
  type SharedPremisePrecedentItem,
} from "@/lib/ai/shared-premise";
import { canonicalNodeId, type DecisionNode } from "@/lib/ai/entity-resolution";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The original (always-present) lineage columns this walk reads - never `valid_to`, so
 * the loader is migration-independent (no probe needed: these columns predate DBR-1.5). */
const LINEAGE_BASE_COLS = "id,parent_kind,parent_id,child_kind,child_id,relation,created_at";

/** Derivation relations queried for the structural walk (mirrors the pure module's set).
 * `supersedes`/`contradicts` are excluded - those are outcome reversals, not premises. */
const DERIVATION_RELATIONS = ["promoted", "cites", "derived-from", "depends-on"];

/** Closure bounds: real derivation chains are 2-4 deep, so 6 rounds is generous while
 * capping a pathological graph. Each round is one (chunked) indexed query. */
const CLOSURE_MAX_ROUNDS = 6;
/** Per-query chunk size: a wide frontier is queried in batches (never sliced + silently
 * truncated), so every frontier node's chain is followed. */
const CLOSURE_MAX_FRONTIER = 50;
/** Hard cap on visited nodes per direction, so a wide/cyclic graph cannot run away. */
const CLOSURE_MAX_NODES = 500;

/** Run one BFS closure over derivation edges in a single direction. `pivot` is the column
 * matched against the frontier ("child_id" walks UP to parents; "parent_id" walks DOWN to
 * children); `step` reads the id we move to next. Bounded (rounds + chunk + a `seen` set);
 * every query is fail-safe so one bad chunk skips rather than aborting. */
async function closure(
  supabase: SupabaseClient,
  userId: string,
  seedIds: string[],
  pivot: "child_id" | "parent_id",
  step: "parent_id" | "child_id",
): Promise<RawLineageEdge[]> {
  let frontier = Array.from(new Set(seedIds.filter((id) => UUID_RE.test(id))));
  if (!frontier.length) return [];
  const byId = new Map<string, RawLineageEdge>();
  const seen = new Set<string>(frontier);
  try {
    for (let round = 0; round < CLOSURE_MAX_ROUNDS && frontier.length; round++) {
      const found: string[] = [];
      for (let i = 0; i < frontier.length; i += CLOSURE_MAX_FRONTIER) {
        const chunk = frontier.slice(i, i + CLOSURE_MAX_FRONTIER);
        const { data, error } = await supabase
          .from("artifact_lineage")
          .select(LINEAGE_BASE_COLS)
          .eq("user_id", userId)
          .in("relation", DERIVATION_RELATIONS)
          .in(pivot, chunk)
          .limit(400);
        if (error || !data) continue;
        for (const e of data as unknown as RawLineageEdge[]) {
          if (!e || typeof e.id !== "string") continue;
          byId.set(e.id, e);
          const nextId = e[step];
          if (typeof nextId === "string" && nextId && !seen.has(nextId) && UUID_RE.test(nextId)) {
            found.push(nextId);
          }
        }
      }
      if (seen.size >= CLOSURE_MAX_NODES) break;
      const fresh = Array.from(new Set(found)).filter((id) => !seen.has(id));
      for (const id of fresh) seen.add(id);
      frontier = fresh.slice(0, CLOSURE_MAX_NODES);
    }
    return Array.from(byId.values());
  } catch {
    return Array.from(byId.values());
  }
}

/**
 * Load the recorded outcomes for a set of PRD ids: `prds.outcome` is a JSONB
 * `{ verdict, summary, checked_at }` written by recordOutcome. RLS scopes the read to the
 * caller's rows (and the ids already came from the user's own lineage). One bounded query;
 * fail-safe to an empty map. Only rows with a real verdict become entries.
 */
async function loadOutcomes(
  supabase: SupabaseClient,
  prdIds: string[],
): Promise<Map<string, SharedPremiseOutcome>> {
  const out = new Map<string, SharedPremiseOutcome>();
  const ids = Array.from(new Set(prdIds.filter((id) => UUID_RE.test(id)))).slice(0, 200);
  if (!ids.length) return out;
  try {
    const { data, error } = await supabase
      .from("prds")
      .select("id,title,outcome")
      .in("id", ids)
      .limit(200);
    if (error || !data) return out;
    for (const row of data as Array<{
      id: string;
      title: string | null;
      outcome: { verdict?: string; summary?: string | null; checked_at?: string | null } | null;
    }>) {
      const v = row?.outcome?.verdict;
      if (v !== "validated" && v !== "missed" && v !== "mixed") continue;
      out.set(row.id, {
        verdict: v as SharedPremiseVerdict,
        summary: row.outcome?.summary ?? null,
        title: row.title ?? null,
        checkedAt: row.outcome?.checked_at ?? null,
      });
    }
    return out;
  } catch {
    return out;
  }
}

/** Tables backing each premise node kind, for resolving a premise's human title. Mirrors the
 * lineage TABLE map; a premise is usually a signal/theme/opportunity but any kind resolves. */
const PREMISE_TABLE: Record<string, string> = {
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
 * Resolve the human TITLE of each precedent's SHARED premise so a surface can name it ("the
 * opportunity 'Mobile checkout'") instead of an opaque id. Premise ids are grouped by kind and
 * looked up in the backing table (RLS-scoped via the authed client). Best-effort + fail-safe:
 * the items are returned title-less on any error, and the formatter falls back to the generic
 * "the same upstream premise" phrasing.
 */
async function attachPremiseTitles(
  supabase: SupabaseClient,
  userId: string,
  items: SharedPremisePrecedentItem[],
): Promise<SharedPremisePrecedentItem[]> {
  const byKind = new Map<string, Set<string>>();
  for (const it of items) {
    if (!it.premiseKind || !it.premiseId || !UUID_RE.test(it.premiseId)) continue;
    if (!PREMISE_TABLE[it.premiseKind]) continue;
    const set = byKind.get(it.premiseKind) ?? new Set<string>();
    set.add(it.premiseId);
    byKind.set(it.premiseKind, set);
  }
  if (!byKind.size) return items;
  const titles = new Map<string, string>(); // `${kind}:${id}` -> title
  try {
    const queries: PromiseLike<void>[] = [];
    for (const [kind, idSet] of byKind) {
      queries.push(
        supabase
          .from(PREMISE_TABLE[kind])
          .select("id,title")
          .eq("user_id", userId)
          .in("id", Array.from(idSet))
          .then(({ data }) => {
            for (const r of (data ?? []) as Array<{ id: string; title: string | null }>) {
              if (r?.id && typeof r.title === "string" && r.title.trim()) {
                titles.set(`${kind}:${r.id}`, r.title);
              }
            }
          }),
      );
    }
    await Promise.all(queries);
  } catch {
    return items;
  }
  if (!titles.size) return items;
  return items.map((it) => {
    const t = it.premiseId ? titles.get(`${it.premiseKind}:${it.premiseId}`) : undefined;
    return t ? { ...it, premiseTitle: t } : it;
  });
}

/**
 * Capability flag (DBR entity-resolution wiring, guardrail #4). Default OFF: collapsing
 * surface-variant / aliased nodes onto one canonical id in the premise walk is OPT-IN, so
 * the walk stays byte-identical until the founder enables it after a PRECISION REVIEW ON
 * REAL DATA. When off, no titles are loaded and no canonicalization runs.
 *
 * What the precision review must measure before enabling: v1 collapses on a normalized
 * TITLE match (no alias column exists yet), so two genuinely-different initiatives that
 * normalize to the same key (e.g. two unrelated "Checkout redesign" opportunities) would
 * be merged into one premise and manufacture a FALSE shared-premise cousin = false
 * precedent. That false-merge rate is the gate. (Cross-kind merges are already prevented
 * below - collapse is resolved per kind - so a node never merges with its own derived
 * artifact.)
 */
export function entityAliasingEnabled(): boolean {
  const v = process.env.DBR_ENTITY_ALIASING;
  return v === "1" || v === "true";
}

/** Bound each PostgREST `.in()` to keep its URL short (repo convention; an over-long IN
 * 414s and would, fail-safe, silently disable collapsing on exactly the large graphs it
 * is meant for). Mirrors the `IN_BATCH` cap used by the knowledge-graph title loaders. */
const TITLE_IN_BATCH = 25;

/**
 * Build a node-id -> canonical-representative-id map for the nodes in the assembled edges,
 * so the walk can treat surface-variant / aliased nodes as one. Loads each node's TITLE
 * from its backing table (RLS-scoped via the authed client, queried in bounded chunks),
 * then runs the pure entity resolver PER KIND - so collapse never crosses kinds (an
 * opportunity is never merged onto its own same-titled PRD, which is a derivation pair, not
 * an alias). The map carries ONLY actually-collapsed ids (id != rep); an unmapped id is
 * identity at the call site. Best-effort + fail-safe: any failure (or no titles) yields an
 * empty map = no collapsing = a byte-identical walk.
 */
async function buildPremiseCanonicalId(
  supabase: SupabaseClient,
  userId: string,
  edges: readonly RawLineageEdge[],
): Promise<Map<string, string>> {
  const kindOf = new Map<string, string>();
  for (const e of edges) {
    if (e.parent_id && UUID_RE.test(e.parent_id)) kindOf.set(e.parent_id, e.parent_kind);
    if (e.child_id && UUID_RE.test(e.child_id)) kindOf.set(e.child_id, e.child_kind);
  }
  if (!kindOf.size) return new Map();
  const byKind = new Map<string, string[]>();
  for (const [id, kind] of kindOf) {
    if (!PREMISE_TABLE[kind]) continue;
    const arr = byKind.get(kind) ?? [];
    arr.push(id);
    byKind.set(kind, arr);
  }
  if (!byKind.size) return new Map();
  const titleById = new Map<string, string>();
  try {
    const queries: PromiseLike<void>[] = [];
    for (const [kind, ids] of byKind) {
      for (let i = 0; i < ids.length; i += TITLE_IN_BATCH) {
        const batch = ids.slice(i, i + TITLE_IN_BATCH);
        queries.push(
          supabase
            .from(PREMISE_TABLE[kind])
            .select("id,title")
            .eq("user_id", userId)
            .in("id", batch)
            .then(({ data }) => {
              for (const r of (data ?? []) as Array<{ id: string; title: string | null }>) {
                if (r?.id && typeof r.title === "string" && r.title.trim()) {
                  titleById.set(r.id, r.title);
                }
              }
            }),
        );
      }
    }
    await Promise.all(queries);
  } catch {
    return new Map();
  }
  if (!titleById.size) return new Map();
  // Resolve PER KIND, so an id never collapses onto a node of a different kind.
  const canonical = new Map<string, string>();
  for (const [kind, ids] of byKind) {
    const nodes: DecisionNode[] = [];
    for (const id of ids) {
      const title = titleById.get(id);
      if (title) nodes.push({ id, kind, title });
    }
    if (nodes.length < 2) continue; // a lone node cannot collapse
    for (const [id, rep] of canonicalNodeId(nodes)) {
      if (id !== rep) canonical.set(id, rep); // keep only real collapses
    }
  }
  return canonical;
}

/**
 * Resolve the SHARED-PREMISE precedents for a decision as STRUCTURED items: assemble the
 * premise ancestors (up-closure) and their descendants (down-closure), derive the cousins
 * with the pure walk, join the PRD cousins to their recorded outcomes, and rank. The one
 * resolver behind both surfaces - the Critic (which formats it to a prompt block) and the
 * proactive nudge (which renders the items) - so the moat stays "one graph in, every surface
 * out". Self-contained + fail-safe: any failure (or no data) yields [].
 */
export async function resolveSharedPremiseItems(
  supabase: SupabaseClient,
  userId: string,
  target: { kind: string; id: string },
  opts: { max?: number } = {},
): Promise<SharedPremisePrecedentItem[]> {
  if (!target || typeof target.id !== "string" || !UUID_RE.test(target.id)) return [];
  try {
    const ancestorEdges = await closure(supabase, userId, [target.id], "child_id", "parent_id");
    const ancestors = collectPremiseAncestors(target.id, ancestorEdges);
    if (!ancestors.length) return [];
    const descendantEdges = await closure(supabase, userId, ancestors, "parent_id", "child_id");
    const edges = [...ancestorEdges, ...descendantEdges];

    // DBR entity-resolution wiring (guardrail #4), flag-gated OFF by default: collapse nodes
    // that name the SAME initiative under different titles onto one canonical id, so the walk
    // connects cousins across fragments the derivation graph alone would miss. Byte-identical
    // when off (we skip it entirely) or when nothing collapses (the map leaves ids unchanged).
    let walkTarget = target;
    let walkAncestors = ancestors;
    let walkEdges = edges;
    if (entityAliasingEnabled()) {
      const canonical = await buildPremiseCanonicalId(supabase, userId, edges);
      if (canonical.size) {
        const cid = (id: string) => canonical.get(id) ?? id;
        walkEdges = canonicalizeEdges(edges, cid);
        walkTarget = { kind: target.kind, id: cid(target.id) };
        walkAncestors = Array.from(new Set(ancestors.map(cid)));
      }
    }

    const cousins = collectSharedPremiseCousins(walkTarget, walkAncestors, walkEdges);
    const prdIds = cousins.filter((c) => c.kind === "prd").map((c) => c.id);
    if (!prdIds.length) return [];
    const outcomes = await loadOutcomes(supabase, prdIds);
    if (!outcomes.size) return [];
    const items = selectSharedPremisePrecedents(cousins, outcomes, { max: opts.max });
    return await attachPremiseTitles(supabase, userId, items);
  } catch {
    return [];
  }
}

/**
 * Render the shared-premise precedents as the Critic's prompt block. Thin wrapper over the
 * structured resolver above; "" when there is nothing to report, so the Critic prompt stays
 * byte-identical until the decision graph carries derivation edges + recorded outcomes.
 */
export async function resolveSharedPremisePrecedent(
  supabase: SupabaseClient,
  userId: string,
  target: { kind: string; id: string },
  opts: { max?: number } = {},
): Promise<string> {
  return formatSharedPremisePrecedent(
    await resolveSharedPremiseItems(supabase, userId, target, opts),
  );
}
