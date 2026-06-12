// Drift surface drill-down — screen 7 of the Ember Editorial migration, from
// design-reference/cadence/govern-detail.jsx (DriftDetail). Rides ?surface=
// on /govern?tab=drift (tab body only).
// SEAM STUB — replaced by the screen-7 implementation pass.
import { useNavigate } from "@tanstack/react-router";
import { DrillHeader } from "@/components/cadence/Primitives";

export function DriftSurfaceDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  return (
    <div className="fade-up">
      <DrillHeader
        onBack={() => navigate({ to: "/govern", search: { tab: "drift" } })}
        backLabel="All surfaces"
        kicker="Drift surface"
        title={id}
      />
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <span className="mono-label">Loading drift surface…</span>
      </div>
    </div>
  );
}
