import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getReliabilitySlo, getRunawayMissions } from "@/lib/reliability.functions";
import { summarizeHealth } from "@/lib/reliability/health-view";
import { RunawayMissionsDetail } from "@/components/cockpit/RunawayMissionsDetail";

// R4 (Settings > Health) — the self-serve reliability view. Surfaces the two already-shipped,
// previously-thinly-wired reliability reads (getReliabilitySlo = RELIABILITY-SLO, getRunawayMissions
// = RUNAWAY-DETECT) so an operator can answer "are my agents healthy?" on demand, with the numbers
// below. Unlike the silent-when-healthy Missions glance, this is a deliberate "show me" surface, so
// a healthy window still gets an explicit, reassuring headline (via the pure summarizeHealth roll-up)
// and the SLO numbers always render. The deep mission list + SLO grid are reused from the cockpit
// drill-in (RunawayMissionsDetail) so the two surfaces cannot drift.
// Engine-Room: per-call SLO + per-mission churn -> one calm headline + the numbers on demand in
// Settings > Health -> no mechanism jargon, neutral ink (role-color accents stay reserved).

const WINDOWS = [7, 30] as const;

export function HealthCard() {
  const [days, setDays] = useState<number>(7);
  const fetchSlo = useServerFn(getReliabilitySlo);
  const fetchRunaway = useServerFn(getRunawayMissions);

  // Distinct cache namespace from the cockpit ReliabilityGlance (["reliability-slo"] /
  // ["runaway-missions"]) so prefix-match invalidations on either surface never spuriously
  // refetch the other; this surface also varies by the `days` window toggle.
  const sloQ = useQuery({
    queryKey: ["health-slo", days],
    queryFn: () => fetchSlo({ data: { days } }),
  });
  const runawayQ = useQuery({
    queryKey: ["health-runaway", days],
    queryFn: () => fetchRunaway({ data: { days } }),
  });

  const rollup = summarizeHealth(sloQ.data, runawayQ.data);
  const bothErrored = sloQ.isError && runawayQ.isError;
  const haveData = Boolean(sloQ.data || runawayQ.data);

  let headline: string;
  if (bothErrored) {
    headline = "Reliability data is unavailable right now.";
  } else if (!haveData) {
    headline = "Loading";
  } else {
    headline = rollup.headline;
  }

  return (
    <div className="bento" style={{ padding: 24, maxWidth: 640 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="mono-label">Health</div>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8, maxWidth: 480 }}>
            How your AI calls and agent missions are holding up over the last {days} days.
          </p>
        </div>
        <div role="group" aria-label="Time window" style={{ display: "flex", gap: 4 }}>
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              className="btn btn-ghost btn-sm"
              aria-pressed={days === w}
              onClick={() => setDays(w)}
              style={
                days === w
                  ? { color: "var(--ink)", borderColor: "var(--stroke)" }
                  : { color: "var(--ink-subtle)" }
              }
            >
              {w} days
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 14, color: "var(--ink)" }}>{headline}</div>
      {rollup.signals.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
          {rollup.signals.map((s, i) => (
            <li key={i} style={{ fontSize: 13, color: "var(--ink-subtle)", marginTop: 4 }}>
              {s}
            </li>
          ))}
        </ul>
      )}

      {haveData && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--stroke-faint)" }}>
          <RunawayMissionsDetail runaway={runawayQ.data} slo={sloQ.data} />
        </div>
      )}
    </div>
  );
}
