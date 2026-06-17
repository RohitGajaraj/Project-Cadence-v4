// Analytics tab — ported from design-reference/cadence/govern-detail.jsx
// (AnalyticsTab): range sub-tab pills, three stat bentos (serif 26 tabular
// values, 11px faint sub-line), and the span-3 "Spend by …" bentos with
// per-row ember share bars and right-aligned mono spend. Production keeps the
// per-SURFACE rollup as the top-level whole-spend view (every AI call, ink
// labels); the reference's per-AGENT rollup sits underneath it as the
// also-real layer of the 'agent' surface — orchid labels, rows drill to
// /govern?tab=analytics&agent=<slug> (AgentSpendDetail replaces the tab
// body). Reference's "of $X cap" spend sub-line renders only where a real
// cap exists (ai_budgets daily cap on 24h, monthly cap on 30d); the "ttft"
// sub-datum is omitted — ai_events.ttft_ms is never written.
// Production functionality kept, restyled quiet-Ember: by-model rollup, the
// recent-runs list with its event-detail drawer (existing drill-down), the
// guardrail-hit stats, and the daily activity bars.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Gauge, X } from "lucide-react";
import {
  getAnalyticsOverview,
  getAgentSpendBreakdown,
  getUnitEconomics,
  listAiEvents,
  getEventDetail,
  getGuardrailStats,
} from "@/lib/analytics.functions";
import { getBudgetSummary } from "@/lib/budgets.functions";
import { MonoLabel, SubTabs, VerdictChip } from "@/components/cadence/Primitives";
import { SketchBar } from "@/components/cadence/Sketch";
import { relTime } from "@/components/product/format";

