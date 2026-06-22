import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveGoverningForNodes } from "@/lib/ai/governing-decision.server";
import { findGoverningFor } from "@/lib/ai/governing-decision";

/**
 * DBR-3d: is the decision the user is VIEWING itself stale? Where PrecedentNudge surfaces
 * SIMILAR past decisions, this resolves the viewed entity's OWN currency by walking the
 * supersedes/contradicts edges FROM it: if a later decision superseded it (or a later
 * outcome contradicted it), return the governing item (with the replacement's title) so the
 * surface can warn before the user acts on a belief the workspace has moved on from.
 * Best-effort + fail-safe: null on any miss/error, so the banner simply does not render.
 * Dormant + byte-identical until the decision graph has edges (post-publish, as they accrue).
 */
export const getDecisionCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ kind: z.enum(["opportunity", "prd"]), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const db = context.supabase as unknown as SupabaseClient;
    const items = await resolveGoverningForNodes(db, userId, [{ kind: data.kind, id: data.id }]);
    const prdId = data.kind === "prd" ? data.id : null;
    const oppId = data.kind === "opportunity" ? data.id : null;
    return findGoverningFor(prdId, oppId, items);
  });
