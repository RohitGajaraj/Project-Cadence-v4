/**
 * Task graph — read surface (H1-TASKS consumption).
 *
 * Reads the generated task DAG for a PRD (the rows generateTaskGraph wrote: seq + the
 * earlier-seq depends_on) and returns it as a usable graph: topologically ordered build
 * order, integrity issues, and a progress summary. Read-only, RLS-scoped (mirrors
 * listTasks); the pure logic lives in task-graph.ts so it is unit-verifiable.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type Assignee,
  type TaskGraphIssue,
  type TaskGraphSummary,
  type TaskNode,
  type TaskStatus,
  sanitizeDependsOn,
  summarizeTaskGraph,
  topoOrder,
  validateTaskGraph,
} from "@/lib/task-graph";

export type TaskGraphResult = {
  /** Topologically ordered build order (dependencies first), or [] when there is no graph. */
  nodes: TaskNode[];
  summary: TaskGraphSummary;
  /** Integrity problems in the stored DAG (empty = clean). */
  issues: TaskGraphIssue[];
};

const STATUSES: TaskStatus[] = ["todo", "doing", "done"];

/** Coerce a raw `tasks` row to a clean TaskNode (sanitizing seq/status/assignee/depends_on). */
function toNode(r: Record<string, unknown>): TaskNode {
  const seq = Math.trunc(Number(r.seq));
  const status = STATUSES.includes(r.status as TaskStatus) ? (r.status as TaskStatus) : "todo";
  const assignee =
    r.assignee_kind === "human" || r.assignee_kind === "agent"
      ? (r.assignee_kind as Assignee)
      : null;
  const est = Number(r.estimate_hours);
  return {
    id: String(r.id),
    seq,
    title: String(r.title ?? "Task"),
    detail: r.detail == null ? null : String(r.detail),
    depends_on: sanitizeDependsOn(seq, r.depends_on),
    estimate_hours: Number.isFinite(est) ? est : null,
    risk: r.risk == null || String(r.risk).trim() === "" ? null : String(r.risk),
    assignee_kind: assignee,
    status,
  };
}

export const getTaskGraph = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ prdId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }): Promise<TaskGraphResult> => {
    const db = context.supabase as unknown as SupabaseClient;
    // Generated tasks only (seq NOT NULL); manual tasks (seq NULL) are not part of the DAG.
    const { data: rows, error } = await db
      .from("tasks")
      .select(
        "id, seq, title, detail, depends_on, estimate_hours, risk, assignee_kind, status, prd_id",
      )
      .eq("prd_id", data.prdId)
      .not("seq", "is", null)
      .order("seq", { ascending: true });
    if (error) throw new Error(error.message);

    const nodes = ((rows ?? []) as Record<string, unknown>[])
      .map(toNode)
      .filter((n) => Number.isFinite(n.seq) && n.seq >= 1);

    return {
      nodes: topoOrder(nodes),
      summary: summarizeTaskGraph(nodes),
      issues: validateTaskGraph(nodes),
    };
  });
