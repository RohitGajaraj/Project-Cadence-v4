// TaskGraphPanel — Build readiness for a PRD's generated task graph (H1-TASKS consumption).
//
// The generator (generateTaskGraph) writes the DAG (seq + depends_on); the existing
// "Task graph" list renders it by seq. This adds the READ-SIDE consumption the stored DAG
// lacked: a topologically-correct build order is implied by progress, and the panel surfaces
// what is actually actionable now (ready vs blocked), how far along the build is, and whether
// the stored DAG is sound (cycles / missing deps the write-side heuristic can miss). Reads
// getTaskGraph; the topology/validation is the pure, unit-tested task-graph.ts.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getTaskGraph } from "@/lib/task-graph.functions";
import { readyTasks } from "@/lib/task-graph";

export function TaskGraphPanel({ prdId }: { prdId: string }) {
  const fetchGraph = useServerFn(getTaskGraph);
  const q = useQuery({
    queryKey: ["task-graph", prdId],
    queryFn: () => fetchGraph({ data: { prdId } }),
  });

  // Stay silent until there is a generated graph to reason about (no filler, no error noise:
  // the sibling "Task graph" section already owns the generate affordance + empty state).
  if (!q.data || q.data.summary.total === 0) return null;

  const { summary, issues, nodes } = q.data;
  const ready = readyTasks(nodes);

  return (
    <div className="mb-6 rounded-lg border hairline bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="mono-label text-xs text-muted-foreground">Build readiness</span>
        <span className="mono-label text-[10px] text-muted-foreground">
          {summary.percentComplete}% complete
        </span>
      </div>

      <p className="text-xs leading-snug text-muted-foreground">
        <span className="font-medium text-foreground">
          {summary.done} of {summary.total} done
        </span>
        {" · "}
        {summary.ready} ready
        {" · "}
        {summary.blocked} blocked
        {summary.estimateRemainingHours > 0 ? ` · ~${summary.estimateRemainingHours}h left` : ""}
      </p>

      {ready.length > 0 && (
        <p className="text-xs leading-snug text-muted-foreground mt-1.5">
          <span className="mono-label text-[10px]">Ready now</span>{" "}
          {/* Just the seq refs — the full titles are enumerated in the Task graph list above. */}
          {ready.map((t) => `#${t.seq}`).join(" · ")}
        </p>
      )}

      {issues.length > 0 && (
        // Failure/alert state → --rose per the role-color law (--ember is reserved for needs-human CTAs).
        <div className="mt-1.5 text-[10px] leading-snug text-[var(--rose)]">
          <span className="mono-label">
            {issues.length} graph {issues.length === 1 ? "issue" : "issues"}
          </span>
          <ul className="mt-0.5 space-y-0.5">
            {issues.slice(0, 4).map((i, n) => (
              <li key={`${i.kind}-${i.seq}-${i.dep ?? "x"}-${n}`}>{i.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
