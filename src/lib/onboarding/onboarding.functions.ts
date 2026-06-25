/**
 * WM-S1: Onboarding server functions.
 *
 * Thin TanStack Start server-function layer over the seed-workspace logic.
 * The client calls `triggerWorkspaceSeed` after a workspace is created; the
 * function runs server-side and is a no-op unless ONBOARDING_SEED_ENABLED=1.
 *
 * Security: userId is sourced from the verified JWT (context.userId), never
 * from client input, eliminating IDOR. Workspace membership is validated
 * against the workspaces table before seeding.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { seedWorkspace } from "./seed-workspace.server";

export const triggerWorkspaceSeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { workspaceId } = data;
    const userId = context.userId;

    // Verify the authenticated user owns (or is a member of) this workspace
    const { data: membership, error } = await context.supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !membership) {
      throw new Error("Forbidden: workspace not found or access denied");
    }

    await seedWorkspace(workspaceId, userId);
    return { ok: true };
  });
