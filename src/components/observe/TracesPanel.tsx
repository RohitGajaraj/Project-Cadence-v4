// Traces tab — ported 1:1 from design-reference/cadence/loop.jsx (GovernScreen,
// tab "Traces"): a bento table (Trace 90px / 1fr / Hops 60px / Tokens 70px /
// Cost 70px / When 110px) with a mono-label header row, the trace id as a blue
// mono button and the title at 500 weight — both opening production's EXISTING
// trace detail/replay at /traces/$traceId (drill-down contract). Production
// functionality kept: real listTraces query with days/status filters as quiet
// mono controls. Reference "Mission" column is corrected to "Surface" — traces
// roll up by root AI surface; missions don't exist on production traces.
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listTraces } from "@/lib/traces.functions";
import { relTime } from "@/components/product/format";

const GRID = "90px 1fr 60px 70px 70px 110px";

function fmtTokens(n: number) {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}
function fmtUsd(n: number) {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

export function TracesPanel() {
  const navigate = useNavigate();
  const fList = useServerFn(listTraces);
  const [days, setDays] = useState(7);
  const [status, setStatus] = useState<"all" | "ok" | "error">("all");

  const traces = useQuery({
    queryKey: ["traces", days, status],
    queryFn: () => fList({ data: { days, status, limit: 100 } }),
  });

  const rows = traces.data?.traces ?? [];

  if (traces.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load traces
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(traces.error as Error).message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => traces.refetch()}
        >
          Retry · reloads traces
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginBottom: 12,
          alignItems: "center",
        }}
      >
        <select
          className="input"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label="Window"
          style={{ width: 76, fontSize: 11, padding: "4px 8px", fontFamily: "var(--font-mono)" }}
        >
          <option value={1}>24h</option>
          <option value={7}>7d</option>
          <option value={14}>14d</option>
          <option value={30}>30d</option>
        </select>
        <select
          className="input"
          value={status}
          onChange={(e) => setStatus(e.target.value as "all" | "ok" | "error")}
          aria-label="Status filter"
          style={{ width: 104, fontSize: 11, padding: "4px 8px", fontFamily: "var(--font-mono)" }}
        >
          <option value="all">all</option>
          <option value="ok">successful</option>
          <option value="error">errors</option>
        </select>
      </div>

      {traces.isLoading ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "32px 0",
            textAlign: "center",
          }}
        >
          Loading traces…
        </div>
      ) : rows.length === 0 ? (
        <div className="bento" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
            No traces in this window. Run an agent or a chat — every AI call lands here as a
            replayable trace.
          </p>
        </div>
      ) : (
        <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div
            className="mono-label"
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 12,
              padding: "10px 18px",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <span>Trace</span>
            <span>Surface</span>
            <span>Hops</span>
            <span>Tokens</span>
            <span>Cost</span>
            <span>When</span>
          </div>
          {rows.map((t, i) => (
            <div
              key={t.trace_id}
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: 12,
                padding: "13px 18px",
                alignItems: "center",
                borderBottom: i < rows.length - 1 ? "1px solid var(--hairline)" : "none",
                fontSize: 13,
              }}
            >
              <Link
                to="/traces/$traceId"
                params={{ traceId: t.trace_id }}
                className="mono-label"
                style={{ color: "var(--action-blue)", textAlign: "left" }}
              >
                {t.trace_id.slice(0, 8)}
              </Link>
              <button
                style={{
                  fontWeight: 500,
                  textAlign: "left",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                onClick={() =>
                  navigate({ to: "/traces/$traceId", params: { traceId: t.trace_id } })
                }
              >
                {t.root_surface}
              </button>
              <span className="tabular-nums" style={{ color: "var(--ink-muted)" }}>
                {t.spans}
              </span>
              <span className="mono-label tabular-nums">{fmtTokens(t.tokens)}</span>
              <span className="mono-label tabular-nums" style={{ color: "var(--ink)" }}>
                {fmtUsd(t.cost)}
              </span>
              <span
                className="mono-label"
                style={{ color: t.errors > 0 ? "var(--rose)" : undefined }}
              >
                {relTime(t.last_at)}
                {t.errors > 0 ? " · failed" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
