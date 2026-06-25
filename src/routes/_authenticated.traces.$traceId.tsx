// Trace replay — screen 7 of the Ember Editorial migration, ported 1:1 from
// design-reference/cadence/govern-detail.jsx (TraceDetail): DrillHeader with
// the "Trace · N hops · tokens · cost" kicker, mission title + "Open mission"
// ghost CTA when the trace resolves to a mission, and the hop table (status
// dot / Agent / Tool call / What happened / Dur / Tokens / Cost). Production
// functionality rides the reference layout: real ai_events spans interleaved
// with tool_calls by created_at, wall time + failure counts in the kicker,
// quiet per-row timing bars with parent-chain indentation, the strategic-brief
// block, and the row-click inspector (model/via/tokens/cost, guardrail hits,
// eval scores, input/system/output previews). The reference's planned/running
// hop states and fabricated narrative prose are omitted — events are written
// post-hoc and every string on screen is a real DB field.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo, type CSSProperties } from "react";
import { ExternalLink, FileText, Shield } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { DrillHeader, MonoLabel } from "@/components/cadence/Primitives";
import { listProjects } from "@/lib/projects.functions";
import { getTrace } from "@/lib/traces.functions";
import { relTime } from "@/components/product/format";
import { useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_authenticated/traces/$traceId")({
  component: TraceReplayPage,
  head: () => ({ meta: [{ title: "Activity · Cadence" }] }),
});

type EventRow = {
  id: string;
  parent_event_id: string | null;
  created_at: string;
  surface: string;
  surface_ref: string | null;
  model: string;
  provider: string;
  via: string;
  status: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  est_cost_usd: number;
  latency_ms: number;
  fallback: boolean;
  input_preview: string | null;
  output_preview: string | null;
  system_preview?: string | null;
  error_message: string | null;
};
type Span = EventRow & { depth: number };
type ToolCallRow = {
  id: string;
  tool_name: string;
  args: unknown;
  result: unknown;
  ok: boolean;
  error: string | null;
  latency_ms: number;
  created_at: string;
};
type HopRow =
  | { kind: "event"; at: number; span: Span }
  | { kind: "tool"; at: number; tool: ToolCallRow };
type GuardrailHit = { rule_name: string; action: string; side: string; matched: string | null };
type EvalRow = {
  relevance: number | null;
  groundedness: number | null;
  coherence: number | null;
  hallucination_score: number | null;
  toxicity: number | null;
  pii_risk: number | null;
};
type Selected = { kind: "event" | "tool"; id: string };

