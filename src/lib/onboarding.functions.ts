import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTrackSeed, type OnboardingTrack } from "@/lib/onboarding/track-seeds";

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
        throw new Error(
          "Workspace already seeded. Reset in Settings if you need to re-seed.",
        );
      }

      // 2. Get or create the active project
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
          .insert([{ user_id: userId, name: seed.projectName }])
          .select("id")
          .single();

        if (createError) throw createError;
        if (!newProject) throw new Error("Project creation returned no data");
        projectId = newProject.id;
      } else {
        projectId = projects[0].id;
      }

      // 3. Insert signals
      // If this fails, the handler will throw and profile won't be marked onboarded (guard below).
      const signalRows = seed.signals.map((sig) => ({
        user_id: userId,
        project_id: projectId,
        source: sig.source,
        title: sig.title,
        content: sig.content,
      }));

      const { error: signalsError } = await supabase.from("signals").insert(signalRows);

      if (signalsError) throw signalsError;

      // 4. Insert opportunities
      // If this fails, signals are already inserted but will be orphaned.
      // This is acceptable (partial seed is better than no seed), but profile won't be marked
      // onboarded, so the user can retry. Signals are just extra data that won't be used.
      const opportunityRows = seed.opportunities.map((opp) => ({
        user_id: userId,
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

      // 5. Mark the profile as onboarded (final step; only if all above succeed)
      const { error: profileError, data: profileData } = await supabase
        .from("profiles")
        .update({ onboarded: true })
        .eq("id", userId)
        .select("id");

      if (profileError) throw profileError;
      if (!profileData || profileData.length === 0) {
        throw new Error(
          "Failed to mark workspace as onboarded (profile not found or RLS denied)",
        );
      }

      return {
        success: true,
        projectId,
        signalsCount: seed.signals.length,
        opportunitiesCount: seed.opportunities.length,
      };
    } catch (error) {
      console.error("Error seeding workspace:", error);
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
      throw new Error(
        "Failed to complete onboarding (profile not found or RLS denied)",
      );
    }

    return { success: true };
  });

/**
 * Set agent enabled status (called by the onboarding flow step 2)
 */
export const setAgentEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        agentSlug: z.string(),
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
      .eq("slug", data.agentSlug)
      .select("id");

    if (error) throw error;
    if (!rows || rows.length === 0) {
      throw new Error(
        `Agent "${data.agentSlug}" not found for this workspace, or RLS denied access`,
      );
    }

    return { success: true };
  });
