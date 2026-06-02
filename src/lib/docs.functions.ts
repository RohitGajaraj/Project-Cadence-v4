import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) return n.content.map(extractText).join(" ");
  return "";
}

export const listDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("docs")
      .select("id, title, icon, parent_id, project_id, archived, position, updated_at")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("position", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { docs: data ?? [] };
  });

export const getDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("docs")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { doc: row };
  });

const CreateSchema = z.object({
  title: z.string().min(1).max(200).default("Untitled"),
  parent_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  icon: z.string().max(8).optional(),
});

export const createDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("docs")
      .insert({
        user_id: userId,
        title: data.title,
        parent_id: data.parent_id ?? null,
        project_id: data.project_id ?? null,
        icon: data.icon ?? "📄",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { doc: row };
  });

const UpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  icon: z.string().max(8).optional(),
  content_json: z.unknown().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  archived: z.boolean().optional(),
});

export const updateDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpdateSchema.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    type DocPatch = {
      title?: string;
      icon?: string;
      parent_id?: string | null;
      project_id?: string | null;
      archived?: boolean;
      content_json?: unknown;
      content_text?: string;
      updated_at: string;
    };
    const patch: DocPatch = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.icon !== undefined) patch.icon = data.icon;
    if (data.parent_id !== undefined) patch.parent_id = data.parent_id;
    if (data.project_id !== undefined) patch.project_id = data.project_id;
    if (data.archived !== undefined) patch.archived = data.archived;
    if (data.content_json !== undefined) {
      patch.content_json = data.content_json;
      patch.content_text = extractText(data.content_json).slice(0, 50000);
    }
    const { data: row, error } = await supabase
      .from("docs")
      .update(patch as never)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { doc: row };
  });

export const deleteDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("docs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });