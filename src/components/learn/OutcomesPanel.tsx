import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, ArrowUpRight } from "lucide-react";
import { getOutcomeData } from "@/lib/outcome.functions";

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Outcomes tab = the post-release "what did the swarm announce / send out"
// view. Sourced from the same outcome data that fed the prior /outcome page's
// Launches tab. Releases moved to /product/releases in Phase 1c; Support and
// Learnings live in their own tabs here.
export function OutcomesPanel() {
  const fOutcome = useServerFn(getOutcomeData);
  const outcome = useQuery({ queryKey: ["outcome"], queryFn: () => fOutcome() });
  const launches = outcome.data?.launches ?? [];

  if (outcome.isLoading) {
    return <div className="text-xs text-muted-foreground">Loading…</div>;
  }
  if (outcome.error) {
    return <div className="text-xs text-destructive">{(outcome.error as Error).message}</div>;
  }
  if (launches.length === 0) {
    return (
      <div className="bento p-10 text-center">
        <Megaphone className="h-6 w-6 mx-auto text-violet-300/70" />
        <h3 className="font-display text-base mt-3">Outcomes land here</h3>
        <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
          Growth-agent drafts (changelog, Slack post, announcement email) queue here behind an
          approval gate. Outbound only sends after you approve.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {launches.map((a) => (
        <div key={a.id} className="bento p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider rounded-full bg-secondary px-2 py-0.5">
                  {a.tool_name}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {a.status}
                </span>
              </div>
              {a.rationale && <p className="text-sm mt-2">{a.rationale}</p>}
              <p className="text-[11px] text-muted-foreground mt-1">
                by {a.agent_slug ?? "agent"}
              </p>
            </div>
            <div className="text-[10px] text-muted-foreground shrink-0">
              {fmtTime(a.decided_at ?? a.created_at)}
            </div>
          </div>
          {a.status === "pending" && (
            <Link
              to="/govern"
              search={{ tab: "approvals" }}
              className="mt-3 inline-flex items-center gap-1 text-[11px] text-violet-300 hover:underline"
            >
              Review in Approvals <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}