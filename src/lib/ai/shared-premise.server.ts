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
  type SharedPremiseOutcome,
  type SharedPremiseVerdict,
  type SharedPremisePrecedentItem,
} from "@/lib/ai/shared-premise";

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
    const cousins = collectSharedPremiseCousins(target, ancestors, edges);
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
  return formatSharedPremisePrecedent(await resolveSharedPremiseItems(supabase, userId, target, opts));
}