function fmtMs(ms: number) {
  if (ms < 1) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
// Real money — keep the <$0.0001 floor; never round a real cost to a fake $0.
function fmtUsd(n: number) {
  if (n === 0) return "$0";
  if (n < 0.0001) return `<$0.0001`;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}
function clip(s: string, n = 180) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** Depth via the ai_events parent chain — drives the quiet row indentation. */
function withDepth(events: EventRow[]): Span[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  const cache = new Map<string, number>();
  const depthOf = (id: string): number => {
    if (cache.has(id)) return cache.get(id)!;
    const e = byId.get(id);
    if (!e || !e.parent_event_id || !byId.has(e.parent_event_id)) {
      cache.set(id, 0);
      return 0;
    }
    const d = depthOf(e.parent_event_id) + 1;
    cache.set(id, d);
    return d;
  };
  return events.map((e) => ({ ...e, depth: depthOf(e.id) }));
}

// ai_events.status is written post-hoc: only ok / error / blocked exist.
// The reference's planned + running dots have no production counterpart.
const EVENT_DOT: Record<string, string> = {
  ok: "dot-completed",
  error: "dot-failed",
  blocked: "dot-gate",
};

const GRID = "26px 90px 130px 1fr 60px 56px 56px";

const preStyle: CSSProperties = {
  margin: 0,
  marginTop: 6,
  padding: 10,
  borderRadius: 8,
  background: "var(--surface-2)",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  whiteSpace: "pre-wrap",
  maxHeight: 220,
  overflow: "auto",
  color: "var(--ink-muted)",
};

const cellEllipsis: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/* ---------- Selected-hop inspector (production retainer — the reference has
   no inspector; this is the row-click detail pane, restyled quiet Ember). ---------- */

function SpanInspector({
  span,
  hits,
  evalRow,
}: {
  span: Span;
  hits: GuardrailHit[];
  evalRow?: EvalRow;
}) {
  const statusColor =
    span.status === "ok"
      ? "var(--emerald)"
      : span.status === "blocked"
        ? "var(--ember)"
        : "var(--rose)";
  const meta: [string, string][] = [
    ["Model", span.model],
    ["Via", `${span.provider} · ${span.via}${span.fallback ? " · fallback" : ""}`],
    ["Latency", fmtMs(span.latency_ms)],
    ["Tokens", `${span.prompt_tokens} → ${span.completion_tokens}`],
    ["Cost", fmtUsd(Number(span.est_cost_usd))],
  ];
  const evalCells: [string, number | null][] = evalRow
    ? [
        ["Relevance", evalRow.relevance],
        ["Grounded", evalRow.groundedness],
        ["Coherence", evalRow.coherence],
        ["Halluc.", evalRow.hallucination_score],
        ["Toxicity", evalRow.toxicity],
        ["PII risk", evalRow.pii_risk],
      ]
    : [];
  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <MonoLabel>Span · {span.surface}</MonoLabel>
        <code style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-faint)" }}>
          {span.id}
        </code>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginTop: 12,
          fontSize: 12.5,
        }}
      >
        {meta.map(([l, v]) => (
          <div key={l} style={{ minWidth: 0 }}>
            <MonoLabel style={{ marginBottom: 3 }}>{l}</MonoLabel>
            <div style={{ ...cellEllipsis, fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
              {v}
            </div>
          </div>
        ))}
        <div>
          <MonoLabel style={{ marginBottom: 3 }}>Status</MonoLabel>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className={`dot ${EVENT_DOT[span.status] ?? "dot-failed"}`}></span>
            <span style={{ color: statusColor, fontSize: 12.5 }}>{span.status}</span>
          </span>
        </div>
      </div>

      {span.error_message && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid color-mix(in oklab, var(--rose) 35%, transparent)",
            color: "var(--rose)",
            fontSize: 12,
          }}
        >
          {span.error_message}
        </div>
      )}

      {hits.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <MonoLabel icon={Shield} style={{ marginBottom: 6 }}>
            Guardrail hits
          </MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {hits.map((h, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid var(--hairline)",
                  borderRadius: 8,
                  padding: "7px 10px",
                  fontSize: 12.5,
                }}
              >
                <span style={{ fontWeight: 500 }}>{h.rule_name}</span>
                <span className="mono-label" style={{ marginLeft: 8 }}>
                  {h.side} · {h.action}
                </span>
                {h.matched && (
                  <code
                    style={{
                      display: "block",
                      marginTop: 3,
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--ink-subtle)",
                      ...cellEllipsis,
                    }}
                  >
                    {h.matched}
                  </code>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {evalCells.some(([, v]) => v != null) && (
        <div style={{ marginTop: 14 }}>
          <MonoLabel style={{ marginBottom: 6 }}>Eval scores</MonoLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
            {evalCells.map(([k, v]) =>
              v == null ? null : (
                <div
                  key={k}
                  style={{
                    border: "1px solid var(--hairline)",
                    borderRadius: 8,
                    padding: "6px 8px",
                  }}
                >
                  <MonoLabel style={{ marginBottom: 2, fontSize: 8.5 }}>{k}</MonoLabel>
                  <div className="font-display tabular-nums" style={{ fontSize: 16 }}>
                    {Number(v).toFixed(2)}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {span.input_preview && (
        <div style={{ marginTop: 14 }}>
          <MonoLabel>Input</MonoLabel>
          <pre className="scrollbar-thin" style={preStyle}>
            {span.input_preview}
          </pre>
        </div>
      )}
      {span.system_preview && (
        <div style={{ marginTop: 14 }}>
          <MonoLabel>System prompt</MonoLabel>
          <pre className="scrollbar-thin" style={preStyle}>
            {span.system_preview}
          </pre>
        </div>
      )}
      {span.output_preview && (
        <div style={{ marginTop: 14 }}>
          <MonoLabel>Output</MonoLabel>
          <pre className="scrollbar-thin" style={preStyle}>
            {span.output_preview}
          </pre>
        </div>
      )}
    </div>
  );
}

function ToolInspector({ tool }: { tool: ToolCallRow }) {
  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <MonoLabel>Tool call · {tool.tool_name}</MonoLabel>
        <code style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--ink-faint)" }}>
          {tool.id}
        </code>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginTop: 12,
          fontSize: 12.5,
        }}
      >
        <div>
          <MonoLabel style={{ marginBottom: 3 }}>Status</MonoLabel>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className={`dot ${tool.ok ? "dot-completed" : "dot-failed"}`}></span>
            <span style={{ color: tool.ok ? "var(--emerald)" : "var(--rose)", fontSize: 12.5 }}>
              {tool.ok ? "ok" : "failed"}
            </span>
          </span>
        </div>
        <div>
          <MonoLabel style={{ marginBottom: 3 }}>Latency</MonoLabel>
          <div className="tabular-nums">{fmtMs(tool.latency_ms)}</div>
        </div>
        <div>
          <MonoLabel style={{ marginBottom: 3 }}>When</MonoLabel>
          <div>{relTime(tool.created_at)}</div>
        </div>
      </div>
      {tool.error && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid color-mix(in oklab, var(--rose) 35%, transparent)",
            color: "var(--rose)",
            fontSize: 12,
          }}
        >
          {tool.error}
        </div>
      )}
      {tool.args != null && (
        <div style={{ marginTop: 14 }}>
          <MonoLabel>Args</MonoLabel>
          <pre className="scrollbar-thin" style={preStyle}>
            {JSON.stringify(tool.args, null, 2)}
          </pre>
        </div>
      )}
      {tool.result != null && (
        <div style={{ marginTop: 14 }}>
          <MonoLabel>Result</MonoLabel>
          <pre className="scrollbar-thin" style={preStyle}>
            {JSON.stringify(tool.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ---------- TraceDetail — the drill body (reference anatomy). Takes { id }
   per the screen-6/7 drill contract: the route passes the id. ---------- */

export function TraceDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const fGet = useServerFn(getTrace);
  const trace = useQuery({
    queryKey: ["trace", id],
    queryFn: () => fGet({ data: { traceId: id } }),
  });

  const [selected, setSelected] = useState<Selected | null>(null);

  const spans = useMemo(() => withDepth((trace.data?.events ?? []) as EventRow[]), [trace.data]);
  const toolCalls = useMemo(() => (trace.data?.toolCalls ?? []) as ToolCallRow[], [trace.data]);

  // Interleave LLM spans and tool calls strictly by created_at — the loop
  // never writes tool_calls.event_id, so time order is the only honest join.
  const hopRows = useMemo<HopRow[]>(() => {
    const rows: HopRow[] = [
      ...spans.map((s) => ({
        kind: "event" as const,
        at: new Date(s.created_at).getTime(),
        span: s,
      })),
      ...toolCalls.map((t) => ({
        kind: "tool" as const,
        at: new Date(t.created_at).getTime(),
        tool: t,
      })),
    ];
    rows.sort((a, b) => a.at - b.at);
    return rows;
  }, [spans, toolCalls]);

  // Wall-clock timeline across both row kinds — drives the quiet timing bars.
  const t0 = hopRows.length ? Math.min(...hopRows.map((r) => r.at)) : 0;
  const tEnd = hopRows.length
    ? Math.max(
        ...hopRows.map(
          (r) => r.at + ((r.kind === "event" ? r.span.latency_ms : r.tool.latency_ms) || 0),
        ),
      )
    : 0;
  const totalMs = Math.max(1, tEnd - t0);

  // Auto-select the root span once events load so the inspector isn't empty.
  useEffect(() => {
    if (!selected && spans.length > 0) setSelected({ kind: "event", id: spans[0].id });
  }, [spans, selected]);

  // Pull the brief block out of the first agent system prompt, if present.
  const briefBlock = useMemo(() => {
    const root = spans.find((s) => s.system_preview);
    const sys = root?.system_preview ?? "";
    const m = sys.match(/--- Workspace Strategic Brief[\s\S]*?--- End brief ---/);
    return m ? m[0] : null;
  }, [spans]);

  const hitsByEvent = new Map<string, GuardrailHit[]>();
  for (const h of trace.data?.hits ?? []) {
    const arr = hitsByEvent.get(h.event_id) ?? [];
    arr.push(h);
    hitsByEvent.set(h.event_id, arr);
  }
  const evalsByEvent = new Map(trace.data?.evals.map((e) => [e.event_id, e]) ?? []);

  const totals = {
    tokens: spans.reduce((n, s) => n + (s.total_tokens || 0), 0),
    cost: spans.reduce((n, s) => n + Number(s.est_cost_usd || 0), 0),
    failed:
      spans.filter((s) => s.status === "error").length + toolCalls.filter((t) => !t.ok).length,
    gated: spans.filter((s) => s.status === "blocked").length,
  };

  const mission = trace.data?.mission ?? null;
  const rootSurface = spans[0]?.surface ?? null;
  // Only agent-surface spans carry an agent slug in surface_ref; tool rows
  // (agent_id uuid only) ride under the trace's agent slug.
  const traceAgentSlug =
    spans.find((s) => s.surface === "agent" && s.surface_ref)?.surface_ref ?? null;

  const back = () => navigate({ to: "/govern", search: { tab: "traces" } });

  if (trace.isLoading) {
    return (
      <div
        className="mono-label"
        style={{ padding: "48px 0", textAlign: "center", color: "var(--ink-faint)" }}
      >
        Loading trace…
      </div>
    );
  }

  if (trace.error) {
    return (
      <div className="fade-up">
        <DrillHeader onBack={back} backLabel="All traces" kicker="Trace" title={id.slice(0, 8)} />
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <div className="mono-label" style={{ color: "var(--rose)" }}>
            Couldn't load this trace
          </div>
          <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: "8px 0 0" }}>
            {(trace.error as Error).message}
          </p>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 14 }}
            onClick={() => trace.refetch()}
          >
            Retry · reloads the trace
          </button>
        </div>
      </div>
    );
  }

  if (hopRows.length === 0) {
    return (
      <div className="fade-up">
        <DrillHeader onBack={back} backLabel="All traces" kicker="Trace" title={id.slice(0, 8)} />
        <div
          className="bento"
          style={{
            padding: "var(--card-pad)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span className="mono-label" style={{ flex: 1 }}>
            No spans recorded for this trace — it may have expired or belong to another account.
          </span>
          <button className="btn btn-ghost btn-sm" onClick={back}>
            Back · all traces
          </button>
        </div>
      </div>
    );
  }

  const selRow: HopRow | null = selected
    ? (hopRows.find((r) =>
        selected.kind === "event"
          ? r.kind === "event" && r.span.id === selected.id
          : r.kind === "tool" && r.tool.id === selected.id,
      ) ?? null)
    : null;

  return (
    <div className="fade-up">
      <DrillHeader
        onBack={back}
        backLabel="All traces"
        kicker={
          <>
            Trace · {hopRows.length} {hopRows.length === 1 ? "hop" : "hops"} ·{" "}
            {totals.tokens.toLocaleString()} tokens · {fmtUsd(totals.cost)} · {fmtMs(totalMs)} wall
            {totals.failed > 0 && (
              <span style={{ color: "var(--rose)" }}> · {totals.failed} failed</span>
            )}
            {totals.gated > 0 && (
              <span style={{ color: "var(--ember)" }}> · {totals.gated} gated</span>
            )}
          </>
        }
        title={mission ? mission.title : `${rootSurface ?? "trace"} · ${id.slice(0, 8)}`}
        right={
          mission ? (
            <Link
              to="/missions/$missionId"
              params={{ missionId: mission.id }}
              className="btn btn-ghost btn-sm"
            >
              <ExternalLink size={11} />
              Open mission
            </Link>
          ) : null
        }
      />

      {briefBlock && (
        <div className="bento" style={{ padding: "var(--card-pad)", marginBottom: 14 }}>
          <MonoLabel icon={FileText} style={{ marginBottom: 4 }}>
            Workspace strategic brief · injected into system prompt
          </MonoLabel>
          <pre className="scrollbar-thin" style={{ ...preStyle, maxHeight: 180 }}>
            {briefBlock}
          </pre>
        </div>
      )}

      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
        <div
          className="mono-label"
          style={{
            display: "grid",
            gridTemplateColumns: GRID,
            gap: 10,
            padding: "10px 18px",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <span></span>
          <span>Agent</span>
          <span>Tool call</span>
          <span>What happened</span>
          <span>Dur</span>
          <span>Tokens</span>
          <span>Cost</span>
        </div>
        {hopRows.map((r, i) => {
          const isLast = i === hopRows.length - 1;
          const isSel =
            selected != null &&
            (r.kind === "event"
              ? selected.kind === "event" && r.span.id === selected.id
              : selected.kind === "tool" && r.tool.id === selected.id);
          const latency = (r.kind === "event" ? r.span.latency_ms : r.tool.latency_ms) || 0;
          const left = ((r.at - t0) / totalMs) * 100;
          const width = Math.max(0.5, (latency / totalMs) * 100);
          const hits = r.kind === "event" ? (hitsByEvent.get(r.span.id) ?? []) : [];
          return (
            <button
              key={r.kind === "event" ? r.span.id : r.tool.id}
              onClick={() =>
                setSelected({ kind: r.kind, id: r.kind === "event" ? r.span.id : r.tool.id })
              }
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: 10,
                padding: "12px 18px",
                alignItems: "center",
                width: "100%",
                textAlign: "left",
                fontSize: 12.5,
                borderBottom: isLast ? "none" : "1px solid var(--hairline)",
                background: isSel ? "var(--surface-2)" : "transparent",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  className={`dot ${
                    r.kind === "event"
                      ? (EVENT_DOT[r.span.status] ?? "dot-failed")
                      : r.tool.ok
                        ? "dot-completed"
                        : "dot-failed"
                  }`}
                ></span>
              </span>
              {r.kind === "event" ? (
                <>
                  <span
                    className="mono-label"
                    style={{
                      ...cellEllipsis,
                      paddingLeft: r.span.depth * 10,
                      color: r.span.surface === "agent" ? "var(--agent)" : "var(--ink-muted)",
                    }}
                  >
                    {r.span.surface === "agent" && r.span.surface_ref
                      ? r.span.surface_ref
                      : `${r.span.surface}${r.span.surface_ref ? `·${r.span.surface_ref.slice(0, 8)}` : ""}`}
                  </span>
                  <span
                    className="mono-label"
                    style={{ ...cellEllipsis, color: "var(--ink-muted)" }}
                  >
                    {r.span.model}
                  </span>
                  <span
                    style={{
                      ...cellEllipsis,
                      color:
                        r.span.status === "error"
                          ? "var(--rose)"
                          : r.span.status === "blocked"
                            ? "var(--ember)"
                            : r.span.output_preview
                              ? "var(--ink-muted)"
                              : "var(--ink-faint)",
                      fontWeight: r.span.status === "blocked" ? 550 : 400,
                    }}
                  >
                    {r.span.status !== "ok" && r.span.error_message
                      ? clip(r.span.error_message)
                      : r.span.output_preview
                        ? clip(r.span.output_preview)
                        : "-"}
                    {hits.length > 0 && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          marginLeft: 8,
                          color: "var(--saffron)",
                        }}
                      >
                        <Shield size={11} /> {hits.length}
                      </span>
                    )}
                  </span>
                  <span className="mono-label tabular-nums">{fmtMs(r.span.latency_ms)}</span>
                  <span className="mono-label tabular-nums">
                    {(r.span.total_tokens || 0).toLocaleString()}
                  </span>
                  <span className="mono-label tabular-nums" style={{ color: "var(--ink)" }}>
                    {fmtUsd(Number(r.span.est_cost_usd))}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="mono-label"
                    style={{
                      ...cellEllipsis,
                      color: traceAgentSlug ? "var(--agent)" : "var(--ink-faint)",
                    }}
                  >
                    {traceAgentSlug ?? "-"}
                  </span>
                  <span
                    className="mono-label"
                    style={{ ...cellEllipsis, color: "var(--ink-muted)" }}
                  >
                    {r.tool.tool_name}
                  </span>
                  <span
                    style={{
                      ...cellEllipsis,
                      color: r.tool.ok ? "var(--ink-muted)" : "var(--rose)",
                    }}
                  >
                    {!r.tool.ok && r.tool.error
                      ? clip(r.tool.error)
                      : (r.tool.result ?? r.tool.args) != null
                        ? clip(JSON.stringify(r.tool.result ?? r.tool.args))
                        : "-"}
                  </span>
                  <span className="mono-label tabular-nums">{fmtMs(r.tool.latency_ms)}</span>
                  <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
                    -
                  </span>
                  <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
                    -
                  </span>
                </>
              )}
              {/* Quiet wall-clock timing bar — production waterfall retainer. */}
              <span
                aria-hidden="true"
                style={{
                  gridColumn: "1 / -1",
                  position: "relative",
                  display: "block",
                  height: 2,
                  marginTop: 6,
                }}
              >
                <span
                  title={`+${fmtMs(r.at - t0)} · ${fmtMs(latency)}`}
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    width: `${width}%`,
                    top: 0,
                    height: "100%",
                    borderRadius: 99,
                    background: "var(--ink-faint)",
                    opacity: 0.45,
                  }}
                ></span>
              </span>
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 10 }}>
        Showing every LLM span and tool call on this trace, in wall-clock order. Previews are
        truncated — select a hop for the full input, system prompt, and output.
        {mission && (
          <>
            {" "}
            Reasoning steps between calls live on{" "}
            <Link
              to="/missions/$missionId"
              params={{ missionId: mission.id }}
              style={{ color: "var(--action-blue)" }}
            >
              the mission transcript
            </Link>
            .
          </>
        )}
      </p>

      {selRow && (
        <div className="bento" style={{ padding: "var(--card-pad)", marginTop: 14 }}>
          {selRow.kind === "event" ? (
            <SpanInspector
              span={selRow.span}
              hits={hitsByEvent.get(selRow.span.id) ?? []}
              evalRow={evalsByEvent.get(selRow.span.id)}
            />
          ) : (
            <ToolInspector tool={selRow.tool} />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Route shell — AppShell + TopBar around the drill body. ---------- */

function TraceReplayPage() {
  const { traceId } = Route.useParams();
  const fProjects = useServerFn(listProjects);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const { activeWorkspace } = useWorkspace();

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Traces", traceId.slice(0, 8)]} />
      <div
        data-screen-label="Trace replay"
        style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}
      >
        <TraceDetail id={traceId} />
      </div>
    </AppShell>
  );
}