function fmtUsd(n: number) {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
function fmtMs(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const RANGES: { id: string; days: number }[] = [
  { id: "24h", days: 1 },
  { id: "7d", days: 7 },
  { id: "30d", days: 30 },
  { id: "90d", days: 90 },
];

export function AnalyticsPanel() {
  const navigate = useNavigate();
  const fOverview = useServerFn(getAnalyticsOverview);
  const fByAgent = useServerFn(getAgentSpendBreakdown);
  const fUnit = useServerFn(getUnitEconomics);
  const fBudget = useServerFn(getBudgetSummary);
  const fEvents = useServerFn(listAiEvents);
  const fDetail = useServerFn(getEventDetail);
  const fGuards = useServerFn(getGuardrailStats);

  const [range, setRange] = useState("7d");
  const [section, setSection] = useState("Models");
  const [openId, setOpenId] = useState<string | null>(null);
  const days = RANGES.find((r) => r.id === range)?.days ?? 7;

  const overview = useQuery({
    queryKey: ["analytics-overview", days],
    queryFn: () => fOverview({ data: { days } }),
  });
  const byAgentQ = useQuery({
    queryKey: ["analytics-by-agent", days],
    queryFn: () => fByAgent({ data: { days } }),
  });
  const unitQ = useQuery({
    queryKey: ["unit-economics", days],
    queryFn: () => fUnit({ data: { days } }),
  });
  const budgetQ = useQuery({
    queryKey: ["budget-summary"],
    queryFn: () => fBudget(),
  });
  const events = useQuery({
    queryKey: ["analytics-events"],
    queryFn: () => fEvents({ data: { limit: 100 } }),
    enabled: section === "Runs",
  });
  const guards = useQuery({
    queryKey: ["analytics-guards"],
    queryFn: () => fGuards(),
    enabled: section === "Guardrails",
  });
  const detail = useQuery({
    queryKey: ["event-detail", openId],
    queryFn: () => fDetail({ data: { eventId: openId! } }),
    enabled: !!openId,
  });

  if (overview.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load analytics
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(overview.error as Error).message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => overview.refetch()}
        >
          Retry · reloads analytics
        </button>
      </div>
    );
  }

  const s = overview.data?.summary;
  const bySurface = overview.data?.bySurface ?? [];
  const byAgents = byAgentQ.data?.agents ?? [];
  const byModel = overview.data?.byModel ?? [];
  const daily = overview.data?.daily ?? [];
  const ue = unitQ.data;
  const totalCost = s?.totalCost ?? 0;
  const maxRuns = Math.max(...daily.map((d) => d.runs), 1);
  // "of $X cap" is only honest where a real cap covers the window: ai_budgets
  // daily_usd_cap for 24h, monthly_usd_cap for 30d — and only when set. No
  // weekly/quarterly cap concept exists, so 7d/90d keep the runs · errors line.
  const capForRange =
    range === "24h"
      ? (budgetQ.data?.daily_usd_cap ?? null)
      : range === "30d"
        ? (budgetQ.data?.monthly_usd_cap ?? null)
        : null;

  return (
    <div>
      <SubTabs tabs={RANGES.map((r) => r.id)} active={range} onSet={setRange} />

      {overview.isLoading ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "32px 0",
            textAlign: "center",
          }}
        >
          Loading analytics…
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <div className="bento" style={{ padding: "var(--card-pad)" }}>
            <MonoLabel style={{ marginBottom: 6 }}>Spend · {range}</MonoLabel>
            <div className="font-display tabular-nums" style={{ fontSize: 26 }}>
              {fmtUsd(totalCost)}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
              {capForRange != null ? (
                <>of {fmtUsd(Number(capForRange))} cap</>
              ) : (
                <>{s?.totalRuns ?? 0} runs</>
              )}
              {(s?.errors ?? 0) > 0 ? (
                <span style={{ color: "var(--rose)" }}> · {s!.errors} errors</span>
              ) : null}
            </div>
          </div>
          <div className="bento" style={{ padding: "var(--card-pad)" }}>
            <MonoLabel style={{ marginBottom: 6 }}>Tokens · {range}</MonoLabel>
            <div className="font-display tabular-nums" style={{ fontSize: 26 }}>
              {fmtNum(s?.totalTokens ?? 0)}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>in + out</div>
          </div>
          {/* Reference headline is the median; its "ttft" sub-datum is never
              written in production, so the real avg + p95 ride the sub-line. */}
          <div className="bento" style={{ padding: "var(--card-pad)" }}>
            <MonoLabel style={{ marginBottom: 6 }}>Median latency</MonoLabel>
            <div className="font-display tabular-nums" style={{ fontSize: 26 }}>
              {fmtMs(s?.p50Latency ?? 0)}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
              avg {fmtMs(s?.avgLatency ?? 0)} · p95 {fmtMs(s?.p95Latency ?? 0)}
            </div>
          </div>

          {/* ENG-06 · unit economics — cost-per-outcome roll-up (operator view).
              Renders only once outcomes exist so the panel stays quiet on cold
              workspaces. The calm-front half is the Today cost-per-outcome line. */}
          {ue && ue.outcomes > 0 ? (
            <div className="bento" style={{ gridColumn: "span 3", padding: "var(--card-pad)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 12,
                }}
              >
                <MonoLabel>Unit economics · {range}</MonoLabel>
                <span className="mono-label" style={{ fontSize: 8.5 }}>
                  what each outcome cost
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <div>
                  <MonoLabel style={{ marginBottom: 6 }}>Agent spend</MonoLabel>
                  <div className="font-display tabular-nums" style={{ fontSize: 22 }}>
                    {fmtUsd(ue.totalSpendUsd)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                    over {ue.outcomes} outcome{ue.outcomes === 1 ? "" : "s"}
                  </div>
                </div>
                <div>
                  <MonoLabel style={{ marginBottom: 6 }}>Outcomes</MonoLabel>
                  <div className="font-display tabular-nums" style={{ fontSize: 22 }}>
                    {ue.specs} · {ue.decisions} · {ue.missions}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                    specs · decisions · shipped
                  </div>
                </div>
                <div>
                  <MonoLabel style={{ marginBottom: 6 }}>Cost per outcome</MonoLabel>
                  <div className="font-display tabular-nums" style={{ fontSize: 22 }}>
                    {ue.costPerOutcomeUsd != null ? fmtUsd(ue.costPerOutcomeUsd) : "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>spend ÷ outcomes</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="bento" style={{ gridColumn: "span 3", padding: "var(--card-pad)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 12,
              }}
            >
              <MonoLabel>Spend by surface · {range}</MonoLabel>
              <span className="mono-label" style={{ fontSize: 8.5 }}>
                every AI call rolls up here
              </span>
            </div>
            {bySurface.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
                No AI calls in this window yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {bySurface.map((x) => {
                  const pct = totalCost > 0 ? (x.cost / totalCost) * 100 : 0;
                  return (
                    <div
                      key={x.surface}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "6px 8px",
                        borderRadius: 8,
                      }}
                    >
                      <span className="mono-label" style={{ width: 90, color: "var(--ink)" }}>
                        {x.surface}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          height: 5,
                          borderRadius: 99,
                          background: "var(--surface-2)",
                          overflow: "hidden",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            height: "100%",
                            width: `${pct}%`,
                            background: "var(--ember)",
                            opacity: 0.85,
                          }}
                        ></span>
                      </span>
                      <span
                        className="mono-label tabular-nums"
                        style={{ width: 56, textAlign: "right", color: "var(--ink)" }}
                      >
                        {fmtUsd(x.cost)}
                      </span>
                      <span
                        className="mono-label tabular-nums"
                        style={{ width: 64, textAlign: "right", color: "var(--ink-faint)" }}
                      >
                        {x.runs} runs
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Spend by agent — the reference's per-agent rollup (govern-detail
              AnalyticsTab), real layer underneath the 'agent' surface row
              above. Bars are pct of the agent-spend SUBTOTAL; rows drill to
              the per-agent detail. */}
          <div className="bento" style={{ gridColumn: "span 3", padding: "var(--card-pad)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 12,
              }}
            >
              <MonoLabel icon={Gauge}>Spend by agent · {range}</MonoLabel>
              <span className="mono-label" style={{ fontSize: 8.5 }}>
                click an agent to drill down
              </span>
            </div>
            {byAgentQ.isLoading ? (
              <p style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Loading agent spend…</p>
            ) : byAgents.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
                No agent calls in this window yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {byAgents.map((x) => (
                  <button
                    key={x.slug}
                    className="lift"
                    onClick={() =>
                      navigate({ to: "/govern", search: { tab: "analytics", agent: x.slug } })
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: "1px solid transparent",
                      textAlign: "left",
                    }}
                  >
                    <span
                      className="mono-label"
                      title={x.name}
                      style={{
                        width: 90,
                        flexShrink: 0,
                        color: "var(--agent)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {x.name}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        height: 5,
                        borderRadius: 99,
                        background: "var(--surface-2)",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          height: "100%",
                          width: `${x.pct}%`,
                          background: "var(--ember)",
                          opacity: 0.85,
                        }}
                      ></span>
                    </span>
                    <span
                      className="mono-label tabular-nums"
                      style={{ width: 56, textAlign: "right", color: "var(--ink)" }}
                    >
                      {fmtUsd(x.cost)}
                    </span>
                    <ChevronRight size={11} style={{ color: "var(--ink-faint)", flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {daily.length > 0 ? (
            <div className="bento" style={{ gridColumn: "span 3", padding: "var(--card-pad)" }}>
              <MonoLabel style={{ marginBottom: 12 }}>Daily activity · runs</MonoLabel>
              {/* Bars render hand-sketched (SketchBar, founder directive
                  2026-06-12) on a fixed 72px track; the date labels sit below
                  the track so nothing escapes the card. */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                {daily.map((d, i) => (
                  <div
                    key={d.day}
                    title={`${d.runs} runs · ${fmtUsd(d.cost)}`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <SketchBar pct={Math.max(4, (d.runs / maxRuns) * 100)} seed={i + 1} />
                    <span
                      className="mono-label tabular-nums"
                      style={{ fontSize: 8, textAlign: "center" }}
                    >
                      {d.day.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <SubTabs tabs={["Models", "Runs", "Guardrails"]} active={section} onSet={setSection} />

        {section === "Models" ? (
          <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
            <div
              className="mono-label"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 70px 80px 80px",
                gap: 12,
                padding: "10px 18px",
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <span>Model</span>
              <span>Runs</span>
              <span>Tokens</span>
              <span>Spend</span>
            </div>
            {byModel.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", padding: "14px 18px" }}>
                No AI calls in this window yet.
              </p>
            ) : (
              byModel.map((r, i) => (
                <div
                  key={r.model}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 70px 80px 80px",
                    gap: 12,
                    padding: "12px 18px",
                    alignItems: "baseline",
                    borderBottom: i < byModel.length - 1 ? "1px solid var(--hairline)" : "none",
                    fontSize: 13,
                  }}
                >
                  <span className="mono-label" style={{ color: "var(--ink)" }}>
                    {r.model}
                  </span>
                  <span className="tabular-nums" style={{ color: "var(--ink-muted)" }}>
                    {r.runs}
                  </span>
                  <span className="mono-label tabular-nums">{fmtNum(r.tokens)}</span>
                  <span className="mono-label tabular-nums" style={{ color: "var(--ink)" }}>
                    {fmtUsd(r.cost)}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : section === "Runs" ? (
          <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
            {events.isLoading ? (
              <p style={{ fontSize: 12.5, color: "var(--ink-faint)", padding: "14px 18px" }}>
                Loading runs…
              </p>
            ) : (events.data?.events ?? []).length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", padding: "14px 18px" }}>
                No AI events yet. Run an agent or a chat first.
              </p>
            ) : (
              (events.data?.events ?? []).map((e, i, arr) => (
                <button
                  key={e.id}
                  onClick={() => setOpenId(e.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 18px",
                    width: "100%",
                    textAlign: "left",
                    borderBottom: i < arr.length - 1 ? "1px solid var(--hairline)" : "none",
                    fontSize: 12.5,
                  }}
                >
                  <VerdictChip tone={e.status === "ok" ? "moss" : "madder"}>
                    {e.status === "ok" ? "ok" : "failed"}
                  </VerdictChip>
                  <span className="mono-label" style={{ width: 80, flexShrink: 0 }}>
                    {e.surface}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      color: "var(--ink-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(e.input_preview ?? "").slice(0, 100)}
                  </span>
                  <span className="mono-label tabular-nums">{fmtNum(e.total_tokens)}</span>
                  <span className="mono-label tabular-nums">{fmtMs(e.latency_ms)}</span>
                  <span className="mono-label tabular-nums" style={{ color: "var(--ink)" }}>
                    {fmtUsd(Number(e.est_cost_usd))}
                  </span>
                  <span
                    className="mono-label"
                    style={{ fontSize: 8.5, color: "var(--action-blue)" }}
                  >
                    detail →
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="bento" style={{ padding: "var(--card-pad)" }}>
            <MonoLabel style={{ marginBottom: 10 }}>Guardrail hits · last 30 days</MonoLabel>
            {guards.isLoading ? (
              <p style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Loading guardrail hits…</p>
            ) : (guards.data?.hits ?? []).length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
                No guardrail hits. Inputs and outputs have been clean.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {(guards.data?.hits ?? []).map((h, i, arr) => (
                  <div
                    key={`${h.name}-${h.action}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: i < arr.length - 1 ? "1px solid var(--hairline)" : "none",
                      fontSize: 13,
                    }}
                  >
                    <span
                      className="mono-label"
                      style={{
                        fontSize: 8.5,
                        color: h.action === "block" ? "var(--rose)" : "var(--ember)",
                      }}
                    >
                      {h.action}
                    </span>
                    <span style={{ flex: 1, color: "var(--ink-muted)" }}>{h.name}</span>
                    <span className="mono-label tabular-nums">{h.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {openId && (
        <Drawer onClose={() => setOpenId(null)}>
          {detail.isLoading || !detail.data ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Loading event…</div>
          ) : (
            <EventDetail data={detail.data as EventDetailData} />
          )}
        </Drawer>
      )}
    </div>
  );
}

/* Event-detail drawer — production's existing AI-event drill-down, restyled
   quiet-Ember (canvas panel, hairline edge). */
function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40 }}
        onClick={onClose}
      />
      <aside
        className="fade-up"
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: "100%",
          maxWidth: 560,
          background: "var(--canvas)",
          borderLeft: "1px solid var(--hairline)",
          zIndex: 50,
          overflow: "auto",
          padding: 24,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", right: 16, top: 16, color: "var(--ink-subtle)" }}
        >
          <X size={14} />
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
  if (!e) return <div style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>Event not found.</div>;
  const ev = data.eval;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <MonoLabel>AI event · via {e.via}</MonoLabel>
        <div className="font-display" style={{ fontSize: 19, marginTop: 4 }}>
          {e.surface}
        </div>
        <div className="mono-label" style={{ marginTop: 4, color: "var(--ink-subtle)" }}>
          {e.model} · {relTime(e.created_at)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {(
          [
            ["Tokens", `${e.prompt_tokens}/${e.completion_tokens}`],
            ["Latency", fmtMs(e.latency_ms)],
            ["Cost", fmtUsd(Number(e.est_cost_usd))],
            ["Status", e.status],
          ] as [string, string][]
        ).map(([l, v]) => (
          <div key={l} className="bento" style={{ padding: "10px 12px", textAlign: "center" }}>
            <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 4 }}>
              {l}
            </div>
            <div className="tabular-nums" style={{ fontSize: 13 }}>
              {v}
            </div>
          </div>
        ))}
      </div>

      {ev && (
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 10 }}>Judge scores</MonoLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {(
              [
                ["Hallucination", ev.hallucination_score],
                ["Groundedness", ev.groundedness],
                ["Relevance", ev.relevance],
                ["Coherence", ev.coherence],
                ["Toxicity", ev.toxicity],
              ] as [string, number | null][]
            ).map(([l, v]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div className="mono-label" style={{ fontSize: 8.5 }}>
                  {l}
                </div>
                <div className="font-display tabular-nums" style={{ fontSize: 16, marginTop: 2 }}>
                  {v == null ? "—" : `${(v * 100).toFixed(0)}%`}
                </div>
              </div>
            ))}
          </div>
          {ev.judge_rationale && (
            <p
              style={{
                fontSize: 12.5,
                color: "var(--ink-subtle)",
                marginTop: 10,
                paddingTop: 10,
                borderTop: "1px solid var(--hairline)",
                lineHeight: 1.5,
              }}
            >
              {ev.judge_rationale}
            </p>
          )}
        </div>
      )}

      {data.guardrailHits.length > 0 && (
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 8 }}>Guardrails</MonoLabel>
          {data.guardrailHits.map((h, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 8,
                fontSize: 12.5,
                padding: "3px 0",
                alignItems: "baseline",
              }}
            >
              <span
                className="mono-label"
                style={{
                  fontSize: 8.5,
                  color: h.action === "block" ? "var(--rose)" : "var(--ember)",
                }}
              >
                {h.action}
              </span>
              <span style={{ color: "var(--ink-muted)" }}>{h.rule_name}</span>
              <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
                {h.side}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel style={{ marginBottom: 8 }}>Input</MonoLabel>
        <pre
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            color: "var(--ink-muted)",
            lineHeight: 1.5,
          }}
        >
          {e.input_preview ?? "(empty)"}
        </pre>
      </div>
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel style={{ marginBottom: 8 }}>Output</MonoLabel>
        <pre
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            color: "var(--ink)",
            lineHeight: 1.5,
          }}
        >
          {e.output_preview ?? "(empty)"}
        </pre>
      </div>
      {e.error_message && (
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 8, color: "var(--rose)" }}>Error</MonoLabel>
          <pre
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              color: "var(--rose)",
              lineHeight: 1.5,
            }}
          >
            {e.error_message}
          </pre>
        </div>
      )}
    </div>
  );
}
