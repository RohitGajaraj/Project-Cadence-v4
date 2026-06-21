/**
 * Task graph — PURE consumption core (H1-TASKS).
 *
 * generateTaskGraph (discovery.functions.ts) already DECOMPOSES an approved PRD into a
 * dependency-ordered set of `tasks` rows: each carries a 1-based `seq` and a `depends_on`
 * array of EARLIER seq numbers (the write-side validates `dep < seq`). What was missing is
 * the read side: turning those stored rows back into a usable graph — a stable topological
 * build order, which tasks are ready to start now, the integrity of the DAG, and progress.
 *
 * This module is pure (no db/network/AI), so it is fully unit-testable. The server fn
 * (getTaskGraph in task-graph.functions.ts) supplies the rows; the PRD detail surface
 * renders the order + progress. Edges are SEQ-based (depends_on holds seq numbers, not ids),
 * matching the schema.
 */

export type TaskStatus = "todo" | "doing" | "done";
export type Assignee = "agent" | "human";

/** A generated task graph node (seq is always present; manual tasks are excluded upstream). */
export type TaskNode = {
  id: string;
  seq: number;
  title: string;
  detail: string | null;
  depends_on: number[];
  estimate_hours: number | null;
  risk: string | null;
  assignee_kind: Assignee | null;
  status: TaskStatus;
};

export type TaskGraphIssueKind = "forward-ref" | "missing-dep" | "cycle" | "self-dep";

export type TaskGraphIssue = {
  kind: TaskGraphIssueKind;
  /** The seq of the task carrying the problem. */
  seq: number;
  /** The offending dependency seq, when applicable. */
  dep?: number;
  message: string;
};

/**
 * PURE. Normalize a raw `depends_on` value to a clean array of earlier seq numbers:
 * coerce to finite integers, drop self/forward refs (`>= seq`) and non-positive, dedupe,
 * sort ascending. A STRICTER SUPERSET of the write-side guard (which keeps `n < seq` but
 * does not dedupe, truncate, or drop non-positive): the two agree on what a VALID edge is,
 * and the read side additionally scrubs junk so the rendered graph stays clean.
 */
export function sanitizeDependsOn(seq: number, raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const v of raw) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    const d = Math.trunc(n);
    if (d < 1 || d >= seq) continue; // only earlier, positive seqs
    if (seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out.sort((a, b) => a - b);
}

/**
 * PURE. Inspect the graph for integrity problems WITHOUT mutating it: a dependency on a
 * seq that does not exist (missing-dep), on itself (self-dep) or a later task (forward-ref),
 * and any dependency cycle (the write-side `dep < seq` heuristic blocks simple forward
 * cycles but the read side stays honest if the data is ever malformed). Returns issues;
 * never throws.
 */
export function validateTaskGraph(nodes: TaskNode[]): TaskGraphIssue[] {
  const issues: TaskGraphIssue[] = [];
  const bySeq = new Map<number, TaskNode>();
  for (const n of nodes) bySeq.set(n.seq, n);

  for (const n of nodes) {
    for (const dep of n.depends_on) {
      if (dep === n.seq) {
        issues.push({
          kind: "self-dep",
          seq: n.seq,
          dep,
          message: `Task ${n.seq} depends on itself.`,
        });
      } else if (dep > n.seq) {
        issues.push({
          kind: "forward-ref",
          seq: n.seq,
          dep,
          message: `Task ${n.seq} depends on a later task ${dep}.`,
        });
      } else if (!bySeq.has(dep)) {
        issues.push({
          kind: "missing-dep",
          seq: n.seq,
          dep,
          message: `Task ${n.seq} depends on missing task ${dep}.`,
        });
      }
    }
  }

  // Cycle detection via DFS over existing edges (colors: 0 unvisited, 1 in-stack, 2 done).
  const color = new Map<number, number>();
  const reported = new Set<number>();
  const dfs = (seq: number): void => {
    color.set(seq, 1);
    const node = bySeq.get(seq);
    for (const dep of node?.depends_on ?? []) {
      if (!bySeq.has(dep)) continue;
      if (dep === seq) continue; // a self-edge is already reported as self-dep, not a cycle
      const c = color.get(dep) ?? 0;
      if (c === 1 && !reported.has(seq)) {
        reported.add(seq);
        issues.push({
          kind: "cycle",
          seq,
          dep,
          message: `Task ${seq} is part of a dependency cycle (via ${dep}).`,
        });
      } else if (c === 0) {
        dfs(dep);
      }
    }
    color.set(seq, 2);
  };
  for (const n of nodes) if ((color.get(n.seq) ?? 0) === 0) dfs(n.seq);

  return issues;
}

