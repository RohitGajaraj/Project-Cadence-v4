// Opportunity drill-down — screen 6 of the Ember Editorial migration, ported
// 1:1 from design-reference/cadence/loop-detail.jsx (OpportunityDetail). The
// detail rides the ?opp= search param on /product (tab body only) and shares
// the panels' caches (["opportunities"], ["learnings"], ["lineage", …]).
// Big serif ICE score + rank caption, the impact/confidence/ease breakdown as
// clean meter bars (instruments, not series — no sketch), rescore history
// from the real outcome loop (listLearnings prior_ice → new_ice), and the
// signal/spec/mission lineage column from getLineage. The reference's
// "reach · effort" caption is omitted — no production data source.
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/notify";
import { DrillHeader, MonoLabel } from "@/components/cadence/Primitives";
import { listOpportunities, generatePrd } from "@/lib/discovery.functions";
import { listLearnings } from "@/lib/outcome.functions";
import { getLineage, getProvenance, type ArtifactKind } from "@/lib/lineage.functions";
import { PrecedentNudge } from "@/components/decision/PrecedentNudge";
import { SharedPremiseNudge } from "@/components/decision/SharedPremiseNudge";
import { DecisionCurrencyBanner } from "@/components/decision/DecisionCurrencyBanner";

type OppRow = {
  id: string;
  title: string;
  problem: string | null;
  status: string;
  impact: number;
  confidence: number;
  ease: number;
  ice_score: number | string;
};

type LearningRow = {
  id: string;
  prd_id: string | null;
  opportunity_id: string | null;
  verdict: "validated" | "missed" | "mixed";
  summary: string | null;
  prior_ice: number | string | null;
  new_ice: number | string | null;
  created_at: string;
};

type LineageEdge = {
  id: string;
  parent_kind: ArtifactKind;
  parent_id: string;
  child_kind: ArtifactKind;
  child_id: string;
  relation: string;
  rationale: string | null;
  peer_title?: string | null;
};

