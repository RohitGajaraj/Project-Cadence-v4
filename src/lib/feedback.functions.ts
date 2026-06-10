import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        rating: z.number().int().min(-1).max(1),
        comment: z.string().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("ai_feedback").insert({
      user_id: context.userId,
      event_id: data.eventId,
      rating: data.rating,
      comment: data.comment ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
