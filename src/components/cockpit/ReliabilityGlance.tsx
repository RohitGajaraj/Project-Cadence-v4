import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getReliabilitySlo, getRunawayMissions } from "@/lib/reliability.functions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { RunawayMissionsDetail } from "./RunawayMissionsDetail";

// RELIABILITY-GLANCE - a calm, silent-when-healthy operator line atop Missions that wires the two
// shipped reliability read fns (getReliabilitySlo + getRunawayMissions, RELIABILITY-SLO + RUNAWAY-
// DETECT). Engine-Room-doctrine: it surfaces an ATTENTION (a strained AI error budget or a spinning
// mission), never an always-on metrics panel, and renders NOTHING when the loop is healthy so the
// header stays calm. The deep per-call SLO breakdown + the flagged-mission list stay behind the
// Engine Room (reveal-on-demand popover). On a query error the data stays undefined, so the glance
// degrades to silent rather than turning a reliability surface into noise.
// Engine-Room: per-call SLO + per-mission churn -> one calm "heads up" line only when something is
// off -> the full breakdown stays behind Engine Room.

export function ReliabilityGlance() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const fetchSlo = useServerFn(getReliabilitySlo);
  const fetchRunaway = useServerFn(getRunawayMissions);

  const sloQ = useQuery({
    queryKey: ["reliability-slo"],
    queryFn: () => fetchSlo({ data: {} }),
  });
  const runawayQ = useQuery({
    queryKey: ["runaway-missions"],
    queryFn: () => fetchRunaway({ data: {} }),
  });

  const slo = sloQ.data;
  const runaway = runawayQ.data;

  const spinning = runaway?.flagged.filter((f) => f.severity === "runaway").length ?? 0;
  const budgetStatus = slo?.metrics.budget.status;
  const budgetStrained = budgetStatus === "warning" || budgetStatus === "exhausted";

  // Calm front: nothing to flag (or nothing has answered yet) -> render nothing.
  if (spinning === 0 && !budgetStrained) return null;

  const parts: string[] = [];
  if (spinning > 0 && runaway?.summary) parts.push(runaway.summary);
  if (budgetStrained && slo) {
    parts.push(
      budgetStatus === "exhausted"
        ? `AI error budget spent, ${slo.metrics.availabilityPct}% of calls succeeded this week`
        : `AI error budget low, ${slo.metrics.availabilityPct}% of calls succeeded this week`,
    );
  }
  if (parts.length === 0) return null;

  // Neutral ink tones only: per the role-color law the accents (ember/madder/moss) are reserved
  // (needs-human / outcome-failure / outcome-success); reliability telemetry is neutral, so the
  // words carry the signal. Matches the sibling MissionsCostGlance.
  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <div
          className="mono-label tabular-nums"
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 12,
            color: "var(--ink-subtle)",
            cursor: "pointer",
          }}
        >
          <span style={{ color: "var(--ink-faint)" }}>Heads up</span>
          <span style={{ color: "var(--ink)" }}>{parts.join(" · ")}</span>
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-96"
        style={{ maxWidth: "90vw", maxHeight: "70vh", overflow: "auto" }}
      >
        <RunawayMissionsDetail runaway={runaway} slo={slo} onNavigate={() => setPopoverOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
