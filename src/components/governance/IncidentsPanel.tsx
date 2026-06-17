import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIncidents, type Incident } from "@/lib/incidents.functions";

// P7 · Incidents, read-only "what went wrong" log on the Engine Room: failed
// tool executions and errored auto-pipeline events, newest first. Engine-Room:
// names the outcome ("what went wrong"); each execution incident links to its trace.

const KIND_LABEL: Record<Incident["kind"], string> = {
  execution: "Execution",
  pipeline: "Pipeline",
};

function fmt(at: string | null): string {
  if (!at) return "";
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

export function IncidentsPanel() {
  const fGet = useServerFn(getIncidents);
  const q = useQuery({ queryKey: ["incidents"], queryFn: () => fGet() });
  const items = q.data?.incidents ?? [];

  if (q.isLoading) {
    return (
      <div className="mono-label" style={{ color: "var(--ink-muted)", padding: 8 }}>
        Loading
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label">No incidents</div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8, maxWidth: 460 }}>
          Nothing has gone wrong recently. Failed tool executions and errored auto-pipeline events
          will be recorded here, newest first.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((n) => (
        <div key={n.id} className="bento" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "var(--rose, #dc2626)",
                flexShrink: 0,
              }}
            />
            <span className="mono-label" style={{ color: "var(--rose, #dc2626)" }}>
              {KIND_LABEL[n.kind]}
            </span>
            {fmt(n.at) && (
              <span style={{ fontSize: 12, color: "var(--ink-muted)", marginLeft: "auto" }}>
                {fmt(n.at)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginTop: 6 }}>{n.title}</div>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-muted)",
              marginTop: 4,
              whiteSpace: "pre-wrap",
            }}
          >
            {n.detail}
          </p>
          {n.traceId && (
            <a
              href={`/traces/${n.traceId}`}
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 10, display: "inline-block" }}
            >
              View trace
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
