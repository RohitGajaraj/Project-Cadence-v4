/**
 * Orchestrator: pure logic for PRD -> task graph -> Linear dispatch.
 * Network-free; all side effects live in orchestrator.functions.ts.
 */

export type DispatchableTask = {
  id: string;
  seq: number | null;
  title: string;
  priority: string | null;
  depends_on: number[] | null;
};

export type DispatchResult = {
  dispatched: { taskId: string; issueId: string; url: string; title: string }[];
  skipped: string[];
  alreadyDispatched: string[];
  totalTasks: number;
};

export type DispatchValidation = { ok: true } | { ok: false; reason: string };

/** Ensure the task set is safe to dispatch. */
export function validateDispatch(tasks: DispatchableTask[]): DispatchValidation {
  if (tasks.length === 0)
    return { ok: false, reason: "No task graph found. Generate the task graph first." };
  if (tasks.length > 50)
    return { ok: false, reason: "Too many tasks (max 50 per dispatch batch)." };
  return { ok: true };
}

/** Map Cadence local priority label to Linear's numeric priority (1=urgent…4=low). */
export function toLinearPriority(priority: string | null): number {
  const MAP: Record<string, number> = { urgent: 1, high: 2, medium: 3, low: 4 };
  return MAP[priority ?? "medium"] ?? 3;
}

/**
 * Return tasks whose depends_on references a seq not in the task set.
 * These tasks cannot be safely ordered and must be excluded from dispatch.
 */
export function findDanglingDeps(tasks: DispatchableTask[]): DispatchableTask[] {
  const seqs = new Set(tasks.map((t) => t.seq).filter((s): s is number => s !== null));
  return tasks.filter((t) =>
    (t.depends_on ?? []).some((dep) => !seqs.has(dep)),
  );
}

/**
 * Topological sort: dependencies before dependents so Linear issues are created in
 * the right order (depends_on seq references lower seqs — guaranteed by generateTaskGraph).
 * Assumes no dangling depends_on references (call findDanglingDeps first to exclude those).
 * Cycles are not possible when depends_on only references strictly lower seqs (generateTaskGraph
 * contract), so this will always terminate.
 */
export function topologicalOrder(tasks: DispatchableTask[]): DispatchableTask[] {
  const seqMap = new Map(tasks.map((t) => [t.seq, t]));
  const visited = new Set<number>();
  const sorted: DispatchableTask[] = [];

  function visit(seq: number | null): void {
    if (seq === null || visited.has(seq)) return;
    visited.add(seq);
    const t = seqMap.get(seq);
    if (!t) return;
    for (const dep of t.depends_on ?? []) visit(dep);
    sorted.push(t);
  }

  for (const t of tasks) visit(t.seq);
  return sorted;
}

/** Human-readable dispatch summary for logging / UI. */
export function summarizeDispatch(result: DispatchResult): string {
  const { dispatched, skipped, alreadyDispatched, totalTasks } = result;
  const parts: string[] = [`${dispatched.length}/${totalTasks} dispatched to Linear`];
  if (alreadyDispatched.length) parts.push(`${alreadyDispatched.length} already dispatched`);
  if (skipped.length) parts.push(`${skipped.length} failed`);
  return parts.join("; ");
}
