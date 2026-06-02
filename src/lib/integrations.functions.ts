import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PROVIDERS = [
  { id: "notion", label: "Notion", desc: "Two-way sync pages & databases" },
  { id: "google_docs", label: "Google Docs", desc: "Import & sync Google Docs" },
  { id: "linear", label: "Linear", desc: "Import & sync issues to tasks" },
  { id: "google_calendar", label: "Google Calendar", desc: "Sync upcoming meetings" },
  { id: "figma", label: "Figma", desc: "Embed Figma files in docs" },
  { id: "jira", label: "Jira", desc: "Custom OAuth — contact us" },
] as const;

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_integrations")
      .select("*")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { integrations: data ?? [] };
  });

const UpsertSchema = z.object({
  provider: z.string().min(1).max(40),
  status: z.enum(["connected", "disconnected", "error"]).default("connected"),
  account_label: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const upsertIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpsertSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("user_integrations")
      .upsert({
        user_id: userId,
        provider: data.provider,
        status: data.status,
        account_label: data.account_label ?? null,
        metadata: (data.metadata ?? {}) as never,
      }, { onConflict: "user_id,provider" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { integration: row };
  });

export const disconnectIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ provider: z.string().min(1).max(40) }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_integrations")
      .update({ status: "disconnected" })
      .eq("user_id", userId)
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSyncMappings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("sync_mappings")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { mappings: data ?? [] };
  });

const ResolveSchema = z.object({
  id: z.string().uuid(),
  strategy: z.enum(["keep_local", "keep_remote"]),
});

export const resolveSyncConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ResolveSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const patch =
      data.strategy === "keep_local"
        ? { conflict: false, last_pushed_at: new Date().toISOString() }
        : { conflict: false, last_pulled_at: new Date().toISOString() };
    const { error } = await supabase
      .from("sync_mappings")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });