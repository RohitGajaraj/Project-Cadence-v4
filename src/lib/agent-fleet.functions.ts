/**
 * AGENT-FLEET-VIEW (v11 #30) — the RLS adapter for the by-agent fleet surface.
 *
 * Reads the workspace's recent agent_runs (RLS-scoped via the request's authed
 * Supabase client) plus the agent roster, then composes the fleet server-side via
 * the PURE `agent-fleet.ts` model. The roster is best-effort — if it fails, the
 * fleet still renders from the runs (idle roster-only agents just won't show).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeAgentFleet,
  type AgentFleet,
  type FleetRosterInput,
  type FleetRunInput,
} from "@/lib/agent-fleet";

export const getAgentFleet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ fleet: AgentFleet }> => {
    const { supabase } = context;
    // A recent window of runs is enough for a live fleet snapshot.
    const { data: runs, error } = await supabase
      .from("agent_runs")
      .select("agent_slug,agent_name,status,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    let roster: FleetRosterInput[] = [];
    try {
      const { data: agents } = await supabase.from("agents").select("slug,name");
      roster = (agents ?? [])
        .filter((a): a is { slug: string; name: string | null } => typeof a?.slug === "string")
        .map((a) => ({ slug: a.slug, name: a.name }));
    } catch (e) {
      console.error("[agent-fleet] roster fetch failed (degrading to runs-only):", e);
    }

    return { fleet: computeAgentFleet((runs ?? []) as FleetRunInput[], roster) };
  });
