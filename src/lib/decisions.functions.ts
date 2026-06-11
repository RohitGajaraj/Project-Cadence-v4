import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DecisionSource = "meeting" | "mission" | "prd" | "manual";

export type DecisionRow = {
  id: string;
  title: string;
  rationale: string | null;
  status: "pending" | "approved" | "rejected";
  source_kind: DecisionSource | null;
  meeting_id: string | null;
  mission_id: string | null;
  prd_id: string | null;
  decided_by_agent_slug: string | null;
  created_at: string;
  source_label?: string | null;
};

export const listDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        source: z.enum(["meeting", "mission", "prd", "manual"]).optional(),
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        q: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .partial()
      .parse(i ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase
      .from("decisions")
      .select(
        "id,title,rationale,status,source_kind,meeting_id,mission_id,prd_id,decided_by_agent_slug,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.source) q = q.eq("source_kind", data.source);
    if (data?.status) q = q.eq("status", data.status);
    if (data?.q && data.q.trim()) q = q.ilike("title", `%${data.q.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Hydrate source labels in one batch per kind.
    const decisions = (rows ?? []) as DecisionRow[];
    const missionIds = [
      ...new Set(decisions.map((d) => d.mission_id).filter((x): x is string => !!x)),
    ];
    const prdIds = [...new Set(decisions.map((d) => d.prd_id).filter((x): x is string => !!x))];
    const meetingIds = [
      ...new Set(decisions.map((d) => d.meeting_id).filter((x): x is string => !!x)),
    ];

    const [missions, prds, meetings] = await Promise.all([
      missionIds.length
        ? supabase.from("missions").select("id,title").in("id", missionIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      prdIds.length
        ? supabase.from("prds").select("id,title").in("id", prdIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      meetingIds.length
        ? supabase.from("meetings").select("id,title").in("id", meetingIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);
    const missionMap = new Map((missions.data ?? []).map((r) => [r.id, r.title]));
    const prdMap = new Map((prds.data ?? []).map((r) => [r.id, r.title]));
    const meetingMap = new Map((meetings.data ?? []).map((r) => [r.id, r.title]));

    for (const d of decisions) {
      d.source_label =
        (d.mission_id && missionMap.get(d.mission_id)) ||
        (d.prd_id && prdMap.get(d.prd_id)) ||
        (d.meeting_id && meetingMap.get(d.meeting_id)) ||
        null;
    }
    return { decisions };
  });

export const createDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(1).max(280),
        rationale: z.string().max(2000).optional(),
        status: z.enum(["pending", "approved", "rejected"]).default("pending"),
        mission_id: z.string().uuid().optional(),
        prd_id: z.string().uuid().optional(),
        meeting_id: z.string().uuid().optional(),
        source_kind: z.enum(["meeting", "mission", "prd", "manual"]).optional(),
        decided_by_agent_slug: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const source_kind =
      data.source_kind ??
      (data.mission_id
        ? "mission"
        : data.prd_id
          ? "prd"
          : data.meeting_id
            ? "meeting"
            : "manual");
    const { data: row, error } = await context.supabase
      .from("decisions")
      .insert({ ...data, source_kind, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { decision: row };
  });

export const updateDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "approved", "rejected"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("decisions")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
