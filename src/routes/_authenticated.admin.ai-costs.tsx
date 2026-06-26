/**
 * AFD-12: Admin → AI Costs surface.
 *
 * Reads the 3 moat-metric materialized views:
 *   - mv_decision_velocity  (decisions/week per workspace — velocity KPI)
 *   - mv_supersession_rate  (% decisions superseded per agent — receipts KPI)
 *   - mv_agent_cost_per_decision ($ per decision per agent, rolling 30d — ROI KPI)
 *
 * These are the investor receipts that prove the Decision Brain accretes value.
 * Engine-Room Doctrine: outcome labels only (no "materialized view" copy).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  getMoatMetrics,
  type DecisionVelocityRow,
  type SupersessionRateRow,
  type AgentCostRow,
} from "@/lib/observability.functions";

export const Route = createFileRoute("/_authenticated/admin/ai-costs")({
  component: AdminAiCosts,
});

function AdminAiCosts() {
  const fMetrics = useServerFn(getMoatMetrics);
  const metrics = useQuery({
    queryKey: ["admin-moat-metrics"],
    queryFn: () => fMetrics(),
    staleTime: 60_000,
  });

  if (metrics.isLoading) {
    return (
      <p className="mono-label" style={{ color: "var(--ink-subtle)", marginTop: 16 }}>
        Loading moat metrics...
      </p>
    );
  }

  if (!metrics.data || "error" in metrics.data) {
    return (
      <p style={{ marginTop: 16, fontSize: 13, color: "var(--destructive)" }}>
        {"error" in (metrics.data ?? {}) ? (metrics.data as { error: string }).error : "Failed to load."}
      </p>
    );
  }

  const { decisionVelocity, supersessionRate, agentCost } = metrics.data;

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 20 }}>
      <p className="mono-label" style={{ color: "var(--ink-subtle)", margin: 0 }}>
        Moat receipts — live DB evidence that decisions accelerate over time
      </p>

      {/* Decision velocity */}
      <section className="bento" style={{ padding: 16 }}>
        <div className="mono-label" style={{ marginBottom: 8 }}>Decision velocity by week</div>
        {decisionVelocity.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--ink-subtle)" }}>
            No data yet — decisions will appear here once the DB is seeded.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr className="mono-label" style={{ color: "var(--ink-subtle)" }}>
                <th style={th()}>Week</th>
                <th style={th()}>Made</th>
                <th style={th()}>Shipped</th>
                <th style={th()}>Superseded</th>
              </tr>
            </thead>
            <tbody>
              {(decisionVelocity as DecisionVelocityRow[]).map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--hairline)" }}>
                  <td style={td()}>{r.week?.slice(0, 10) ?? "-"}</td>
                  <td style={td()}>{r.decisions_made}</td>
                  <td style={td()}>{r.decisions_shipped}</td>
                  <td style={td()}>{r.decisions_superseded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Supersession rate */}
      <section className="bento" style={{ padding: 16 }}>
        <div className="mono-label" style={{ marginBottom: 6 }}>Outcome rate by agent</div>
        <p style={{ fontSize: 11, color: "var(--ink-subtle)", marginBottom: 8 }}>
          Higher outcome rate = more decisions closed by real results, not guesses.
        </p>
        {supersessionRate.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--ink-subtle)" }}>No data yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr className="mono-label" style={{ color: "var(--ink-subtle)" }}>
                <th style={th()}>Agent</th>
                <th style={th()}>Total decisions</th>
                <th style={th()}>Outcome rate</th>
              </tr>
            </thead>
            <tbody>
              {(supersessionRate as SupersessionRateRow[]).slice(0, 20).map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--hairline)" }}>
                  <td style={{ ...td(), fontFamily: "var(--font-mono, monospace)" }}>{r.agent_slug}</td>
                  <td style={td()}>{r.decisions_total}</td>
                  <td style={td()}>
                    <span
                      style={{
                        color:
                          r.supersession_rate_pct >= 50
                            ? "var(--green-fg, #16a34a)"
                            : r.supersession_rate_pct >= 20
                              ? "var(--ink)"
                              : "var(--ink-subtle)",
                      }}
                    >
                      {r.supersession_rate_pct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Cost per decision */}
      <section className="bento" style={{ padding: 16 }}>
        <div className="mono-label" style={{ marginBottom: 6 }}>Cost per decision — last 30 days</div>
        <p style={{ fontSize: 11, color: "var(--ink-subtle)", marginBottom: 8 }}>
          Lower is better. Measures AI spend efficiency: $ burned / decision recorded.
        </p>
        {agentCost.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--ink-subtle)" }}>No data yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr className="mono-label" style={{ color: "var(--ink-subtle)" }}>
                <th style={th()}>Agent</th>
                <th style={th()}>Decisions</th>
                <th style={th()}>Spend (30d)</th>
                <th style={th()}>$ / decision</th>
              </tr>
            </thead>
            <tbody>
              {(agentCost as AgentCostRow[]).slice(0, 20).map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--hairline)" }}>
                  <td style={{ ...td(), fontFamily: "var(--font-mono, monospace)" }}>{r.agent_slug}</td>
                  <td style={td()}>{r.decisions_30d}</td>
                  <td style={td()}>${r.cost_usd_30d.toFixed(4)}</td>
                  <td style={td()}>
                    {r.decisions_30d > 0 ? `$${r.cost_per_decision_usd.toFixed(4)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ marginTop: 12, fontSize: 11, color: "var(--ink-subtle)" }}>
          Views refresh nightly via pg_cron. Activate <code>refresh_observability_mvs()</code> in
          Supabase Cron to keep them live.
        </p>
      </section>
    </div>
  );
}

function th(): React.CSSProperties {
  return { padding: "6px 10px", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "left" };
}
function td(): React.CSSProperties {
  return { padding: "8px 10px", verticalAlign: "middle" };
}
