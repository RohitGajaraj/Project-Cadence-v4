import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tasks: data ?? [] };
  });

const createSchema = z.object({
  title: z.string().min(1).max(280),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  is_deep_work: z.boolean().default(false),
  due_date: z.string().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  assignee_kind: z.enum(["human", "agent"]).default("human"),
  agent_id: z.string().uuid().nullable().optional(),
});

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("tasks")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { task: row };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  title: z.string().min(1).max(280).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  is_deep_work: z.boolean().optional(),
  due_date: z.string().nullable().optional(),
  assignee_kind: z.enum(["human", "agent"]).optional(),
  agent_id: z.string().uuid().nullable().optional(),
});

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { id, ...rest } = data;
    const patch: {
      status?: "todo" | "doing" | "done";
      title?: string;
      priority?: "low" | "medium" | "high";
      is_deep_work?: boolean;
      due_date?: string | null;
      assignee_kind?: "human" | "agent";
      agent_id?: string | null;
      updated_at: string;
      completed_at?: string | null;
    } = { ...rest, updated_at: new Date().toISOString() };
    if (rest.status === "done") patch.completed_at = new Date().toISOString();
    else if (rest.status) patch.completed_at = null;
    const { data: row, error } = await context.supabase
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { task: row };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
