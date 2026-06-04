import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Shield, AlertTriangle, CheckCircle2, Loader2, FileText } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { getTrace } from "@/lib/traces.functions";

export const Route = createFileRoute("/_authenticated/traces/$traceId")({
  component: TraceDetail,
  head: () => ({ meta: [{ title: "Trace · Cadence" }] }),
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
type Span = EventRow & { depth: number; offset_ms: number };

function fmtMs(ms: number) {
  if (ms < 1) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
function fmtUsd(n: number) {
  if (n === 0) return "$0";
  if (n < 0.0001) return `<$0.0001`;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

function buildSpans(events: EventRow[]): { spans: Span[]; totalMs: number; t0: number } {
  if (events.length === 0) return { spans: [], totalMs: 0, t0: 0 };
  const t0 = new Date(events[0].created_at).getTime();
  const tEnd = Math.max(
    ...events.map((e) => new Date(e.created_at).getTime() + (e.latency_ms || 0)),
  );
  const totalMs = Math.max(1, tEnd - t0);

  // depth via parent chain
  const byId = new Map(events.map((e) => [e.id, e]));
  const depthCache = new Map<string, number>();
  const depthOf = (id: string): number => {
    if (depthCache.has(id)) return depthCache.get(id)!;
    const e = byId.get(id);
    if (!e || !e.parent_event_id || !byId.has(e.parent_event_id)) {
      depthCache.set(id, 0); return 0;
    }
    const d = depthOf(e.parent_event_id) + 1;
    depthCache.set(id, d); return d;
  };

  const spans: Span[] = events.map((e) => ({
    ...e,
    depth: depthOf(e.id),
    offset_ms: new Date(e.created_at).getTime() - t0,
  }));
  // Sort by start time, parents already first by created_at
  spans.sort((a, b) => a.offset_ms - b.offset_ms);
  return { spans, totalMs, t0 };
}

const SURFACE_COLORS: Record<string, string> = {
  agent: "bg-violet-500/80",
  chat: "bg-sky-500/80",
  copilot: "bg-cyan-500/80",
  prd: "bg-emerald-500/80",
  discovery: "bg-amber-500/80",
  studio: "bg-fuchsia-500/80",
  brief: "bg-indigo-500/80",
  eval: "bg-orange-500/80",
  judge: "bg-rose-500/80",
  embed: "bg-teal-500/80",
  scheduler: "bg-lime-500/80",
  test: "bg-slate-500/80",
};

function TraceDetail() {
  const { traceId } = Route.useParams();
  const fProjects = useServerFn(listProjects);
  const fGet = useServerFn(getTrace);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const trace = useQuery({
    queryKey: ["trace", traceId],
    queryFn: () => fGet({ data: { traceId } }),
  });

  const [selected, setSelected] = useState<string | null>(null);

  const { spans, totalMs } = buildSpans((trace.data?.events ?? []) as EventRow[]);

  // Auto-select the first (root) span once events load so the detail pane
  // isn't empty when arriving via the Open link.
  useEffect(() => {
    if (!selected && spans.length > 0) setSelected(spans[0].id);
  }, [spans, selected]);

  // Pull the brief block out of the first agent system prompt, if present.
  const briefBlock = useMemo(() => {
    const root = spans.find((s) => s.system_preview);
    const sys = root?.system_preview ?? "";
    const m = sys.match(/--- Workspace Strategic Brief[\s\S]*?--- End brief ---/);
    return m ? m[0] : null;
  }, [spans]);

  const hitsByEvent = new Map<string, { rule_name: string; action: string; side: string; matched: string | null }[]>();
  for (const h of trace.data?.hits ?? []) {
    const arr = hitsByEvent.get(h.event_id) ?? [];
    arr.push(h); hitsByEvent.set(h.event_id, arr);
  }
  const evalsByEvent = new Map(trace.data?.evals.map((e) => [e.event_id, e]) ?? []);

  const totals = spans.reduce(
    (acc, s) => ({
      tokens: acc.tokens + (s.total_tokens || 0),
      cost: acc.cost + Number(s.est_cost_usd || 0),
      errors: acc.errors + (s.status === "ok" ? 0 : 1),
    }),
    { tokens: 0, cost: 0, errors: 0 },
  );

  const sel = selected ? spans.find((s) => s.id === selected) : null;
  const selHits = sel ? hitsByEvent.get(sel.id) ?? [] : [];
  const selEval = sel ? evalsByEvent.get(sel.id) : undefined;

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link to="/traces" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> All traces
            </Link>
            <h1 className="mt-1 font-display text-2xl tracking-tight">Trace</h1>
            <code className="text-[11px] text-muted-foreground font-mono">{traceId}</code>
          </div>
          <div className="flex gap-6 text-right text-xs">
            <div><div className="text-muted-foreground">Spans</div><div className="font-display text-lg">{spans.length}</div></div>
            <div><div className="text-muted-foreground">Wall time</div><div className="font-display text-lg">{fmtMs(totalMs)}</div></div>
            <div><div className="text-muted-foreground">Tokens</div><div className="font-display text-lg">{totals.tokens.toLocaleString()}</div></div>
            <div><div className="text-muted-foreground">Cost</div><div className="font-display text-lg">{fmtUsd(totals.cost)}</div></div>
            {totals.errors > 0 && (
              <div><div className="text-muted-foreground">Errors</div><div className="font-display text-lg text-rose-300">{totals.errors}</div></div>
            )}
          </div>
        </div>

        {trace.isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : spans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
            No spans in this trace.
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {briefBlock && (
              <div className="col-span-12 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-indigo-300 mb-2">
                  <FileText className="h-3 w-3" /> Workspace Strategic Brief — injected into system prompt
                </div>
                <pre className="text-[11px] whitespace-pre-wrap font-mono text-muted-foreground max-h-48 overflow-auto">{briefBlock}</pre>
              </div>
            )}
            <div className="col-span-12 lg:col-span-8 rounded-xl border border-border bg-background/40 overflow-hidden">
              <div className="border-b border-border px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground flex justify-between">
                <span>Waterfall</span>
                <span>0ms — {fmtMs(totalMs)}</span>
              </div>
              <div className="divide-y divide-border/50">
                {spans.map((s) => {
                  const left = (s.offset_ms / totalMs) * 100;
                  const width = Math.max(0.5, ((s.latency_ms || 0) / totalMs) * 100);
                  const color = SURFACE_COLORS[s.surface] ?? "bg-muted-foreground";
                  const isSel = selected === s.id;
                  const hits = hitsByEvent.get(s.id) ?? [];
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelected(s.id)}
                      className={`w-full text-left px-4 py-2 hover:bg-muted/30 transition ${isSel ? "bg-muted/40" : ""}`}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span style={{ paddingLeft: `${s.depth * 12}px` }} className="font-mono text-muted-foreground truncate min-w-[140px]">
                          {s.surface}{s.surface_ref ? `·${s.surface_ref.slice(0, 8)}` : ""}
                        </span>
                        <span className="text-muted-foreground truncate flex-1 min-w-0">{s.model}</span>
                        {hits.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-amber-300">
                            <Shield className="h-3 w-3" /> {hits.length}
                          </span>
                        )}
                        {s.status === "ok" ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                        )}
                        <span className="tabular-nums text-muted-foreground w-16 text-right">{fmtMs(s.latency_ms)}</span>
                        <span className="tabular-nums text-muted-foreground w-16 text-right">{s.total_tokens}t</span>
                        <span className="tabular-nums text-muted-foreground w-16 text-right">{fmtUsd(Number(s.est_cost_usd))}</span>
                      </div>
                      <div className="relative mt-1.5 h-2 rounded bg-muted/40 overflow-hidden">
                        <div
                          className={`absolute top-0 h-full rounded ${color}`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`+${fmtMs(s.offset_ms)} · ${fmtMs(s.latency_ms)}`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="col-span-12 lg:col-span-4 rounded-xl border border-border bg-background/40 p-4 space-y-3">
              {!sel ? (
                <div className="text-center text-xs text-muted-foreground py-12">
                  Select a span to inspect its prompt, response, guardrail hits, and eval scores.
                </div>
              ) : (
                <>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Span</div>
                    <div className="font-display text-base">{sel.surface}</div>
                    <code className="text-[10px] text-muted-foreground font-mono">{sel.id}</code>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><div className="text-muted-foreground">Model</div><div className="font-mono truncate">{sel.model}</div></div>
                    <div><div className="text-muted-foreground">Via</div><div className="font-mono">{sel.via}{sel.fallback ? " (fallback)" : ""}</div></div>
                    <div><div className="text-muted-foreground">Latency</div><div>{fmtMs(sel.latency_ms)}</div></div>
                    <div><div className="text-muted-foreground">Tokens</div><div>{sel.prompt_tokens} → {sel.completion_tokens}</div></div>
                    <div><div className="text-muted-foreground">Cost</div><div>{fmtUsd(Number(sel.est_cost_usd))}</div></div>
                    <div><div className="text-muted-foreground">Status</div><div className={sel.status === "ok" ? "text-emerald-300" : "text-rose-300"}>{sel.status}</div></div>
                  </div>

                  {sel.error_message && (
                    <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
                      {sel.error_message}
                    </div>
                  )}

                  {selHits.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Guardrail hits
                      </div>
                      <ul className="space-y-1">
                        {selHits.map((h, i) => (
                          <li key={i} className="text-xs rounded border border-border/60 px-2 py-1">
                            <span className="font-medium">{h.rule_name}</span>
                            <span className="ml-2 text-muted-foreground">{h.side} · {h.action}</span>
                            {h.matched && <code className="block mt-0.5 text-[10px] font-mono truncate">{h.matched}</code>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selEval && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Eval scores</div>
                      <div className="grid grid-cols-3 gap-1 text-[11px]">
                        {([
                          ["Relevance", selEval.relevance],
                          ["Grounded", selEval.groundedness],
                          ["Coherence", selEval.coherence],
                          ["Halluc.", selEval.hallucination_score],
                          ["Toxicity", selEval.toxicity],
                          ["PII risk", selEval.pii_risk],
                        ] as const).map(([k, v]) => v == null ? null : (
                          <div key={k} className="rounded border border-border/60 px-1.5 py-1">
                            <div className="text-muted-foreground">{k}</div>
                            <div className="font-display">{Number(v).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sel.input_preview && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Input</div>
                      <pre className="rounded bg-muted/40 p-2 text-[11px] max-h-40 overflow-auto whitespace-pre-wrap">{sel.input_preview}</pre>
                    </div>
                  )}
                  {sel.system_preview && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">System prompt</div>
                      <pre className="rounded bg-muted/40 p-2 text-[11px] max-h-60 overflow-auto whitespace-pre-wrap">{sel.system_preview}</pre>
                    </div>
                  )}
                  {sel.output_preview && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Output</div>
                      <pre className="rounded bg-muted/40 p-2 text-[11px] max-h-40 overflow-auto whitespace-pre-wrap">{sel.output_preview}</pre>
                    </div>
                  )}
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}