/**
 * WM-S1: Onboarding server functions.
 *
 * Thin TanStack Start server-function layer over the seed-workspace logic.
 * The client calls `triggerWorkspaceSeed` after a workspace is created; the
 * function runs server-side with the admin client and is a no-op unless
 * ONBOARDING_SEED_ENABLED=1.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { seedWorkspace } from "./seed-workspace.server";

export const triggerWorkspaceSeed = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await seedWorkspace(data.workspaceId, data.userId);
    return { ok: true };
  });
