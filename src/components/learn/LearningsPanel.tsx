import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
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

export function LearningsPanel() {
  const fOutcome = useServerFn(getOutcomeData);
  const outcome = useQuery({ queryKey: ["outcome"], queryFn: () => fOutcome() });
  const learnings = outcome.data?.learnings ?? [];

  if (outcome.isLoading) {
    return <div className="text-xs text-muted-foreground">Loading…</div>;
  }
  if (learnings.length === 0) {
    return (
      <div className="bento p-10 text-center">
        <Sparkles className="h-6 w-6 mx-auto text-amber-300/70" />
        <h3 className="font-display text-base mt-3">Learnings close the loop</h3>
        <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
          When a shipped opportunity gets re-scored from new signals or outcomes, the change shows
          up here. This is the loop closing back to Product → Signals.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {learnings.map((o) => (
        <div key={o.id} className="bento p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                to="/product"
                search={{ tab: "opportunities" }}
                className="font-display text-sm hover:underline"
              >
                {o.title}
              </Link>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.problem}</p>
            </div>
            <div className="text-[10px] text-muted-foreground shrink-0 inline-flex items-center gap-3">
              <span>ICE {Number(o.ice_score ?? 0).toFixed(1)}</span>
              <span>{o.status}</span>
              <span>updated {fmtTime(o.updated_at)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}