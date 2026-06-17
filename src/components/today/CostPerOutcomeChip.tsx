import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCostPerOutcome } from "@/lib/cost-per-outcome.functions";

/**
 * ENG-06 (Part B1) — the cost-per-outcome line on Today's "This week" pulse.
 *
 * Outcome-framed per the Engine-Room Doctrine: lead with what the operator GOT
 * (specs, decisions, missions shipped), then what it cost. The deep per-agent
 * telemetry stays behind the Engine Room door. Renders nothing on a fully quiet
 * week (no outcomes, no spend) so the calm front stays calm.
 */
export function CostPerOutcomeChip() {
  const fetchCost = useServerFn(getCostPerOutcome);
  const q = useQuery({ queryKey: ["cost-per-outcome"], queryFn: () => fetchCost() });
  const d = q.data;
  if (!d) return null;

  const outcomes = [
    d.specs > 0 ? `${d.specs} spec${d.specs === 1 ? "" : "s"}` : null,
    d.decisions > 0 ? `${d.decisions} decision${d.decisions === 1 ? "" : "s"}` : null,
    d.missions > 0 ? `${d.missions} shipped` : null,
  ].filter((x): x is string => x !== null);

  // Fully quiet week (nothing shipped, nothing spent): stay silent.
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
        paddingTop: 12,
        borderTop: "1px solid var(--hairline)",
        color: "var(--ink-subtle)",
      }}
    >
      <span style={{ color: "var(--ink-faint)" }}>Shipped this week</span>
      <span style={{ color: "var(--ink)" }}>
        {outcomes.length > 0 ? outcomes.join(" · ") : "nothing yet"}
      </span>
      <span style={{ color: "var(--ink-faint)" }}>for</span>
      <span style={{ color: "var(--ink)" }}>${d.weekSpendUsd.toFixed(2)}</span>
      {d.monthCapUsd != null && (
        <span style={{ marginLeft: "auto", color: "var(--ink-faint)" }}>
          ${d.monthUsedUsd.toFixed(2)} of ${d.monthCapUsd.toFixed(0)} this month
        </span>
      )}
    </div>
  );
}
