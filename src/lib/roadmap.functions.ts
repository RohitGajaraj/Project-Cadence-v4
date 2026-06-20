/**
 * H2 · Outcome roadmap (Now/Next/Later).
 *
 * The commitment layer over the agent-ranked opportunities: the human commits an
 * opportunity to a Now/Next/Later bucket with a declared outcome + measure, and
 * the agent's ICE ranking orders within each bucket (continuous re-ranking, per
 * the v6 positioning — this is outcome curation, not a manual task kanban).
 *
 * Read is `select("*")` so it is pre-migration tolerant: until the next sync
 * applies the roadmap columns, every opportunity reads as unplaced (bucket null)
 * and the board shows them all in the backlog; writes wait on the migration.
 * RLS-scoped via the existing "own opportunities all" policy.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  validateCommitment,
  governanceGapCount,
  ROADMAP_TEXT_MAX,
  type RoadmapBucket,
} from "@/lib/roadmap-governance";
import {
  buildAuditInsert,
  type RoadmapAuditAction,
  type RoadmapAuditRow,
} from "@/lib/roadmap-audit";

export type { RoadmapBucket };

/**
 * H2-AUDIT: record a roadmap decision, best-effort. Never throws into the caller
 * (a failed audit must not fail the roadmap write); the insert runs under the
 * user's RLS context, and `user_id` defaults to auth.uid() at the DB so the actor
 * cannot be spoofed. `workspace_id` is read back from the just-updated row.
 */
async function recordRoadmapDecision(
  supabase: { from: (t: string) => { insert: (rows: unknown) => Promise<{ error: unknown }> } },
  input: {
    opportunityId: string;
    workspaceId: string | null;
    action: RoadmapAuditAction;
    toBucket: RoadmapBucket | null;
    outcome?: string | null;
    measure?: string | null;
  },
): Promise<void> {
  try {
    await supabase.from("roadmap_audit").insert(buildAuditInsert(input));
  } catch {
    // best-effort: the audit is supplementary; never break the write it describes.
  }
}

export type RoadmapItem = {
  id: string;
  title: string;
  ice_score: number | null;
  bucket: RoadmapBucket | null;
  outcome: string | null;
  measure: string | null;
};

export const getRoadmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: RoadmapItem[]; governanceGaps: number }> => {
    // KI-32: exclude terminal-lifecycle opportunities from the board. The
    // opportunities.status column ('backlog'|'now'|'next'|'later'|'shipped'|
    // 'dropped', NOT NULL default 'backlog') carries the lifecycle state that
    // discovery's updateOpportunity writes; without this filter, shipped and
    // dropped items permanently reappear on the Now/Next/Later board.
    const { data, error } = await context.supabase
      .from("opportunities")
      .select("*")
      .not("status", "in", "(shipped,dropped)")
      .order("ice_score", { ascending: false });
    if (error) throw new Error(error.message);
    const items: RoadmapItem[] = (data ?? []).map((o) => {
      const r = o as {
        id: string;
        title: string;
        ice_score?: number | string | null;
        roadmap_bucket?: string | null;
        roadmap_outcome?: string | null;
        roadmap_measure?: string | null;
      };
      const bucket =
        r.roadmap_bucket === "now" || r.roadmap_bucket === "next" || r.roadmap_bucket === "later"
          ? r.roadmap_bucket
          : null;
      return {
        id: r.id,
        title: r.title,
        ice_score: r.ice_score != null ? Number(r.ice_score) : null,
        bucket,
        outcome: r.roadmap_outcome ?? null,
        measure: r.roadmap_measure ?? null,
      };
    });
    // H2-WRITES: surface how many commitments sit in a bucket without a declared
    // outcome + measure (ungoverned), so the board can nudge toward the H2 rule.
    return { items, governanceGaps: governanceGapCount(items) };
  });

export const updateRoadmapItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        bucket: z.enum(["now", "next", "later"]).nullable().optional(),
        outcome: z.string().max(500).nullable().optional(),
        measure: z.string().max(500).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const patch: Record<string, unknown> = {};
    if (data.bucket !== undefined) patch.roadmap_bucket = data.bucket;
    if (data.outcome !== undefined) patch.roadmap_outcome = data.outcome;
    if (data.measure !== undefined) patch.roadmap_measure = data.measure;
    if (Object.keys(patch).length === 0) return { ok: true };
    // RLS ("own opportunities all") scopes the write; the explicit user_id +
    // .select() makes a blocked or no-match update fail loudly instead of
    // returning a phantom ok:true (which would leave the optimistic UI lying).
    const { data: rows, error } = await context.supabase
      .from("opportunities")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id, workspace_id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Opportunity not found");
    // H2-AUDIT: a bucket change is a roadmap decision worth recording (a plain
    // outcome/measure edit without a bucket change is not a "move").
    if (data.bucket !== undefined) {
      await recordRoadmapDecision(context.supabase, {
        opportunityId: data.id,
        workspaceId: (rows[0] as { workspace_id?: string | null }).workspace_id ?? null,
        action: "move",
        toBucket: data.bucket ?? null,
      });
    }
    return { ok: true };
  });

/**
 * H2-WRITES · the GOVERNED commit path. Unlike the lenient `updateRoadmapItem`
 * (which the drag board uses to move freely), this writes bucket + outcome +
 * measure atomically and ENFORCES the H2 rule: a Now/Next/Later commitment must
 * carry a declared outcome AND measure (anti-feature-factory governance). The
 * board's "save outcome" action and the autonomous roadmap-commit both route
 * through here, so a commitment can never be saved half-declared. Backlog
 * (bucket null) is unconstrained.
 */
export const commitRoadmapItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        bucket: z.enum(["now", "next", "later"]).nullable(),
        outcome: z.string().max(ROADMAP_TEXT_MAX).nullable(),
        measure: z.string().max(ROADMAP_TEXT_MAX).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const check = validateCommitment(data);
    if (!check.ok) throw new Error(check.reason);
    // Normalize blanks to null so an "all whitespace" field is not stored as a
    // phantom declared outcome (and keeps the governance read honest).
    const norm = (s: string | null) => (s && s.trim().length > 0 ? s.trim() : null);
    const { data: rows, error } = await context.supabase
      .from("opportunities")
      .update({
        roadmap_bucket: data.bucket,
        roadmap_outcome: norm(data.outcome),
        roadmap_measure: norm(data.measure),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id, workspace_id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Opportunity not found");
    // H2-AUDIT: a governed commit records the declared outcome AT THIS TIME - the
    // point-in-time evidence behind "why is this on the roadmap".
    await recordRoadmapDecision(context.supabase, {
      opportunityId: data.id,
      workspaceId: (rows[0] as { workspace_id?: string | null }).workspace_id ?? null,
      action: "commit",
      toBucket: data.bucket,
      outcome: data.outcome,
      measure: data.measure,
    });
    return { ok: true };
  });

/**
 * H2-AUDIT · read an opportunity's roadmap-decision history (newest first), so the
 * board / a "why is this here" surface can show who committed it, when, and the
 * outcome promised at that time. RLS-scoped (own rows or a workspace you belong to).
 */
export const getRoadmapHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ opportunityId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<{ events: RoadmapAuditRow[] }> => {
    const { data: rows, error } = await context.supabase
      .from("roadmap_audit")
      .select(
        "id, opportunity_id, user_id, workspace_id, action, from_bucket, to_bucket, outcome, measure, created_at",
      )
      .eq("opportunity_id", data.opportunityId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { events: (rows ?? []) as RoadmapAuditRow[] };
  });
