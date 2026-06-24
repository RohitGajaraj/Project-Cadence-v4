/**
 * TRUST-LEDGER (v11 pillar 3 — "the receipts as the hero surface").
 *
 * A first-class, demo-ready read model that renders, for every decision AND
 * every decided autonomous action, the five things a buyer pays trust for:
 *   1. WHAT changed        — the decision title / the tool action
 *   2. WHY                 — the rationale
 *   3. EVIDENCE            — provenance edges in `artifact_lineage`
 *   4. WHO approved + WHEN — agent slug + whether a human decided + the stamp
 *   5. PROVEN or SUPERSEDED — the bitemporal supersession state of the record
 *
 * It composes EXISTING data only (no schema change): `decisions`,
 * `agent_approvals`, and the bitemporal `artifact_lineage` graph. It renders
 * whatever exists today and gets richer once DEMO-SEED-RICH / LOOP-PROVE land
 * real outcome + supersession edges — the surface never needs to change for that.
 *
 * The pure assembly (`assembleReceipts`, `summarizeAction`, `supersededChildIds`)
 * is separated from the server fn so the merge/supersession logic is unit-tested
 * without a DB.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sealReceipts, verifyReceipts, SEAL_ALGO, type VerifyResult } from "@/lib/trust-verify";

export type TrustReceiptKind = "decision" | "action";
/** v1 outcome states. "proven" is reserved for when recorded-outcome links land (LOOP-PROVE). */
export type TrustReceiptOutcome = "standing" | "superseded";

export type TrustReceipt = {
  id: string;
  kind: TrustReceiptKind;
  /** WHAT changed. */
  title: string;
  /** WHY. */
  rationale: string | null;
  /** decision status (pending|approved|rejected) | approval status. */
  status: string;
  /** the agent slug that made/proposed the call, when known. */
  actor: string | null;
  /** true when a human pressed approve/reject (an `agent_approvals.decided_by`). */
  humanDecided: boolean;
  /** ISO timestamp the record was decided / created. */
  occurredAt: string;
  /** the originating artifact (mission / prd / meeting), label hydrated when available. */
  source: { kind: string | null; id: string | null; label: string | null };
  /** the tool a decided autonomous action invoked (action receipts only). */
  toolName: string | null;
  /** count of `artifact_lineage` edges touching this record's id or source id. */
  evidenceCount: number;
  /** bitemporal supersession state of this record. */
  outcome: TrustReceiptOutcome;
  /** the id of the record/artifact that superseded this one, when superseded. */
  supersededBy: string | null;
};

export type DecisionLite = {
  id: string;
  title: string;
  rationale: string | null;
  status: string;
  source_kind: string | null;
  meeting_id: string | null;
  mission_id: string | null;
  prd_id: string | null;
  decided_by_agent_slug: string | null;
  created_at: string;
};

export type ApprovalLite = {
  id: string;
  agent_slug: string | null;
  tool_name: string | null;
  args: Record<string, unknown> | null;
  rationale: string | null;
  decision_reason: string | null;
  status: string;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  mission_id: string | null;
};

export type LineageEdgeLite = {
  parent_kind: string | null;
  parent_id: string | null;
  child_kind: string | null;
  child_id: string | null;
  relation: string | null;
  valid_to?: string | null;
};

/** PURE. The two relations the supersession engine writes (mirrors knowledge-graph-view). */
export function isSupersessionRelation(raw: string | null | undefined): boolean {
  const r = (raw ?? "").trim().toLowerCase();
  return r === "supersedes" || r === "contradicts";
}

/**
 * PURE. An edge reads `parent --relation--> child`, so the CHILD of an ACTIVE
 * (`valid_to` null) supersedes/contradicts edge is the superseded node. A
 * supersession that was itself bitemporally retired (`valid_to` set) is a
 * reversal — it no longer counts. Returns childId -> the superseding parentId.
 */
export function supersededChildIds(
  edges: LineageEdgeLite[] | null | undefined,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of Array.isArray(edges) ? edges : []) {
    if (!e || !isSupersessionRelation(e.relation)) continue;
    const retired = typeof e.valid_to === "string" && e.valid_to.trim() !== "";
    if (retired) continue;
    if (typeof e.child_id === "string" && e.child_id) {
      out.set(e.child_id, typeof e.parent_id === "string" ? e.parent_id : "");
    }
  }
  return out;
}

