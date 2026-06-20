import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadDecisionPrecedent } from "@/lib/ai/decision-precedent.server";

export const getDecisionPrecedent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ kind: z.enum(["opportunity", "prd"]), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const db = context.supabase as unknown as SupabaseClient;
    const table = data.kind === "opportunity" ? "opportunities" : "prds";
    const { data: row } = await db.from(table).select("*").eq("id", data.id).single();
    if (!row) return [];
    const text =
      data.kind === "opportunity"
        ? [row.title, row.problem, row.hypothesis].filter(Boolean).join(". ")
        : [row.title, (row.body_md ?? "").slice(0, 2000)].filter(Boolean).join(". ");
    return loadDecisionPrecedent(db, {
      userId,
      workspaceId: (row.workspace_id as string | null) ?? null,
      text,
    });
  });
