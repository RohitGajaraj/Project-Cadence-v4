import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/ai/runtime.server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ARTIFACT_KINDS = [
  "signal",
  "theme",
  "opportunity",
  "prd",
  "roadmap_item",
  "task",
  "meeting",
  "decision",
  "mission",
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

const KindSchema = z.enum(ARTIFACT_KINDS);

/** Insert a lineage edge. Idempotent via the unique index. */
export async function recordLineage(
  supabase: SupabaseClient,
  userId: string,
  edge: {
    parent_kind: ArtifactKind;
    parent_id: string;
    child_kind: ArtifactKind;
    child_id: string;
    relation?: string;
    rationale?: string | null;
    created_by_agent?: string | null;
    ai_event_id?: string | null;
  },
): Promise<void> {
  await supabase.from("artifact_lineage").upsert(
    {
      user_id: userId,
      parent_kind: edge.parent_kind,
      parent_id: edge.parent_id,
      child_kind: edge.child_kind,
      child_id: edge.child_id,
      relation: edge.relation ?? "promoted",
      rationale: edge.rationale ?? null,
      created_by_agent: edge.created_by_agent ?? null,
      ai_event_id: edge.ai_event_id ?? null,
    },
    { onConflict: "user_id,parent_kind,parent_id,child_kind,child_id,relation" },
  );
}

type LineageEdge = {
  id: string;
  parent_kind: ArtifactKind;
  parent_id: string;
  child_kind: ArtifactKind;
  child_id: string;
  relation: string;
  rationale: string | null;
  created_at: string;
  // Hydrated title for the "other" end of the edge:
  peer_title?: string | null;
};

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

async function hydrateTitles(
  supabase: SupabaseClient,
  rows: LineageEdge[],
  side: "parent" | "child",
): Promise<LineageEdge[]> {
  const grouped = new Map<ArtifactKind, string[]>();
  for (const r of rows) {
    const kind = side === "parent" ? r.parent_kind : r.child_kind;
    const id = side === "parent" ? r.parent_id : r.child_id;
    const arr = grouped.get(kind) ?? [];
    arr.push(id);
    grouped.set(kind, arr);
  }
  const titleByKey = new Map<string, string>();
  for (const [kind, ids] of grouped) {
    const table = TABLE[kind];
    const col = TITLE_COLUMN[kind];
    if (!table) continue;
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => { in: (c: string, v: string[]) => Promise<{ data: unknown }> };
        };
      }
    )
      .from(table)
      .select(`id, ${col}`)
      .in("id", ids);
    for (const row of (data as Array<Record<string, unknown>> | null) ?? []) {
      const id = row.id as string | undefined;
      const title = row[col];
      if (id) titleByKey.set(`${kind}:${id}`, typeof title === "string" ? title : "");
    }
  }
  return rows.map((r) => {
    const kind = side === "parent" ? r.parent_kind : r.child_kind;
    const id = side === "parent" ? r.parent_id : r.child_id;
    return { ...r, peer_title: titleByKey.get(`${kind}:${id}`) ?? null };
  });
}

export const getLineage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ kind: KindSchema, id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase } = context;

    const { data: ancestorsRaw } = await supabase
      .from("artifact_lineage")
      .select("*")
      .eq("child_kind", data.kind)
      .eq("child_id", data.id)
      .order("created_at", { ascending: false });

    const { data: descendantsRaw } = await supabase
      .from("artifact_lineage")
      .select("*")
      .eq("parent_kind", data.kind)
      .eq("parent_id", data.id)
      .order("created_at", { ascending: false });

    const ancestors = await hydrateTitles(
      supabase,
      (ancestorsRaw ?? []) as LineageEdge[],
      "parent",
    );
    const descendants = await hydrateTitles(
      supabase,
      (descendantsRaw ?? []) as LineageEdge[],
      "child",
    );
    return { ancestors, descendants };
  });

/** AI: split a PRD into 5-8 atomic tasks; record lineage prd → task[]. */
export const promotePrdToTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        prd_id: z.string().uuid(),
        model: z.string().max(80).default("google/gemini-2.5-flash"),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: prd, error: pErr } = await supabase
      .from("prds")
      .select("id, title, body_md, project_id")
      .eq("id", data.prd_id)
      .single();
    if (pErr || !prd) throw new Error("PRD not found");

    const system = `You break a PRD into 5-8 atomic, shippable engineering tasks.
Return STRICT JSON only, no prose:
{"tasks":[{"title":"...","priority":"low|medium|high","is_deep_work":true|false}]}
Each title must be a concrete verb-led action under 80 chars. Order by build sequence.`;

    const result = await callModel(supabase, userId, {
      surface: "prd",
      surface_ref: `prd:${prd.id}:tasks`,
      model: data.model,
      fallbackModel: "google/gemini-2.5-flash-lite",
      // Returns strict {"tasks":[...]} JSON; declare json-mode so the runtime
      // humanizer never rewrites task-title string values (sanitizer wiring).
      responseFormat: "json_object",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `PRD: ${prd.title}\n\n${prd.body_md}` },
      ],
    });

    let parsed: { tasks?: Array<{ title: string; priority?: string; is_deep_work?: boolean }> } =
      {};
    try {
      const cleaned = result.output
        .trim()
        .replace(/^```json\s*|\s*```$/g, "")
        .replace(/^```\s*|\s*```$/g, "");
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("AI returned malformed task list");
    }
    const raw = Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 12) : [];
    if (raw.length === 0) throw new Error("AI produced no tasks");

    const toInsert = raw
      .filter((t) => typeof t.title === "string" && t.title.trim())
      .map((t) => ({
        user_id: userId,
        title: t.title.trim().slice(0, 280),
        priority: (t.priority === "low" || t.priority === "high" ? t.priority : "medium") as
          | "low"
          | "medium"
          | "high",
        is_deep_work: Boolean(t.is_deep_work),
        project_id: prd.project_id ?? null,
      }));

    const { data: tasks, error: tErr } = await supabase
      .from("tasks")
      .insert(toInsert)
      .select("id, title");
    if (tErr) throw new Error(tErr.message);

    for (const t of tasks ?? []) {
      await recordLineage(supabase, userId, {
        parent_kind: "prd",
        parent_id: prd.id,
        child_kind: "task",
        child_id: t.id,
        rationale: "Generated from PRD by promotePrdToTasks",
        created_by_agent: "prd-writer",
      });
    }

    return { tasks: tasks ?? [], count: tasks?.length ?? 0 };
  });
