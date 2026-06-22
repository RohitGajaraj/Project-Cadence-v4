import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveSharedPremiseItems } from "@/lib/ai/shared-premise.server";

/**
 * DBR-3g: surface SHARED-PREMISE precedent on the proactive nudge ("value before you ask").
 * Where `getDecisionPrecedent` finds past decisions by TEXT similarity, this returns the
 * decisions that share a structural PREMISE with the one being viewed - derived from the
 * same upstream signal/opportunity/theme - and the outcome each reached. The same resolver
 * the Critic uses (`resolveSharedPremiseItems`), here returning the structured items for the
 * UI. RLS-scoped (the authed client) + fail-safe ([] on any failure), so the nudge renders
 * nothing until the decision graph carries derivation edges + recorded outcomes.
 */
export const getSharedPremisePrecedent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ kind: z.enum(["opportunity", "prd"]), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const db = context.supabase as unknown as SupabaseClient;
    return resolveSharedPremiseItems(db, userId, { kind: data.kind, id: data.id });
  });
