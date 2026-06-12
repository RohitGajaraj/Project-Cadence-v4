// Eval suite drill-down — screen 7 of the Ember Editorial migration, from
// design-reference/cadence/govern-detail.jsx (EvalDetail). Rides ?suite= on
// /govern?tab=evals (tab body only — SurfaceHeader + TabRow stay).
// SEAM STUB — replaced by the screen-7 implementation pass.
import { useNavigate } from "@tanstack/react-router";
import { DrillHeader } from "@/components/cadence/Primitives";

export function EvalSuiteDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  return (
    <div className="fade-up">
      <DrillHeader
        onBack={() => navigate({ to: "/govern", search: { tab: "evals" } })}
        backLabel="All eval suites"
        kicker="Eval suite"
        title={id}
      />
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <span className="mono-label">Loading suite…</span>
      </div>
    </div>
  );
}
