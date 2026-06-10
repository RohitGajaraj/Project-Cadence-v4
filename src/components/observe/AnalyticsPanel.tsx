import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  DollarSign,
  Gauge,
  Shield,
  Zap,
  ChevronRight,
  X,
} from "lucide-react";
import {
  getAnalyticsOverview,
  listAiEvents,
  getEventDetail,
  getGuardrailStats,
} from "@/lib/analytics.functions";

function fmtUsd(n: number) {
  return `$${n.toFixed(n < 0.01 ? 5 : 4)}`;
}
function fmtNum(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
function scoreColor(s: number | null | undefined) {
  if (s == null) return "text-muted-foreground";
  if (s >= 0.8) return "text-emerald-400";
  if (s >= 0.5) return "text-amber-300";
  return "text-rose-400";
}

export function AnalyticsPanel() {
  const fOverview = useServerFn(getAnalyticsOverview);
  const fEvents = useServerFn(listAiEvents);
  const fDetail = useServerFn(getEventDetail);
  const fGuards = useServerFn(getGuardrailStats);

  const [days, setDays] = useState(7);
  const [tab, setTab] = useState<"overview" | "surface" | "model" | "runs" | "guardrails">(
    "overview",
  );
  const [openId, setOpenId] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["analytics-overview", days],
    queryFn: () => fOverview({ data: { days } }),
  });
  const events = useQuery({
    queryKey: ["analytics-events"],
    queryFn: () => fEvents({ data: { limit: 100 } }),
    enabled: tab === "runs",
  });
  const guards = useQuery({
    queryKey: ["analytics-guards"],
    queryFn: () => fGuards(),
    enabled: tab === "guardrails",
  });
  const detail = useQuery({
    queryKey: ["event-detail", openId],
    queryFn: () => fDetail({ data: { eventId: openId! } }),
    enabled: !!openId,
  });

  const s = overview.data?.summary;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border hairline bg-background/60 text-sm px-3 py-2"
        >
          <option value={1}>24 hours</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      <div className="flex gap-1 mb-6 border-b hairline">
        {[
          { id: "overview", label: "Overview" },
          { id: "surface", label: "By surface" },
          { id: "model", label: "By model" },
          { id: "runs", label: "Runs" },
          { id: "guardrails", label: "Guardrails" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as never)}
            className={`px-3 py-2 text-xs border-b-2 -mb-px ${tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi icon={Zap} label="Runs" value={fmtNum(s?.totalRuns ?? 0)} />
          <Kpi
            icon={AlertTriangle}
            label="Errors"
            value={String(s?.errors ?? 0)}
            tone={(s?.errors ?? 0) > 0 ? "warn" : "ok"}
          />
          <Kpi icon={Gauge} label="Avg latency" value={`${s?.avgLatency ?? 0} ms`} />
          <Kpi icon={Clock} label="p95 latency" value={`${s?.p95Latency ?? 0} ms`} />
          <Kpi icon={DollarSign} label="Spend" value={fmtUsd(s?.totalCost ?? 0)} />
          <Kpi icon={Activity} label="Tokens" value={fmtNum(s?.totalTokens ?? 0)} />

          <section className="bento p-5 col-span-full">
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-3">
              Daily activity
            </div>
            <DailyBars data={overview.data?.daily ?? []} />
          </section>
        </div>
      )}

      {tab === "surface" && (
        <div className="bento p-4">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-4">Surface</th>
                <th>Runs</th>
                <th>Errors</th>
                <th>Tokens</th>
                <th>Spend</th>
              </tr>
            </thead>
            <tbody>
              {(overview.data?.bySurface ?? []).map((r) => (
                <tr key={r.surface} className="border-t hairline">
                  <td className="py-2 pr-4 font-medium">{r.surface}</td>
                  <td>{r.runs}</td>
                  <td className={r.errors > 0 ? "text-amber-300" : ""}>{r.errors}</td>
                  <td>{fmtNum(r.tokens)}</td>
                  <td>{fmtUsd(r.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "model" && (
        <div className="bento p-4">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-4">Model</th>
                <th>Runs</th>
                <th>Tokens</th>
                <th>Spend</th>
              </tr>
            </thead>
            <tbody>
              {(overview.data?.byModel ?? []).map((r) => (
                <tr key={r.model} className="border-t hairline">
                  <td className="py-2 pr-4 font-mono text-xs">{r.model}</td>
                  <td>{r.runs}</td>
                  <td>{fmtNum(r.tokens)}</td>
                  <td>{fmtUsd(r.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "runs" && (
        <div className="bento divide-y divide-white/5">
          {(events.data?.events ?? []).map((e) => (
            <button
              key={e.id}
              onClick={() => setOpenId(e.id)}
              className="w-full text-left p-3 flex items-center gap-3 hover:bg-secondary/30"
            >
              <span
                className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${e.status === "ok" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-300"}`}
              >
                {e.status}
              </span>
              <span className="text-[11px] text-muted-foreground w-20 shrink-0">{e.surface}</span>
              <span className="font-mono text-[11px] text-muted-foreground truncate flex-1">
                {(e.input_preview ?? "").slice(0, 100)}
              </span>
              <span className="text-[11px] text-muted-foreground">{e.total_tokens}t</span>
              <span className="text-[11px] text-muted-foreground">{e.latency_ms}ms</span>
              <span className="text-[11px]">{fmtUsd(Number(e.est_cost_usd))}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ))}
          {events.isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {!events.isLoading && (events.data?.events ?? []).length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">
              No AI events yet. Run an agent or chat first.
            </div>
          )}
        </div>
      )}

      {tab === "guardrails" && (
        <div className="bento p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-3 flex items-center gap-2">
            <Shield className="h-3.5 w-3.5" /> Last 30 days
          </div>
          {(guards.data?.hits ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground">
              No guardrail hits. Inputs and outputs have been clean.
            </div>
          )}
          <ul className="space-y-2">
            {(guards.data?.hits ?? []).map((h, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span
                  className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${h.action === "block" ? "bg-rose-500/10 text-rose-300" : h.action === "redact" ? "bg-amber-500/10 text-amber-300" : "bg-cyan-500/10 text-cyan-300"}`}
                >
                  {h.action}
                </span>
                <span className="flex-1">{h.name}</span>
                <span className="text-muted-foreground">{h.count}×</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {openId && (
        <Drawer onClose={() => setOpenId(null)}>
          {detail.isLoading || !detail.data ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <EventDetail data={detail.data} />
          )}
        </Drawer>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="bento p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <div className="text-[10px] uppercase tracking-[0.14em]">{label}</div>
      </div>
      <div className={`mt-2 font-display text-2xl ${tone === "warn" ? "text-amber-300" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function DailyBars({ data }: { data: { day: string; runs: number; cost: number }[] }) {
  if (data.length === 0)
    return <div className="text-sm text-muted-foreground">No activity yet.</div>;
  const max = Math.max(...data.map((d) => d.runs), 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d) => (
        <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
          <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
            {d.runs}
          </div>
          <div
            className="w-full rounded-t bg-gradient-to-t from-violet-500/40 to-cyan-400/60"
            style={{ height: `${(d.runs / max) * 100}%` }}
          />
          <div className="text-[10px] text-muted-foreground">{d.day.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-background border-l hairline z-50 overflow-auto p-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </aside>
    </>
  );
}

type EventDetailData = {
  event: {
    id: string;
    created_at: string;
    surface: string;
    model: string;
    via: string;
    status: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    est_cost_usd: number;
    latency_ms: number;
    input_preview: string | null;
    output_preview: string | null;
    error_message: string | null;
  } | null;
  eval: {
    hallucination_score: number | null;
    groundedness: number | null;
    relevance: number | null;
    coherence: number | null;
    toxicity: number | null;
    judge_rationale: string | null;
    unsupported_claims: unknown;
  } | null;
  guardrailHits: { rule_name: string; side: string; action: string; matched: string | null }[];
  feedback: { rating: number; comment: string | null }[];
};

function EventDetail({ data }: { data: EventDetailData }) {
  const e = data.event;
  if (!e) return <div>Event not found.</div>;
  const ev = data.eval;
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">AI event</div>
        <div className="mt-1 font-display text-lg">
          {e.surface} · <span className="font-mono text-sm">{e.model}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {new Date(e.created_at).toLocaleString()} · via {e.via}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs">
        <Stat label="Tokens" value={`${e.prompt_tokens}/${e.completion_tokens}`} />
        <Stat label="Latency" value={`${e.latency_ms}ms`} />
        <Stat label="Cost" value={fmtUsd(Number(e.est_cost_usd))} />
        <Stat label="Status" value={e.status} />
      </div>

      {ev && (
        <div className="bento p-4 space-y-2">
          <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Quality scores
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Score label="Hallucination" v={ev.hallucination_score} invert />
            <Score label="Groundedness" v={ev.groundedness} />
            <Score label="Relevance" v={ev.relevance} />
            <Score label="Coherence" v={ev.coherence} />
            <Score label="Toxicity" v={ev.toxicity} invert />
          </div>
          {ev.judge_rationale && (
            <div className="text-xs text-muted-foreground italic pt-2 border-t hairline">
              {ev.judge_rationale}
            </div>
          )}
        </div>
      )}

      {data.guardrailHits.length > 0 && (
        <div className="bento p-4 space-y-2">
          <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Guardrails
          </div>
          {data.guardrailHits.map((h, i) => (
            <div key={i} className="text-xs flex gap-2">
              <span className="uppercase">{h.action}</span>
              <span>{h.rule_name}</span>
              <span className="text-muted-foreground">({h.side})</span>
            </div>
          ))}
        </div>
      )}

      <div className="bento p-4">
        <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-2">Input</div>
        <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
          {e.input_preview ?? "(empty)"}
        </pre>
      </div>
      <div className="bento p-4">
        <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-2">Output</div>
        <pre className="text-xs whitespace-pre-wrap font-mono">{e.output_preview ?? "(empty)"}</pre>
      </div>
      {e.error_message && (
        <div className="bento p-4 border border-rose-500/30">
          <div className="text-xs uppercase tracking-[0.14em] text-rose-300 mb-2">Error</div>
          <pre className="text-xs whitespace-pre-wrap font-mono text-rose-200">
            {e.error_message}
          </pre>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bento p-2 text-center">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="text-sm mt-1">{value}</div>
    </div>
  );
}
function Score({ label, v, invert }: { label: string; v: number | null; invert?: boolean }) {
  const display = invert && v != null ? 1 - v : v;
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-sm mt-1 ${scoreColor(display)}`}>
        {v == null ? "—" : (v * 100).toFixed(0) + "%"}
      </div>
    </div>
  );
}
