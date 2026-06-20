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

export type RoadmapBucket = "now" | "next" | "later";

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
  .handler(async ({ context }): Promise<{ items: RoadmapItem[] }> => {
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
    return { items };
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
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Opportunity not found");
    return { ok: true };
  });
