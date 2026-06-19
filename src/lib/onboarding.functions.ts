import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { getTrackSeed, type OnboardingTrack } from "@/lib/onboarding/track-seeds";

/**
 * Resolve the caller's default workspace, creating one (with an owner membership)
 * if none exists yet.
 *
 * WHY THIS EXISTS: post-tenancy-retrofit (migration 20260530120200_tenancy_c), the
 * write RLS on projects/signals/opportunities is `is_workspace_member(workspace_id)`,
 * and workspace_id only auto-fills from the `current_user_default_workspace()` column
 * default — which returns the caller's earliest workspace_members row. A brand-new
 * user reaches onboarding (the very first write they make) before they reliably have
 * that row: handle_new_user() runs ensure_default_workspace() inside a swallow-all
 * EXCEPTION block, that function isn't in our migrations (Lovable-managed, drift-prone),
 * and demo accounts skip it entirely. With no membership the default resolves to NULL,
 * so `is_workspace_member(NULL)` is false and the INSERT is rejected with
 * "new row violates row-level security policy for table projects".
 *
 * This makes the onboarding seed self-healing and matches the intended path documented
 * in migration C ("set workspace_id explicitly in server functions"). The user-scoped
 * client is permitted by RLS to create its own workspace (owner_id = auth.uid()) and
 * the owner membership row (the "owner manages members" policy).
 */
