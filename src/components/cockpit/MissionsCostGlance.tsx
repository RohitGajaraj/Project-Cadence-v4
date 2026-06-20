import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCostPerOutcome } from "@/lib/cost-per-outcome.functions";

// ENG-06 (Part B2) - the cost-per-outcome "manager's glance" on the Missions header.
// The founder's "agent manager" ask expressed doctrine-safe: a single calm, outcome-framed
// line (what the fleet shipped this week, then what it cost), NOT a control-room metrics
// panel. Stays silent on a quiet week so the header reads calm. Shares the
// ["cost-per-outcome"] query cache with Today's CostPerOutcomeChip, so it adds no fetch.
// Engine-Room: per-run agent spend + outcome counts -> one calm "this week ... for $X" line
// atop Missions -> the full per-window unit economics stay behind Engine Room > Analytics.

export function MissionsCostGlance() {
  const fetchCost = useServerFn(getCostPerOutcome);
  const q = useQuery({ queryKey: ["cost-per-outcome"], queryFn: () => fetchCost() });
  const d = q.data;
  if (!d) return null;

  const outcomes = [
    d.specs > 0 ? `${d.specs} spec${d.specs === 1 ? "" : "s"}` : null,
    d.decisions > 0 ? `${d.decisions} decision${d.decisions === 1 ? "" : "s"}` : null,
    d.missions > 0 ? `${d.missions} shipped` : null,
  ].filter((x): x is string => x !== null);

  // Quiet week (nothing shipped, nothing spent): stay silent, keep the header calm.
  if (outcomes.length === 0 && d.weekSpendUsd === 0) return null;

  return (
    <div
      className="mono-label tabular-nums"
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        flexWrap: "wrap",
        marginTop: 12,
        color: "var(--ink-subtle)",
      }}
    >
      <span style={{ color: "var(--ink-faint)" }}>This week the fleet shipped</span>
      <span style={{ color: "var(--ink)" }}>
        {outcomes.length > 0 ? outcomes.join(" · ") : "nothing yet"}
      </span>
      <span style={{ color: "var(--ink-faint)" }}>for</span>
      <span style={{ color: "var(--ink)" }}>${d.weekSpendUsd.toFixed(2)}</span>
      {d.monthCapUsd != null && (
        <span style={{ color: "var(--ink-faint)" }}>
          · ${d.monthUsedUsd.toFixed(2)} of ${d.monthCapUsd.toFixed(0)} this month
        </span>
      )}
    </div>
  );
}
