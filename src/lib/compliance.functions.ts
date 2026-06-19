/**
 * Compliance / trust disclosures - TanStack server functions.
 * Read: getSubprocessors (the current sub-processor disclosure for a trust page / security review).
 *
 * The substance lives in the pure, unit-tested `compliance/subprocessors` module; this is the
 * thin, authenticated app-internal endpoint over it. The pure module is also importable directly
 * by a future public trust page (it carries no secrets), so the auth here never blocks that.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  allSubprocessors,
  activeSubprocessors,
  type SubProcessor,
} from "@/lib/compliance/subprocessors";

export type { SubProcessor };

/**
 * Returns the sub-processor disclosure. By default only ACTIVE processors (who has our data
 * today); pass `includeInactive` to also list adapter-ready (BYO-only) providers.
 */
export const getSubprocessors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ includeInactive: z.boolean().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const subprocessors = data.includeInactive ? allSubprocessors() : activeSubprocessors();
    return { subprocessors };
  });