/** PURE. Count edges that reference an id on either end (provenance richness). */
export function evidenceCounts(edges: LineageEdgeLite[] | null | undefined): Map<string, number> {
  const out = new Map<string, number>();
  const bump = (id: string | null | undefined) => {
    if (typeof id === "string" && id) out.set(id, (out.get(id) ?? 0) + 1);
  };
  for (const e of Array.isArray(edges) ? edges : []) {
    if (!e) continue;
    bump(e.parent_id);
    bump(e.child_id);
  }
  return out;
}

/** PURE. Humanize a decided autonomous action into a "what changed" line. */
export function summarizeAction(
  toolName: string | null,
  args: Record<string, unknown> | null,
): string {
  const tool = (toolName ?? "").trim();
  const a = args ?? {};
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = a[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };
  const subjectRaw = pick("title", "name", "summary", "query", "message", "goal");
  // args is attacker-influencable jsonb — render-escaped by JSX, but cap length so a
  // bloated/misleading value can't dominate the card (review hardening).
  const subject =
    subjectRaw && subjectRaw.length > 140 ? `${subjectRaw.slice(0, 140)}…` : subjectRaw;
  const pretty = tool
    ? tool.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Autonomous action";
  return subject ? `${pretty}: ${subject}` : pretty;
}

/** PURE. Merge decisions + decided actions into one time-sorted receipt list. */
export function assembleReceipts(input: {
  decisions: DecisionLite[];
  approvals: ApprovalLite[];
  superseded: Map<string, string>;
  evidence: Map<string, number>;
  sourceLabels: Map<string, string>;
}): TrustReceipt[] {
  const { decisions, approvals, superseded, evidence, sourceLabels } = input;

  const supersededFor = (
    ...ids: (string | null)[]
  ): { o: TrustReceiptOutcome; by: string | null } => {
    for (const id of ids) {
      if (id && superseded.has(id)) return { o: "superseded", by: superseded.get(id) || null };
    }
    return { o: "standing", by: null };
  };
  const evidenceFor = (...ids: (string | null)[]): number =>
    ids.reduce((n, id) => n + (id ? (evidence.get(id) ?? 0) : 0), 0);

  const receipts: TrustReceipt[] = [];

  for (const d of Array.isArray(decisions) ? decisions : []) {
    const sourceId = d.mission_id ?? d.prd_id ?? d.meeting_id ?? null;
    const { o, by } = supersededFor(d.id, sourceId);
    receipts.push({
      id: d.id,
      kind: "decision",
      title: d.title,
      rationale: d.rationale,
      status: d.status,
      actor: d.decided_by_agent_slug,
      humanDecided: false,
      occurredAt: d.created_at,
      source: {
        kind: d.source_kind,
        id: sourceId,
        label: sourceId ? (sourceLabels.get(sourceId) ?? null) : null,
      },
      toolName: null,
      evidenceCount: evidenceFor(d.id, sourceId),
      outcome: o,
      supersededBy: by,
    });
  }

  for (const ap of Array.isArray(approvals) ? approvals : []) {
    const { o, by } = supersededFor(ap.id, ap.mission_id);
    receipts.push({
      id: ap.id,
      kind: "action",
      title: summarizeAction(ap.tool_name, ap.args),
      rationale: ap.rationale ?? ap.decision_reason ?? null,
      status: ap.status,
      actor: ap.agent_slug,
      humanDecided: !!ap.decided_by,
      occurredAt: ap.decided_at ?? ap.created_at,
      source: {
        kind: ap.mission_id ? "mission" : null,
        id: ap.mission_id,
        label: ap.mission_id ? (sourceLabels.get(ap.mission_id) ?? null) : null,
      },
      toolName: ap.tool_name,
      evidenceCount: evidenceFor(ap.id, ap.mission_id),
      outcome: o,
      supersededBy: by,
    });
  }

  receipts.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
  return receipts;
}

// ---- server fn ----

const ListSchema = z
  .object({
    workspaceId: z.string().uuid().optional(),
    kind: z.enum(["all", "decision", "action"]).default("all"),
    outcome: z.enum(["all", "standing", "superseded"]).default("all"),
    q: z.string().max(200).optional(),
    limit: z.number().int().min(1).max(200).default(100),
  })
  .partial();

/** A PostgREST "column does not exist" (42703) — the pre-migration signal for `valid_to`. */
function isMissingColumn(err: { message?: string } | null, col: string): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return m.includes("does not exist") && m.includes(col);
}

