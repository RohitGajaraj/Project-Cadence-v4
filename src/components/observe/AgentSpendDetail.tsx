// Per-agent spend drill-down — screen 7 of the Ember Editorial migration,
// from design-reference/cadence/govern-detail.jsx (AgentDetail). Rides
// ?agent= on /govern?tab=analytics (tab body only).
// SEAM STUB — replaced by the screen-7 implementation pass.
import { useNavigate } from "@tanstack/react-router";
import { DrillHeader } from "@/components/cadence/Primitives";

export function AgentSpendDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  return (
    <div className="fade-up">
      <DrillHeader
        onBack={() => navigate({ to: "/govern", search: { tab: "analytics" } })}
        backLabel="Analytics"
        kicker="Agent rollup"
        title={id}
      />
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <span className="mono-label">Loading agent rollup…</span>
      </div>
    </div>
  );
}
