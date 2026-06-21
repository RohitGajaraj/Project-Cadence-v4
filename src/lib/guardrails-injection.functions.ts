/**
 * FND-0.7-d — server fn behind the injection-defense governance card.
 *
 * Lets an authenticated operator probe the weighted-evidence prompt-injection
 * classifier on a sample string and see exactly what it would decide (allow /
 * flag / quarantine), with the score, severity, and the signals that fired. This
 * is the "view the classifier" operator surface the FND-0.7 spec deferred.
 *
 * Run SERVER-SIDE on purpose: `@/lib/injection-classifier` carries the detection
 * patterns, and routing the call through a server fn keeps them out of the client
 * bundle (so the card is not a precise evasion oracle for an un-authenticated
 * visitor). Auth-gated by `requireSupabaseAuth`. Pure + read-only: it classifies
 * the supplied text and returns the verdict; it writes nothing and touches no
 * pipeline, so it can never affect a live request.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  classifyInjection,
  FLAG_THRESHOLD,
  QUARANTINE_THRESHOLD,
  type InjectionVerdict,
} from "@/lib/injection-classifier";

export type InjectionSampleResult = {
  verdict: InjectionVerdict;
  /** The live decision thresholds, returned so the card never hard-codes (and drifts from) them. */
  flagThreshold: number;
  quarantineThreshold: number;
};

export const assessInjectionSample = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ text: z.string().max(20000).default("") }).parse(i))
  .handler(async ({ data }): Promise<InjectionSampleResult> => {
    return {
      verdict: classifyInjection(data.text),
      flagThreshold: FLAG_THRESHOLD,
      quarantineThreshold: QUARANTINE_THRESHOLD,
    };
  });