async function resolveWorkspaceId(
  supabase: SupabaseClient,
  given: string | null | undefined,
): Promise<string | null> {
  if (given) return given;
  const { data: ws } = await supabase.rpc("current_user_default_workspace");
  return (ws as string | null) ?? null;
}

/**
 * Load + assemble the full receipt list for a workspace (no q/outcome filter), the
 * shared substrate for both the ledger view and the tamper-evident seal. RLS-scoped
 * by the caller's supabase client; tolerant of a pre-bitemporal `artifact_lineage`.
 */
async function loadReceipts(
  supabase: SupabaseClient,
  workspaceId: string,
  opts: { limit: number; kind: "all" | "decision" | "action" },
): Promise<TrustReceipt[]> {
  const { limit, kind } = opts;
  const wantDecisions = kind === "all" || kind === "decision";
  const wantActions = kind === "all" || kind === "action";

  const [decisionsRes, approvalsRes] = await Promise.all([
    wantDecisions
      ? supabase
          .from("decisions")
          .select(
            "id,title,rationale,status,source_kind,meeting_id,mission_id,prd_id,decided_by_agent_slug,created_at",
          )
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as DecisionLite[], error: null }),
    wantActions
      ? supabase
          .from("agent_approvals")
          .select(
            "id,agent_slug,tool_name,args,rationale,decision_reason,status,decided_at,decided_by,created_at,mission_id",
          )
          .eq("workspace_id", workspaceId)
          .neq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as ApprovalLite[], error: null }),
  ]);
  if (decisionsRes.error) throw new Error(decisionsRes.error.message);
  if (approvalsRes.error) throw new Error(approvalsRes.error.message);

  const decisions = (decisionsRes.data ?? []) as DecisionLite[];
  const approvals = (approvalsRes.data ?? []) as ApprovalLite[];

  // Bitemporal lineage for supersession + evidence. Select `valid_to` but fall
  // back to the base columns if the bitemporal migration isn't live yet, so the
  // surface degrades to "standing for all" instead of erroring to empty.
  let edges: LineageEdgeLite[] = [];
  {
    const cols = "parent_kind,parent_id,child_kind,child_id,relation,valid_to";
    const base = "parent_kind,parent_id,child_kind,child_id,relation";
    const run = (sel: string) =>
      supabase.from("artifact_lineage").select(sel).eq("workspace_id", workspaceId).limit(2000);
    let res = await run(cols);
    if (res.error && isMissingColumn(res.error, "valid_to")) res = await run(base);
    if (res.error) throw new Error(res.error.message);
    edges = (res.data ?? []) as unknown as LineageEdgeLite[];
  }

  // Hydrate source labels (missions / prds / meetings) in one batch per kind.
  const missionIds = new Set<string>();
  const prdIds = new Set<string>();
  const meetingIds = new Set<string>();
  for (const d of decisions) {
    if (d.mission_id) missionIds.add(d.mission_id);
    if (d.prd_id) prdIds.add(d.prd_id);
    if (d.meeting_id) meetingIds.add(d.meeting_id);
  }
  for (const ap of approvals) if (ap.mission_id) missionIds.add(ap.mission_id);

  const [missions, prds, meetings] = await Promise.all([
    missionIds.size
      ? supabase
          .from("missions")
          .select("id,title")
          .in("id", [...missionIds])
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    prdIds.size
      ? supabase
          .from("prds")
          .select("id,title")
          .in("id", [...prdIds])
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    meetingIds.size
      ? supabase
          .from("meetings")
          .select("id,title")
          .in("id", [...meetingIds])
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const sourceLabels = new Map<string, string>();
  for (const r of [...(missions.data ?? []), ...(prds.data ?? []), ...(meetings.data ?? [])]) {
    if (r?.id && r?.title) sourceLabels.set(r.id as string, r.title as string);
  }

  return assembleReceipts({
    decisions,
    approvals,
    superseded: supersededChildIds(edges),
    evidence: evidenceCounts(edges),
    sourceLabels,
  });
}

export const listTrustReceipts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ListSchema.parse(i ?? {}))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as SupabaseClient;
    const workspaceId = await resolveWorkspaceId(supabase, data?.workspaceId);
    if (!workspaceId) {
      return { receipts: [] as TrustReceipt[], counts: { all: 0, standing: 0, superseded: 0 } };
    }

    const limit = data?.limit ?? 100;
    const kind = data?.kind ?? "all";

    let receipts = await loadReceipts(supabase, workspaceId, { limit, kind });

    // Search filter first — it bounds the "scope" the outcome tabs summarize.
    const q = data?.q?.trim().toLowerCase();
    if (q) {
      receipts = receipts.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.rationale ?? "").toLowerCase().includes(q) ||
          (r.actor ?? "").toLowerCase().includes(q),
      );
    }

    // Counts reflect the full kind+search scope BEFORE the outcome filter and the
    // limit, so the "standing · N / superseded · N" tab badges show true totals
    // regardless of which outcome tab is active (review fix: they were computed
    // post-filter+slice and lied when a filter was on).
    const counts = {
      all: receipts.length,
      standing: receipts.filter((r) => r.outcome === "standing").length,
      superseded: receipts.filter((r) => r.outcome === "superseded").length,
    };

    const outcome = data?.outcome ?? "all";
    if (outcome !== "all") receipts = receipts.filter((r) => r.outcome === outcome);
    if (receipts.length > limit) receipts = receipts.slice(0, limit);

    return { receipts, counts, workspace_id: workspaceId };
  });

