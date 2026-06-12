import type { StudioRunDetail } from "@/lib/studio.functions";
import { MonoLabel } from "@/components/cadence/Primitives";
import { StatusChip } from "./studio-ui";
import { fmtCost } from "./studio-format";

/** Cost tab — per-run model, status, tokens, and cost, with the session total. */
export function CostPanel({ runs, total }: { runs: StudioRunDetail[]; total: number }) {
  if (runs.length === 0) {
    return (
      <div
        style={{
          border: "1px dashed var(--hairline)",
          borderRadius: 12,
          padding: "48px 0",
          textAlign: "center",
          fontSize: 12.5,
          color: "var(--ink-faint)",
        }}
      >
        No runs yet, so nothing spent.
      </div>
    );
  }
  return (
    <div className="bento" style={{ padding: "var(--card-pad)" }}>
      <MonoLabel>Spend by run</MonoLabel>
      <div style={{ marginTop: 8 }}>
        {runs.map((r, i) => (
          <div
            key={r.run_id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 0",
              borderBottom: i < runs.length - 1 ? "1px solid var(--hairline)" : "none",
            }}
          >
            <span
              className="mono-label tabular-nums"
              style={{ width: 18, textAlign: "right", flexShrink: 0 }}
            >
              {i + 1}
            </span>
            <span
              className="truncate"
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--ink-muted)",
              }}
            >
              {r.model ?? "default model"}
            </span>
            <StatusChip status={r.status} />
            <span
              className="tabular-nums"
              style={{
                width: 84,
                textAlign: "right",
                flexShrink: 0,
                fontSize: 11.5,
                color: "var(--ink-muted)",
              }}
            >
              {r.tokens.toLocaleString()} tok
            </span>
            <span
              className="tabular-nums"
              style={{
                width: 64,
                textAlign: "right",
                flexShrink: 0,
                fontSize: 11.5,
                color: "var(--ink)",
              }}
            >
              {fmtCost(r.cost_usd)}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginTop: 2,
          paddingTop: 10,
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <MonoLabel>Session total</MonoLabel>
        <span
          className="tabular-nums"
          style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}
        >
          {fmtCost(total)}
        </span>
      </div>
    </div>
  );
}
