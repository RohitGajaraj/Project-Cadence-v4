import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid().optional() }).parse(input ?? {}),
  )
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
    // B5: hide soft-archived products from the active set (sidebar + tabs).
    // A JS filter (not `.is("archived_at", null)`) keeps this pre-migration
    // tolerant — until the column exists, archived_at reads undefined ⇒ kept.
    const visible = (projects ?? []).filter(
      (p) => !(p as { archived_at?: string | null }).archived_at,
    );
    const { data: tasks } = await context.supabase.from("tasks").select("id,status,project_id");
    const stats = visible.map((p) => {
      const projectTasks = (tasks ?? []).filter((t) => t.project_id === p.id);
      const done = projectTasks.filter((t) => t.status === "done").length;
      const total = projectTasks.length;
      return {
        ...p,
        task_total: total,
        task_done: done,
        progress: total ? Math.round((done / total) * 100) : 0,
      };
    });
    return { projects: stats };
  });

// B3 · Portfolio — per-product loop status so an operator can run many products
// without losing the thread. For each product in the workspace: task progress
// plus how much sits in its loop (signals, opportunities, specs). All RLS-scoped;
// signals/opportunities/prds and tasks all carry project_id. Read-only.
export type PortfolioProduct = {
  id: string;
  name: string;
  north_star: string | null;
  task_done: number;
  task_total: number;
  progress: number;
  signals: number;
  opportunities: number;
  specs: number;
  archived: boolean;
};

export const getPortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ products: PortfolioProduct[] }> => {
    const { supabase, userId } = context;
    let workspaceId = data.workspaceId;
    if (!workspaceId) {
      const { data: memberRows } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1);
      if (memberRows && memberRows.length > 0) workspaceId = memberRows[0].workspace_id;
    }
    if (!workspaceId) return { products: [] };

    const { data: projects } = await supabase
      .from("projects")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    const list = (projects ?? []) as {
      id: string;
      name: string;
      north_star?: string | null;
      archived_at?: string | null;
    }[];
    if (list.length === 0) return { products: [] };
    const ids = list.map((p) => p.id);

    const [tasksRes, sigRes, oppRes, prdRes] = await Promise.all([
      supabase.from("tasks").select("status,project_id").in("project_id", ids),
      supabase.from("signals").select("project_id").in("project_id", ids),
      supabase.from("opportunities").select("project_id").in("project_id", ids),
      supabase.from("prds").select("project_id").in("project_id", ids),
    ]);
    // Surface a failed count query instead of silently zeroing — a zero must mean
    // "genuinely none", never "the query failed" (the route's error boundary
    // shows a retry rather than a misleading empty portfolio).
    const countErr = tasksRes.error || sigRes.error || oppRes.error || prdRes.error;
    if (countErr) throw new Error(countErr.message);

    const countBy = (rows: { project_id: string | null }[] | null) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) {
        if (r.project_id) m.set(r.project_id, (m.get(r.project_id) ?? 0) + 1);
      }
      return m;
    };
    const sig = countBy(sigRes.data as { project_id: string | null }[] | null);
    const opp = countBy(oppRes.data as { project_id: string | null }[] | null);
    const prd = countBy(prdRes.data as { project_id: string | null }[] | null);
    const taskAgg = new Map<string, { done: number; total: number }>();
    for (const t of (tasksRes.data ?? []) as { status: string; project_id: string | null }[]) {
      if (!t.project_id) continue;
      const cur = taskAgg.get(t.project_id) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (t.status === "done") cur.done += 1;
      taskAgg.set(t.project_id, cur);
    }

    const products: PortfolioProduct[] = list.map((p) => {
      const tk = taskAgg.get(p.id) ?? { done: 0, total: 0 };
      return {
        id: p.id,
        name: p.name,
        north_star: p.north_star ?? null,
        task_done: tk.done,
        task_total: tk.total,
        progress: tk.total ? Math.round((tk.done / tk.total) * 100) : 0,
        signals: sig.get(p.id) ?? 0,
        opportunities: opp.get(p.id) ?? 0,
        specs: prd.get(p.id) ?? 0,
        archived: Boolean(p.archived_at),
      };
    });
    return { products };
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
    // user_id scope + .select() so a no-match or RLS-blocked delete fails loudly
    // instead of a phantom ok (RLS already scopes it; this keeps "Deleted" honest
    // and consistent with setProjectArchived). The FK is `on delete set null`, so
    // the product's signals/opps/specs/tasks are detached, not cascade-deleted.
    const { data: rows, error } = await context.supabase
      .from("projects")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Product not found");
    return { ok: true };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  north_star: z.string().max(500).nullable().optional(),
  target_date: z.string().nullable().optional(),
  status: z.enum(["active", "paused", "shipped"]).optional(),
});

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("projects").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// B5 · Soft archive (reversible). Hides the product from the active set without
// touching its data; restore clears the stamp. The user_id scope + .select()
// make a blocked or no-match write fail loudly instead of returning a phantom
// ok:true (the optimistic UI rolls back on a thrown error). The write is gated
// on the next sync adding the archived_at column; until then it errors honestly.
const archiveSchema = z.object({ id: z.string().uuid(), archive: z.boolean() });

export const setProjectArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => archiveSchema.parse(input))
  .handler(async ({ context, data }) => {
    // Loose patch (matches the roadmap pre-migration pattern) so the not-yet-
    // applied archived_at column doesn't trip the generated-types check.
    const patch: Record<string, unknown> = {
      archived_at: data.archive ? new Date().toISOString() : null,
    };
    const { data: rows, error } = await context.supabase
      .from("projects")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error("Product not found");
    return { ok: true };
  });

// B5 · Export a product's full footprint as one JSON snapshot — the escape
// hatch (run before a hard delete, or any time). RLS scopes every read to the
// caller, so this can only export the user's own rows.
// JSON-safe shapes: the TanStack server-fn boundary requires a statically
// serializable return (it rejects `unknown`), and these rows are plain DB JSON.
type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

export type ProductExport = {
  product: JsonObject;
  signals: JsonObject[];
  opportunities: JsonObject[];
  specs: JsonObject[];
  tasks: JsonObject[];
  exported_by: string;
};

export const exportProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<ProductExport> => {
    const { supabase, userId } = context;
    const { data: product, error: pErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!product) throw new Error("Product not found");

    const [signals, opportunities, prds, tasks] = await Promise.all([
      supabase.from("signals").select("*").eq("project_id", data.id),
      supabase.from("opportunities").select("*").eq("project_id", data.id),
      supabase.from("prds").select("*").eq("project_id", data.id),
      supabase.from("tasks").select("*").eq("project_id", data.id),
    ]);
    const firstErr = signals.error || opportunities.error || prds.error || tasks.error;
    if (firstErr) throw new Error(firstErr.message);

    return {
      product,
      signals: signals.data ?? [],
      opportunities: opportunities.data ?? [],
      specs: prds.data ?? [],
      tasks: tasks.data ?? [],
      exported_by: userId,
    };
  });
