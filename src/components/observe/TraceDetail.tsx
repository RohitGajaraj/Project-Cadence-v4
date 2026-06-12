// Trace replay drill-down — screen 7 of the Ember Editorial migration, from
// design-reference/cadence/govern-detail.jsx (TraceDetail). Rides ?trace=
// on /govern?tab=traces (tab body only).
// SEAM STUB — replaced by the screen-7 implementation pass.
import { useNavigate } from "@tanstack/react-router";
import { DrillHeader } from "@/components/cadence/Primitives";

export function TraceDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  return (
    <div className="fade-up">
      <DrillHeader
        onBack={() => navigate({ to: "/govern", search: { tab: "traces" } })}
        backLabel="All traces"
        kicker="Trace"
        title={id}
      />
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <span className="mono-label">Loading trace…</span>
      </div>
    </div>
  );
}
