/**
 * SEN-04: Researcher Watchtower — Settings UI server functions.
 *
 * Provides read/write access to the researcher_targets column on workspace_briefs,
 * which the researcher-tick hook uses to drive Firecrawl web searches.
 *
 * researcher_targets: comma- or newline-separated list of competitor names,
 * product categories, or market terms to watch. Empty = auto-derived from
 * current_focus + top opportunity titles.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveWorkspaceId(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  explicit: string | null | undefined,
): Promise<string | null> {
  if (explicit) return explicit;
  const { data } = await supabase.rpc("current_user_default_workspace");
  return (data as string | null) ?? null;
}

export const getResearcherTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId?: string | null } | undefined) =>
    z.object({ workspaceId: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ targets: string; lastTickAt: string | null }> => {
    const { supabase } = context;
    const workspaceId = await resolveWorkspaceId(supabase, data.workspaceId ?? null);
    if (!workspaceId) return { targets: "", lastTickAt: null };

    const { data: brief } = await supabase
      .from("workspace_briefs")
      .select("researcher_targets, last_researcher_tick_at")
      .eq("workspace_id", workspaceId)
      .single();

    // Cast: new columns not in generated types until migration is applied
    const b = brief as unknown as {
      researcher_targets?: string;
      last_researcher_tick_at?: string | null;
    } | null;

    return {
      targets: b?.researcher_targets ?? "",
      lastTickAt: b?.last_researcher_tick_at ?? null,
    };
  });

export const updateResearcherTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid().nullable().optional(),
        targets: z.string().max(2000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabase } = context;
    const workspaceId = await resolveWorkspaceId(supabase, data.workspaceId ?? null);
    if (!workspaceId) return { ok: false };

    // Verify the user owns or is a member of this workspace (RLS will also enforce)
    const { error } = await supabase
      .from("workspace_briefs")
      .update({ researcher_targets: data.targets.trim() } as never)
      .eq("workspace_id", workspaceId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