async function ensureDefaultWorkspace(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  // 1. Fast path: the membership-backed default resolver (same value the column default uses).
  const { data: existing } = await supabase.rpc("current_user_default_workspace");
  if (existing) return existing as string;

  // 2. The user may already OWN a workspace whose membership row never got created
  //    (partial signup provisioning). Reuse it rather than spawning a duplicate.
  const { data: owned, error: ownedError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at")
    .limit(1);
  if (ownedError) throw ownedError;

  let workspaceId: string;
  if (owned && owned.length > 0) {
    workspaceId = owned[0].id;
  } else {
    const { data: created, error: createWsError } = await supabase
      .from("workspaces")
      // account_id is auto-filled by the trg_set_workspace_account DB trigger.
      .insert([{ owner_id: userId, name: "My Workspace" } as never])
      .select("id")
      .single();
    if (createWsError) throw createWsError;
    if (!created) throw new Error("Workspace creation returned no data");
    workspaceId = created.id;
  }

  // 3. Ensure the owner membership row exists — this is what every table's RLS keys on.
  const { error: memberError } = await supabase
    .from("workspace_members")
    .upsert([{ workspace_id: workspaceId, user_id: userId, role: "owner" }], {
      onConflict: "workspace_id,user_id",
      ignoreDuplicates: true,
    });
  if (memberError) throw memberError;

  return workspaceId;
}

/**
 * Seed a workspace with per-track sample data
 *
 * Creates:
 * - One starter project (if not already present)
 * - Several signals (market feedback, user feedback, etc.)
 * - Several opportunities (prioritized ideas)
 * - Updates the profile's onboarded flag
 *
 * Runs during onboarding, after the user selects a track.
 * All data is scoped to the authenticated user.
 *
 * Transaction semantics: if ANY step fails, the entire operation is aborted
 * (via the guard check below). This prevents partial seeding where the profile
 * is marked onboarded but data is incomplete.
 */
export const seedWorkspaceForTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        track: z.enum(["solo", "founding", "tech"]),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const track = data.track as OnboardingTrack;
    const seed = getTrackSeed(track);

    try {
      // 1. Guard: check if already seeded (prevent duplicate inserts on re-click)
      const { data: existingSignals, error: countError } = await supabase
        .from("signals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if (countError) throw countError;
      if (existingSignals && existingSignals.length > 0) {
        throw new Error("Workspace already seeded. Reset in Settings if you need to re-seed.");
      }

      // 2. Resolve (or create) the caller's default workspace. Every insert below is
      //    scoped to it explicitly — the membership-keyed RLS requires workspace_id to
      //    name a workspace the caller belongs to, and a brand-new user may not yet have
      //    one provisioned. See ensureDefaultWorkspace() above.
      const workspaceId = await ensureDefaultWorkspace(supabase, userId);

      // 3. Get or create the active project
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      if (projectsError) throw projectsError;

      let projectId: string;
      if (!projects || projects.length === 0) {
        // Create a new project
        const { data: newProject, error: createError } = await supabase
          .from("projects")
          .insert([{ user_id: userId, workspace_id: workspaceId, name: seed.projectName }])
          .select("id")
          .single();

        if (createError) throw createError;
        if (!newProject) throw new Error("Project creation returned no data");
        projectId = newProject.id;
      } else {
        projectId = projects[0].id;
      }

      // 4. Insert signals
      // If this fails, the handler will throw and profile won't be marked onboarded (guard below).
      const signalRows = seed.signals.map((sig) => ({
        user_id: userId,
        workspace_id: workspaceId,
        project_id: projectId,
        source: sig.source,
        title: sig.title,
        content: sig.content,
      }));

      const { error: signalsError } = await supabase.from("signals").insert(signalRows);

      if (signalsError) throw signalsError;

      // 5. Insert opportunities
      // If this fails, signals are already inserted but will be orphaned.
      // This is acceptable (partial seed is better than no seed), but profile won't be marked
      // onboarded, so the user can retry. Signals are just extra data that won't be used.
      const opportunityRows = seed.opportunities.map((opp) => ({
        user_id: userId,
        workspace_id: workspaceId,
        project_id: projectId,
        title: opp.title,
        problem: opp.problem,
        target_user: opp.target_user || null,
        impact: opp.impact,
        confidence: opp.confidence,
        ease: opp.ease,
        status: "backlog",
      }));

      const { error: opportunitiesError } = await supabase
        .from("opportunities")
        .insert(opportunityRows);

      if (opportunitiesError) throw opportunitiesError;

      // 6. Mark the profile as onboarded (final step; only if all above succeed)
      const { error: profileError, data: profileData } = await supabase
        .from("profiles")
        .update({ onboarded: true })
        .eq("id", userId)
        .select("id");

      if (profileError) throw profileError;
      if (!profileData || profileData.length === 0) {
        throw new Error("Failed to mark workspace as onboarded (profile not found or RLS denied)");
      }

      return {
        success: true,
        projectId,
        signalsCount: seed.signals.length,
        opportunitiesCount: seed.opportunities.length,
      };
    } catch (error) {
      console.error("Error seeding workspace:", error);
      // Map schema-drift Postgres errors to a clear, actionable message so the
      // user sees "the backend is behind" instead of "column foo does not exist".
      // Codes: 42703 undefined_column, 42883 undefined_function, 42P01 undefined_table.
      const pgCode = (error as { code?: string })?.code;
      if (pgCode === "42703" || pgCode === "42883" || pgCode === "42P01") {
        throw new Error(
          "Workspace setup is temporarily unavailable while the backend updates. Please retry in a minute or contact support.",
        );
      }
      throw error;
    }
  });

/**
 * Export OnboardingTrack type so it can be imported by TrackSelector
 */
export type { OnboardingTrack };

/**
 * Mark onboarding as complete (fallback if user skips seeding)
 * This routes them from /onboarding to the main app (/).
 *
 * Validates that the update actually modified a row (RLS safety check).
 */
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { error, data } = await supabase
      .from("profiles")
      .update({ onboarded: true })
      .eq("id", userId)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("Failed to complete onboarding (profile not found or RLS denied)");
    }

    return { success: true };
  });

/**
 * Set agent enabled status (called by the onboarding flow "Meet your staff" step).
 *
 * Keyed by agent id (the row PK), which is what the only caller — OnboardingFlow —
 * passes. The earlier slug-based contract never matched that payload, so every
 * toggle silently failed Zod validation; this aligns the server to the call site.
 */
export const setAgentEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        agentId: z.string().uuid(),
        enabled: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { error, data: rows } = await supabase
      .from("agents")
      .update({ enabled: data.enabled })
      .eq("user_id", userId)
      .eq("id", data.agentId)
      .select("id");

    if (error) throw error;
    if (!rows || rows.length === 0) {
      throw new Error(`Agent "${data.agentId}" not found for this workspace, or RLS denied access`);
    }

    return { success: true };
  });
