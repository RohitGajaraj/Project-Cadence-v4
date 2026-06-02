import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      const { data: created, error: cerr } = await supabase
        .from("profiles")
        .insert({ id: userId })
        .select()
        .single();
      if (cerr) throw new Error(cerr.message);
      return { profile: created };
    }
    return { profile: data };
  });

const UpdateSchema = z.object({
  full_name: z.string().min(1).max(80).optional(),
  display_name: z.string().min(1).max(40).optional(),
  role: z.string().min(1).max(80).optional(),
  timezone: z.string().min(1).max(60).optional(),
  avatar_url: z.string().url().max(500).optional().or(z.literal("")),
  working_hours_start: z.number().int().min(0).max(23).optional(),
  working_hours_end: z.number().int().min(1).max(24).optional(),
  default_model: z.string().min(1).max(80).optional(),
  onboarded: z.boolean().optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const patch: {
      full_name?: string;
      display_name?: string;
      role?: string;
      timezone?: string;
      avatar_url?: string | null;
      working_hours_start?: number;
      working_hours_end?: number;
      default_model?: string;
      onboarded?: boolean;
      updated_at: string;
    } = { ...data, updated_at: new Date().toISOString() };
    if (data.avatar_url === "") patch.avatar_url = null;
    const { data: row, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { profile: row };
  });
