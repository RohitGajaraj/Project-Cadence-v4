import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadDecisionPrecedent } from "@/lib/ai/decision-precedent.server";
import { resolveGoverningForNodes } from "@/lib/ai/governing-decision.server";
import { findGoverningFor } from "@/lib/ai/governing-decision";

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
    const rows = await loadDecisionPrecedent(db, {
      userId,
      workspaceId: (row.workspace_id as string | null) ?? null,
      text,
    });

    // DBR-3: the proactive nudge surfaces past decisions by SIMILARITY, which would show a
    // belief we have since moved on from. Resolve each to its CURRENT governing decision so
    // the nudge can flag a superseded/contradicted precedent. Fail-safe: an empty graph (or
    // any error) yields no governing items, so each row's `governing` is null and the nudge
    // is byte-identical until DBR-1.5 is published + flipped on.
    const nodes = rows.flatMap((r) => {
      const out: { kind: string; id: string }[] = [];
      if (r.prdId) out.push({ kind: "prd", id: r.prdId });
      if (r.opportunityId) out.push({ kind: "opportunity", id: r.opportunityId });
      return out;
    });
    const governingItems = await resolveGoverningForNodes(db, userId, nodes);
    return rows.map((r) => ({
      ...r,
      governing: findGoverningFor(r.prdId, r.opportunityId, governingItems),
    }));
  });