/** Reference rescore "when" rhythm (MemoryPanel): time today, "Yesterday", else "Jun 9". */
function whenOf(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const LINK_STYLE = {
  color: "var(--action-blue)",
  textAlign: "left",
  fontWeight: 500,
} as const;

export function OpportunityDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fOpps = useServerFn(listOpportunities);
  const fLearnings = useServerFn(listLearnings);
  const fLineage = useServerFn(getLineage);
  const mPrd = useServerFn(generatePrd);

  const opps = useQuery({ queryKey: ["opportunities"], queryFn: () => fOpps() });
  const learningsQ = useQuery({ queryKey: ["learnings"], queryFn: () => fLearnings() });
  const lineageQ = useQuery({
    queryKey: ["lineage", "opportunity", id],
    queryFn: () => fLineage({ data: { kind: "opportunity", id } }),
  });
  // O1 (provenance): walk the full ancestor chain back to the root source signals.
  const fProvenance = useServerFn(getProvenance);
  const provQ = useQuery({
    queryKey: ["provenance", "opportunity", id],
    queryFn: () => fProvenance({ data: { kind: "opportunity", id } }),
  });

  const all = (opps.data?.opportunities ?? []) as OppRow[]; // ice_score DESC
  const idx = all.findIndex((x) => x.id === id);
  const o = idx >= 0 ? all[idx] : null;
  const rank = idx + 1;

  const prd = useMutation({
    mutationFn: () => mPrd({ data: { opportunity_id: id } }),
    onSuccess: (r) => {
      toast.success(`PRD generated for “${o?.title}”. Critic reviewed it.`);
      qc.invalidateQueries({ queryKey: ["prds"] });
      if (r.prd?.id) navigate({ to: "/prds/$id", params: { id: r.prd.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const back = () => navigate({ to: "/product", search: { tab: "opportunities" } });

  if (opps.isLoading) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Loading opportunity…
      </div>
    );
  }

  if (!o) {
    return (
      <div
        className="bento fade-up"
        style={{ padding: "var(--card-pad)", display: "flex", alignItems: "center", gap: 14 }}
      >
        <span className="mono-label" style={{ flex: 1 }}>
          This opportunity is no longer in the queue — it may have been deleted.
        </span>
        <button className="btn btn-ghost btn-sm" onClick={back}>
          Back · all opportunities
        </button>
      </div>
    );
  }

  // Learnings for this opportunity, newest first — the outcome loop's record.
  const oppLearnings = ((learningsQ.data?.learnings ?? []) as LearningRow[])
    .filter((l) => l.opportunity_id === id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const latest = oppLearnings[0] ?? null;
  const rescores = oppLearnings.filter((l) => l.prior_ice != null && l.new_ice != null);

  const ancestors = (lineageQ.data?.ancestors ?? []) as LineageEdge[];
  const descendants = (lineageQ.data?.descendants ?? []) as LineageEdge[];
  const signalParents = ancestors.filter(
    (e) => e.parent_kind === "signal" || e.parent_kind === "theme",
  );
  const specEdges = descendants.filter((e) => e.child_kind === "prd");
  const missionEdges = descendants.filter((e) => e.child_kind === "mission");

  const breakdown: [string, number][] = [
    ["impact", Number(o.impact)],
    ["confidence", Number(o.confidence)],
    ["ease", Number(o.ease)],
  ];

  return (
    <div className="fade-up">
      <DrillHeader
        onBack={back}
        backLabel="All opportunities"
        kicker={`Rank #${rank} · ${o.status}${latest ? ` · ${latest.verdict}` : ""}`}
        title={o.title}
        right={
          <button
            className="btn btn-primary btn-sm"
            disabled={prd.isPending}
            onClick={() => prd.mutate()}
          >
            {prd.isPending ? "Generating…" : "Generate PRD"}
          </button>
        }
      />

      <DecisionCurrencyBanner kind="opportunity" targetId={id} className="mb-3" />
      <PrecedentNudge kind="opportunity" targetId={id} className="mb-3" />
      <SharedPremiseNudge kind="opportunity" targetId={id} className="mb-3" />

      <div
        style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: 12, marginBottom: 14 }}
      >
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 6 }}>ICE score</MonoLabel>
          <div className="font-display tabular-nums" style={{ fontSize: 32 }}>
            {Number(o.ice_score).toFixed(1)}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
            rank #{rank} of {all.length}
          </div>
        </div>
        <div className="bento" style={{ padding: "var(--card-pad)", gridColumn: "span 2" }}>
          <MonoLabel style={{ marginBottom: 10 }}>Breakdown · impact, confidence, ease</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {breakdown.map(([l, v]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mono-label" style={{ width: 80 }}>
                  {l}
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
                      width: `${v * 10}%`,
                      background: "var(--ember)",
                      opacity: 0.85,
                    }}
                  ></span>
                </span>
                <span
                  className="mono-label tabular-nums"
                  style={{ width: 26, textAlign: "right", color: "var(--ink)" }}
                >
                  {v.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 10 }}>Rescore history · outcome loop</MonoLabel>
          {rescores.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: 0 }}>
              No rescores yet — the outcome loop re-scores after every release that touches this
              theme.
            </p>
          ) : (
            rescores.map((r, i) => {
              const prior = Number(r.prior_ice);
              const next = Number(r.new_ice);
              return (
                <div
                  key={r.id}
                  style={{
                    fontSize: 12.5,
                    paddingBottom: i < rescores.length - 1 ? 8 : 0,
                    marginBottom: i < rescores.length - 1 ? 8 : 0,
                    borderBottom: i < rescores.length - 1 ? "1px solid var(--hairline)" : "none",
                  }}
                >
                  <span
                    className="mono-label tabular-nums"
                    style={{ color: next >= prior ? "var(--emerald)" : "var(--rose)" }}
                  >
                    {whenOf(r.created_at)} · {prior.toFixed(1)} → {next.toFixed(1)}
                  </span>
                  {r.summary ? (
                    <p style={{ color: "var(--ink-muted)", margin: "4px 0 0", lineHeight: 1.5 }}>
                      {r.summary}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 10 }}>Lineage</MonoLabel>
          {lineageQ.isLoading ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Loading lineage…</div>
          ) : signalParents.length === 0 && specEdges.length === 0 && missionEdges.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
              No lineage recorded yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
              {signalParents.length > 0 ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <span className="mono-label" style={{ width: 80, flexShrink: 0 }}>
                    signals
                  </span>
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {signalParents.map((e) => (
                      <button
                        key={e.id}
                        style={LINK_STYLE}
                        onClick={() =>
                          navigate({
                            to: "/product",
                            search: { tab: "signals", signal: e.parent_id },
                          })
                        }
                      >
                        {e.peer_title ?? e.parent_kind} →
                      </button>
                    ))}
                  </span>
                </div>
              ) : null}
              {specEdges.map((e) => (
                <div key={e.id} style={{ display: "flex", gap: 8 }}>
                  <span className="mono-label" style={{ width: 80, flexShrink: 0 }}>
                    spec
                  </span>
                  <Link to="/prds/$id" params={{ id: e.child_id }} style={LINK_STYLE}>
                    {e.peer_title ?? "open the spec →"}
                  </Link>
                </div>
              ))}
              {missionEdges.map((e) => (
                <div key={e.id} style={{ display: "flex", gap: 8 }}>
                  <span className="mono-label" style={{ width: 80, flexShrink: 0 }}>
                    mission
                  </span>
                  <Link
                    to="/missions/$missionId"
                    params={{ missionId: e.child_id }}
                    style={LINK_STYLE}
                  >
                    open the mission →
                  </Link>
                </div>
              ))}
            </div>
          )}
          {o.problem ? (
            <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 12, lineHeight: 1.5 }}>
              {o.problem}
            </p>
          ) : null}
        </div>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 10 }}>Why this · source evidence</MonoLabel>
          {provQ.isLoading ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Tracing the chain…</div>
          ) : (provQ.data?.signal_count ?? 0) === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
              No source signals traced. This was added directly, not promoted from clustered
              signals.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
              <p style={{ fontSize: 12, color: "var(--ink-subtle)", lineHeight: 1.5 }}>
                Traces back to {provQ.data!.signal_count} source signal
                {provQ.data!.signal_count === 1 ? "" : "s"} through {provQ.data!.node_count} step
                {provQ.data!.node_count === 1 ? "" : "s"} of the discovery chain.
              </p>
              {provQ.data!.source_signals.slice(0, 8).map((s) => (
                <button
                  key={s.id}
                  style={{ ...LINK_STYLE, display: "flex", gap: 8, alignItems: "baseline" }}
                  onClick={() =>
                    navigate({ to: "/product", search: { tab: "signals", signal: s.id } })
                  }
                >
                  <span className="mono-label" style={{ flexShrink: 0, color: "var(--ink-faint)" }}>
                    {s.source ?? "signal"}
                  </span>
                  <span>{(s.title ?? s.content ?? "signal").slice(0, 80)} →</span>
                </button>
              ))}
              {provQ.data!.truncated ? (
                <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
                  chain truncated at the depth cap
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