/**
 * PURE. A stable topological build order via Kahn's algorithm over existing edges, breaking
 * ties by ascending seq so the same graph always renders the same. Total by construction:
 * if a cycle leaves nodes unprocessed, they are appended in seq order (never dropped), so a
 * malformed graph still yields a usable, deterministic order.
 */
export function topoOrder(nodes: TaskNode[]): TaskNode[] {
  const bySeq = new Map<number, TaskNode>();
  for (const n of nodes) bySeq.set(n.seq, n);
  const indeg = new Map<number, number>();
  for (const n of nodes) {
    indeg.set(n.seq, n.depends_on.filter((d) => bySeq.has(d)).length);
  }
  const ready: number[] = [...indeg.entries()].filter(([, d]) => d === 0).map(([s]) => s);
  const order: TaskNode[] = [];
  const placed = new Set<number>();
  // Dependents index: who depends on seq s.
  const dependents = new Map<number, number[]>();
  for (const n of nodes) {
    for (const d of n.depends_on) {
      if (!bySeq.has(d)) continue;
      const arr = dependents.get(d);
      if (arr) arr.push(n.seq);
      else dependents.set(d, [n.seq]);
    }
  }
  while (ready.length) {
    ready.sort((a, b) => a - b);
    const s = ready.shift()!;
    if (placed.has(s)) continue;
    placed.add(s);
    order.push(bySeq.get(s)!);
    for (const dep of dependents.get(s) ?? []) {
      indeg.set(dep, (indeg.get(dep) ?? 1) - 1);
      if ((indeg.get(dep) ?? 0) === 0) ready.push(dep);
    }
  }
  // Append any cycle remnants in seq order so the result is total.
  for (const n of [...nodes].sort((a, b) => a.seq - b.seq)) {
    if (!placed.has(n.seq)) order.push(n);
  }
  return order;
}

/**
 * PURE. The tasks that can start right now: not yet done, and every existing dependency is
 * done. A dependency on a missing seq can never be satisfied, so such a task is correctly
 * NOT ready (it is blocked and surfaced by validateTaskGraph).
 */
export function readyTasks(nodes: TaskNode[]): TaskNode[] {
  const bySeq = new Map<number, TaskNode>();
  for (const n of nodes) bySeq.set(n.seq, n);
  return nodes.filter((n) => {
    if (n.status === "done") return false;
    return n.depends_on.every((d) => bySeq.get(d)?.status === "done");
  });
}

export type TaskGraphSummary = {
  total: number;
  done: number;
  doing: number;
  todo: number;
  ready: number;
  /** Not-done tasks that are not yet ready (a dependency is unfinished or missing). */
  blocked: number;
  estimateTotalHours: number;
  estimateRemainingHours: number;
  /** 0..100, by task count. 100 only when every task is done; 0 for an empty graph. */
  percentComplete: number;
};

/** PURE. Roll the graph into a progress summary for the Build-order readout. */
export function summarizeTaskGraph(nodes: TaskNode[]): TaskGraphSummary {
  const total = nodes.length;
  let done = 0;
  let doing = 0;
  let todo = 0;
  let estimateTotalHours = 0;
  let estimateRemainingHours = 0;
  for (const n of nodes) {
    if (n.status === "done") done++;
    else if (n.status === "doing") doing++;
    else todo++;
    const est =
      typeof n.estimate_hours === "number" && Number.isFinite(n.estimate_hours)
        ? n.estimate_hours
        : 0;
    estimateTotalHours += est;
    if (n.status !== "done") estimateRemainingHours += est;
  }
  const ready = readyTasks(nodes).length;
  return {
    total,
    done,
    doing,
    todo,
    ready,
    // Readiness partition: done | ready (not-done, deps satisfied) | blocked (the rest).
    // Distinct from the status partition (done/doing/todo) above; a ready task may be doing.
    blocked: total - done - ready,
    estimateTotalHours: Math.round(estimateTotalHours * 10) / 10,
    estimateRemainingHours: Math.round(estimateRemainingHours * 10) / 10,
    percentComplete: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}
