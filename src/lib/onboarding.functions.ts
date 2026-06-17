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
      // 1. Get or create the active project
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

      // 2. Insert signals
      const signalRows = seed.signals.map((sig) => ({
        user_id: userId,
        project_id: projectId,
        source: sig.source,
        title: sig.title,
        content: sig.content,
      }));

      const { error: signalsError } = await supabase.from("signals").insert(signalRows);

      if (signalsError) throw signalsError;

      // 3. Insert opportunities
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

      // 4. Mark the profile as onboarded
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ onboarded: true })
        .eq("id", userId);

      if (profileError) throw profileError;

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
 */
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase
      .from("profiles")
      .update({ onboarded: true })
      .eq("id", userId);

    if (error) throw error;

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

    const { error } = await supabase
      .from("agents")
      .update({ enabled: data.enabled })
      .eq("user_id", userId)
      .eq("slug", data.agentSlug);

    if (error) throw error;

    return { success: true };
  });
