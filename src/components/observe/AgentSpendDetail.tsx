// Per-agent spend drill-down — screen 7 of the Ember Editorial migration,
// ported from design-reference/cadence/govern-detail.jsx (AgentDetail). Rides
// ?agent= on /govern?tab=analytics (tab body only — SurfaceHeader + TabRow
// stay). All numbers are real: stats + daily sparkline come from ai_events
// (the authoritative per-call ledger); runs / top missions / the recent-runs
// table come from agent_runs (the runs ledger — its tokens_used /
// spend_used_usd only count runId-tied calls post-2026-06-03, so the table's
// Cost column will not sum to the Spend stat; that is real, not a bug).
// Omitted vs the reference: "Set agent cap…" CTA (no per-agent cap exists in
// any table) and the long-tail fallback bento (invented agents) — the
// unresolved-ref / empty case renders a real empty state instead.
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { DrillHeader, MonoLabel } from "@/components/cadence/Primitives";
import { SketchLine } from "@/components/cadence/Sketch";
import { getAgentAnalyticsDetail } from "@/lib/analytics.functions";
import { relTime, fmtUsd } from "@/components/product/format";

const DAYS = 30; // the reference's window — stat labels say "· 30d"

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
function fmtMs(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// Production's real agent_runs status vocabulary (loop.server.ts writes
// queued/running/waiting_approval/completed/halted/failed; the legacy direct
// runner wrote "complete"). Tones per the migration ruling: completed→moss,
// halted/failed→madder, in-flight states→neutral.
const STATUS_COLOR: Record<string, string> = {
  completed: "var(--emerald)",
  complete: "var(--emerald)",
  halted: "var(--rose)",
  failed: "var(--rose)",
};

const RUN_GRID = "80px 90px 1fr 60px 50px 60px 90px";

export function AgentSpendDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const fDetail = useServerFn(getAgentAnalyticsDetail);
  const q = useQuery({
    queryKey: ["agent-spend-detail", id, DAYS],
    queryFn: () => fDetail({ data: { agentSlug: id, days: DAYS } }),
  });
  const onBack = () => navigate({ to: "/govern", search: { tab: "analytics" } });

  if (q.isLoading) {
    return (
      <div className="fade-up">
        <DrillHeader onBack={onBack} backLabel="Analytics" kicker="Agent rollup" title={id} />
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <span className="mono-label">Loading agent rollup…</span>
        </div>
      </div>
    );
  }

  if (q.error) {
    return (
      <div className="fade-up">
        <DrillHeader onBack={onBack} backLabel="Analytics" kicker="Agent rollup" title={id} />
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <div className="mono-label" style={{ color: "var(--rose)" }}>
            Couldn't load this agent's rollup
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
            {(q.error as Error).message}
          </p>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 14 }}
            onClick={() => q.refetch()}
          >
            Retry · reloads the rollup
          </button>
        </div>
      </div>
    );
  }

  const d = q.data;
  if (!d) return null;

  // Bad / unknown ref with nothing behind it — a real empty state, never the
  // reference's invented long-tail bento.
  if (!d.agent && d.stats.calls === 0 && d.recentRuns.length === 0) {
    return (
      <div className="fade-up">
        <DrillHeader onBack={onBack} backLabel="Analytics" kicker="Agent rollup" title={id} />
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", margin: 0 }}>
            No AI calls recorded for this agent in the last {DAYS} days.
          </p>
        </div>
      </div>
    );
  }

  // Pseudo-refs (orchestrator:plan, reflect:{slug}, …) resolve to no agents
  // row: raw ref title, "Agent rollup" kicker, events-only stats — the
  // agent_runs sections are hidden since agent_slug can't match.
  const resolved = d.agent != null;
  const kicker = d.agent?.role || "Agent rollup";
  const title = d.agent?.name ?? id;

  return (
    <div className="fade-up">
      {/* "Set agent cap…" right-slot omitted: no per-agent cap exists. */}
      <DrillHeader onBack={onBack} backLabel="Analytics" kicker={kicker} title={title} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 14,
        }}
      >
        {(
          [
            [`Spend · ${DAYS}d`, fmtUsd(d.stats.cost)],
            ["Runs", fmtNum(d.stats.runs)],
            ["Tokens", fmtNum(d.stats.tokens)],
            ["p50 latency", fmtMs(d.stats.p50Latency)],
          ] as [string, string][]
        ).map(([l, v]) => (
          <div key={l} className="bento" style={{ padding: "var(--card-pad)" }}>
            <MonoLabel style={{ marginBottom: 6 }}>{l}</MonoLabel>
            <div className="font-display tabular-nums" style={{ fontSize: 24 }}>
              {v}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: resolved ? "1fr 1fr" : "1fr",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 10 }}>Daily spend · last 8 days</MonoLabel>
          <SketchLine data={d.dailySpend.map((x) => x.cost)} w={300} h={48} color="var(--ember)" />
        </div>
        {resolved ? (
          <div className="bento" style={{ padding: "var(--card-pad)" }}>
            <MonoLabel style={{ marginBottom: 10 }}>Top missions by cost</MonoLabel>
            {d.topMissions.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", margin: 0 }}>
                No runs recorded for this agent in this window.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {d.topMissions.map((m, i) => (
                  <div
                    key={m.missionId ?? "direct"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "7px 0",
                      borderBottom:
                        i < d.topMissions.length - 1 ? "1px solid var(--hairline)" : "none",
                      fontSize: 12.5,
                    }}
                  >
                    {m.missionId ? (
                      <button
                        style={{
                          color: "var(--action-blue)",
                          textAlign: "left",
                          flex: 1,
                          fontWeight: 500,
                        }}
                        onClick={() =>
                          navigate({
                            to: "/missions/$missionId",
                            params: { missionId: m.missionId! },
                          })
                        }
                      >
                        {m.title ?? `${m.missionId.slice(0, 8)}…`}
                      </button>
                    ) : (
                      // The real bucket of runs with no mission attached —
                      // unlinked, like the reference's id-less rows.
                      <span style={{ flex: 1, fontWeight: 500, color: "var(--ink-muted)" }}>
                        Direct runs · no mission
                      </span>
                    )}
                    <span className="mono-label tabular-nums">{m.runs} runs</span>
                    <span
                      className="mono-label tabular-nums"
                      style={{ color: "var(--ink)", width: 48, textAlign: "right" }}
                    >
                      {fmtUsd(m.cost)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {resolved ? (
        <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div
            className="mono-label"
            style={{
              display: "grid",
              gridTemplateColumns: RUN_GRID,
              gap: 12,
              padding: "10px 18px",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <span>Run</span>
            <span>When</span>
            <span>Mission</span>
            <span>Tokens</span>
            <span>Dur</span>
            <span>Cost</span>
            <span>Status</span>
          </div>
          {d.recentRuns.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", padding: "14px 18px" }}>
              No runs recorded for this agent in this window.
            </p>
          ) : (
            d.recentRuns.map((r, i) => (
              <div
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: RUN_GRID,
                  gap: 12,
                  padding: "11px 18px",
                  alignItems: "center",
                  borderBottom: i < d.recentRuns.length - 1 ? "1px solid var(--hairline)" : "none",
                  fontSize: 12.5,
                }}
              >
                <span className="mono-label" style={{ color: "var(--ink)" }}>
                  {r.id.slice(0, 8)}
                </span>
                <span style={{ color: "var(--ink-subtle)" }}>{relTime(r.created_at)}</span>
                <span
                  style={{
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.missionTitle ?? "—"}
                </span>
                <span className="mono-label tabular-nums">
                  {r.tokens_used ? fmtNum(r.tokens_used) : "—"}
                </span>
                <span className="mono-label tabular-nums">
                  {r.duration_ms != null ? fmtMs(r.duration_ms) : "—"}
                </span>
                <span className="mono-label tabular-nums" style={{ color: "var(--ink)" }}>
                  {r.spend_used_usd ? fmtUsd(r.spend_used_usd) : "—"}
                </span>
                <span
                  className="mono-label"
                  style={{ color: STATUS_COLOR[r.status] ?? "var(--ink-subtle)" }}
                >
                  {r.status}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
