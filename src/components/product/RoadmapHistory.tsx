// H2-AUDIT-UI · "Why is this on the roadmap?" — a reveal-on-demand popover over an
// opportunity's roadmap-decision history (H2-AUDIT). Calm front, deep engine: the
// trigger is a quiet "why" link; the evidence (who committed it, when, into which
// bucket, with what declared outcome) is revealed only on demand. The history is
// fetched lazily on open so a board of cards never fans out N queries.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getRoadmapHistory } from "@/lib/roadmap.functions";
import { summarizeRoadmapHistory, type RoadmapAuditRow } from "@/lib/roadmap-audit";

/** "2026-06-21T02:42:00Z" -> "2026-06-21 02:42" (deterministic, no locale/SSR drift). */
function fmtWhen(iso: string): string {
  return iso.length >= 16 ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : iso;
}

function bucketLabel(b: RoadmapAuditRow["to_bucket"]): string {
  return b ?? "backlog";
}

export function RoadmapHistory({ opportunityId }: { opportunityId: string }) {
  const [open, setOpen] = useState(false);
  const fHistory = useServerFn(getRoadmapHistory);
  const q = useQuery({
    queryKey: ["roadmap-history", opportunityId],
    queryFn: () => fHistory({ data: { opportunityId } }),
    enabled: open, // lazy: only fetch when the popover is opened
  });
  const events = q.data?.events ?? [];
  const summary = summarizeRoadmapHistory(events);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mono-label"
          style={{ color: "var(--ink-faint)", marginLeft: 8 }}
        >
          why
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" style={{ width: 280, padding: "12px 14px" }}>
        <p className="mono-label" style={{ color: "var(--ink-subtle)", marginBottom: 8 }}>
          Why this is here
        </p>

        {summary.currentOutcome ? (
          <p style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.45, marginBottom: 10 }}>
            Committed for {summary.currentOutcome}
            {summary.currentMeasure ? (
              <span style={{ color: "var(--ink-faint)" }}>
                , measured by {summary.currentMeasure}
              </span>
            ) : null}
            {summary.lastCommittedAt ? (
              <span
                className="mono-label"
                style={{ color: "var(--ink-faint)", display: "block", marginTop: 3 }}
              >
                {fmtWhen(summary.lastCommittedAt)}
              </span>
            ) : null}
          </p>
        ) : null}

        {q.isLoading ? (
          <p style={{ fontSize: 11, color: "var(--ink-faint)" }}>Loading</p>
        ) : events.length === 0 ? (
          <p style={{ fontSize: 11, color: "var(--ink-faint)", lineHeight: 1.4 }}>
            No roadmap history yet. Committing this with an outcome records the why.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {events.map((e) => (
              <div key={e.id} style={{ borderTop: "1px solid var(--hairline)", paddingTop: 6 }}>
                <p className="mono-label" style={{ color: "var(--ink-subtle)" }}>
                  {e.action === "commit" ? "committed" : "moved"} · {bucketLabel(e.to_bucket)} ·{" "}
                  {fmtWhen(e.created_at)}
                </p>
                {e.action === "commit" && e.outcome ? (
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--ink-subtle)",
                      lineHeight: 1.4,
                      marginTop: 2,
                    }}
                  >
                    {e.outcome}
                    {e.measure ? (
                      <span style={{ color: "var(--ink-faint)" }}> · {e.measure}</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