// ---- TRUST-VERIFY (#26): an integrity check (SHA-256 fingerprint) over the ledger ----

/** Cap the seal scope; covers the full ledger for typical workspaces. */
const SEAL_LIMIT = 1000;

export type LedgerSeal = {
  available: boolean;
  algo: string;
  head: string;
  count: number;
  /** ISO time the seal was computed (the anchor moment to record). */
  sealedAt: string;
  workspace_id: string | null;
};

/**
 * Compute the integrity fingerprint (a SHA-256 hash, NOT a blockchain) over the
 * workspace's whole decision-and-outcome record. The returned head is the fingerprint
 * a user SAVES; re-checking later (verifyLedgerSeal) confirms the record is unchanged.
 * No key material — pure recomputation; available to every user. RLS is the boundary:
 * loadReceipts runs on the caller's RLS-scoped client, so the fingerprint only ever
 * covers records the caller may already read (a non-member of workspaceId gets the
 * empty/genesis fingerprint). An optional Ed25519 signature is a possible later add-on.
 */
export const getLedgerSeal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ workspaceId: z.string().uuid().optional() })
      .partial()
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }): Promise<LedgerSeal> => {
    const supabase = context.supabase as SupabaseClient;
    const workspaceId = await resolveWorkspaceId(supabase, data?.workspaceId);
    const sealedAt = new Date().toISOString();
    if (!workspaceId) {
      return {
        available: false,
        algo: SEAL_ALGO,
        head: "",
        count: 0,
        sealedAt,
        workspace_id: null,
      };
    }
    const receipts = await loadReceipts(supabase, workspaceId, { limit: SEAL_LIMIT, kind: "all" });
    const seal = await sealReceipts(receipts);
    return {
      available: true,
      algo: seal.algo,
      head: seal.head,
      count: seal.count,
      sealedAt,
      workspace_id: workspaceId,
    };
  });

export type LedgerVerification = VerifyResult & { available: boolean; sealedAt: string };

/**
 * Check the workspace's CURRENT record against a fingerprint the user saved earlier. A
 * match confirms the ledger is unchanged since then; a mismatch reports that it changed
 * (the count divergence is named when the saved count is given). Head-only by design —
 * pinpointing which record changed needs the full saved seal, which arrives with the
 * deferred write-time persistence. RLS-scoped exactly like getLedgerSeal.
 */
export const verifyLedgerSeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        // exactly a SHA-256 hex fingerprint (the format getLedgerSeal emits); rejects
        // anything structurally invalid before the handler + the in-memory compare.
        head: z.string().regex(/^[0-9a-f]{64}$/, "must be a SHA-256 hex fingerprint"),
        count: z.number().int().min(0).max(SEAL_LIMIT).optional(),
        workspaceId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }): Promise<LedgerVerification> => {
    const supabase = context.supabase as SupabaseClient;
    const sealedAt = new Date().toISOString();
    const workspaceId = await resolveWorkspaceId(supabase, data.workspaceId);
    if (!workspaceId) {
      return {
        available: false,
        ok: false,
        recomputedHead: "",
        expectedHead: data.head,
        count: 0,
        expectedCount: data.count ?? 0,
        brokenAt: null,
        reason: "no workspace",
        sealedAt,
      };
    }
    const receipts = await loadReceipts(supabase, workspaceId, { limit: SEAL_LIMIT, kind: "all" });
    const v = await verifyReceipts(receipts, { head: data.head, count: data.count });
    return { available: true, ...v, sealedAt };
  });
