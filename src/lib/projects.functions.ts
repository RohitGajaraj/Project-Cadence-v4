import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ context, data }) => {
    let workspaceId = data.workspaceId;
    
    // Fallback to default workspace if not provided
    if (!workspaceId) {
      const { data: memberRows } = await context.supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: true })
        .limit(1);

      if (memberRows && memberRows.length > 0) {
        workspaceId = memberRows[0].workspace_id;
      }
    }

    if (!workspaceId) {
      return { projects: [] };
    }

    const { data: projects, error } = await context.supabase
      .from("projects")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: tasks } = await context.supabase
      .from("tasks")
      .select("id,status,project_id");
    const stats = (projects ?? []).map((p) => {
      const projectTasks = (tasks ?? []).filter((t) => t.project_id === p.id);
      const done = projectTasks.filter((t) => t.status === "done").length;
      const total = projectTasks.length;
      return { ...p, task_total: total, task_done: done, progress: total ? Math.round((done / total) * 100) : 0 };
    });
    return { projects: stats };
  });

const createSchema = z.object({
  name: z.string().min(1).max(200),
  north_star: z.string().max(500).nullable().optional(),
  target_date: z.string().nullable().optional(),
  status: z.enum(["active", "paused", "shipped"]).default("active"),
  workspaceId: z.string().uuid().optional(),
});

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { workspaceId: inputWorkspaceId, ...rest } = data;
    let workspaceId = inputWorkspaceId;
    
    if (!workspaceId) {
      const { data: memberRows } = await context.supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: true })
        .limit(1);

      if (memberRows && memberRows.length > 0) {
        workspaceId = memberRows[0].workspace_id;
      }
    }

    if (!workspaceId) {
      throw new Error("No active workspace found for user.");
    }

    const { data: row, error } = await context.supabase
      .from("projects")
      .insert({ ...rest, workspace_id: workspaceId, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { project: row };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });