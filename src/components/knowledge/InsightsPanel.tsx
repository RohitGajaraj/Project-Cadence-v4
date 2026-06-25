// BRAIN-UX-V11 (floor) — the human-lens "Insights" tab on the Brain. Renders
// rule-based, plain-language lenses on the decision/memory graph (beliefs,
// what-we've-learned + hit rate, a month timeline) so a PM derives value without
// reading a node graph. Data: getBrainInsights (composes decisions + lineage +
// learnings; no AI/chokepoint). The agent-volunteered intelligence ceiling is a
// follow-on. Ember chrome; honest empty/sparse states (no-filler law).
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  AlertTriangle,
  Activity,
  Scale,
  GraduationCap,
  Lightbulb,
  HelpCircle,
} from "lucide-react";
import { MonoLabel } from "@/components/cadence/Primitives";
import {
  getBrainInsights,
  type BrainInsight,
  type TimelineBucket,
} from "@/lib/brain-insights.functions";
import { LoopClosureBadge } from "@/components/knowledge/LoopClosureBadge";

const TONE: Record<BrainInsight["tone"], { color: string; Icon: typeof TrendingUp }> = {
  positive: { color: "var(--emerald)", Icon: TrendingUp },
  watch: { color: "var(--coral)", Icon: AlertTriangle },
  neutral: { color: "var(--ink-subtle)", Icon: Activity },
};

const VERDICT_COLOR: Record<string, string> = {
  validated: "var(--emerald)",
  confirmed: "var(--emerald)",
  missed: "var(--coral)",
  invalidated: "var(--coral)",
  mixed: "var(--ink-subtle)",
};

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        className="font-display tabular-nums"
        style={{ fontSize: 22, color: color ?? "var(--ink)", lineHeight: 1 }}
      >
        {value}
      </span>
      <span className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint)" }}>
        {label}
      </span>
    </div>
  );
}

function Timeline({ buckets }: { buckets: TimelineBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.decisions + b.learnings));
  return (
    <div
      style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 96, padding: "4px 2px" }}
    >
      {buckets.map((b) => {
        const h = Math.round(((b.decisions + b.learnings) / max) * 76);
        return (
          <div
            key={b.month}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              minWidth: 0,
            }}
          >
            <div
              title={`${b.month}: ${b.decisions} decisions (${b.superseded} revised), ${b.learnings} outcomes`}
              style={{
                width: "100%",
                maxWidth: 34,
                height: Math.max(3, h),
                borderRadius: 4,
                background: "var(--ember)",
                opacity: 0.85,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              }}
            >
              {b.superseded > 0 ? (
                <div
                  style={{
                    height: `${Math.round((b.superseded / Math.max(1, b.decisions + b.learnings)) * Math.max(3, h))}px`,
                    background: "var(--ink-faint)",
                    borderRadius: "0 0 4px 4px",
                    opacity: 0.7,
                  }}
                />
              ) : null}
            </div>
            <span
              className="mono-label tabular-nums"
              style={{ fontSize: 8, color: "var(--ink-faint)" }}
            >
              {b.month.slice(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function InsightsPanel() {
  const fInsights = useServerFn(getBrainInsights);
  const q = useQuery({ queryKey: ["brain-insights"], queryFn: () => fInsights() });

  if (q.isPending) {
    return (
      <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "28px 0" }}>
        Reading the brain…
      </div>
    );
  }
  if (q.isError) {
    return (
      <div style={{ fontSize: 13, color: "var(--rose)", padding: "28px 0" }}>
        Could not load insights. {(q.error as Error)?.message}
      </div>
    );
  }
  const d = q.data!;
  const totalDecisions = d.beliefs.standing + d.beliefs.superseded;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* LOOP-PROVE - is the decision/outcome/supersession loop closing on this workspace's data? */}
      <LoopClosureBadge />
      {/* Headline observations — what the data supports, in plain language. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {d.insights.map((ins, i) => {
          const t = TONE[ins.tone];
          return (
            <div
              key={i}
              className="bento"
              style={{
                padding: "12px 15px",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                borderLeft: `2px solid ${t.color}`,
              }}
            >
              <t.Icon
                size={15}
                strokeWidth={1.9}
                color={t.color}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <span style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5 }}>
                {ins.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Beliefs + Learned at a glance. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="bento" style={{ padding: 16 }}>
          <MonoLabel icon={Scale} style={{ marginBottom: 12 }}>
            Beliefs
          </MonoLabel>
          <div style={{ display: "flex", gap: 24 }}>
            <Stat value={String(d.beliefs.standing)} label="still stand" color="var(--emerald)" />
            <Stat
              value={String(d.beliefs.superseded)}
              label="revised since"
              color="var(--ink-subtle)"
            />
          </div>
          <p style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 12, lineHeight: 1.5 }}>
            {totalDecisions === 0
              ? "No decisions recorded yet."
              : "Current beliefs are the calls that still hold; revised ones were superseded by a later decision."}
          </p>
        </div>
        <div className="bento" style={{ padding: 16 }}>
          <MonoLabel icon={GraduationCap} style={{ marginBottom: 12 }}>
            What Cadence has learned
          </MonoLabel>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <Stat
              value={d.learned.hitRate === null ? "—" : `${d.learned.hitRate}%`}
              label="hit rate"
              color="var(--ember)"
            />
            <Stat value={String(d.learned.validated)} label="validated" color="var(--emerald)" />
            <Stat value={String(d.learned.missed)} label="missed" color="var(--coral)" />
            <Stat value={String(d.learned.mixed)} label="mixed" color="var(--ink-subtle)" />
          </div>
          <p style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 12, lineHeight: 1.5 }}>
            {d.learned.total === 0
              ? "No outcomes recorded yet — the hit rate appears once results come back."
              : `Across ${d.learned.total} recorded outcome${d.learned.total === 1 ? "" : "s"}.`}
          </p>
        </div>
      </div>

      {/* Per-decision WHY — current beliefs in plain language: why decided, and (if revised) what changed it. */}
      {d.recentBeliefs.length > 0 ? (
        <div className="bento" style={{ padding: 16 }}>
          <MonoLabel icon={Lightbulb} style={{ marginBottom: 12 }}>
            Why we believe this
          </MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {d.recentBeliefs.map((b, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    className="mono-label"
                    style={{
                      fontSize: 8.5,
                      color: b.superseded ? "var(--ink-faint)" : "var(--emerald)",
                      flexShrink: 0,
                      textTransform: "uppercase",
                    }}
                  >
                    {b.superseded ? "revised" : "stands"}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--ink)",
                      lineHeight: 1.4,
                      textDecoration: b.superseded ? "line-through" : "none",
                      textDecorationColor: "var(--ink-faint)",
                    }}
                  >
                    {b.title}
                  </span>
                </div>
                {b.rationale ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--ink-muted, #4a443c)",
                      lineHeight: 1.5,
                      paddingLeft: 2,
                    }}
                  >
                    {b.rationale}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-faint)",
                      fontStyle: "italic",
                      paddingLeft: 2,
                    }}
                  >
                    No rationale was recorded for this decision.
                  </span>
                )}
                {b.superseded && b.revisedBy ? (
                  <span
                    className="mono-label"
                    style={{ fontSize: 9, color: "var(--ember)", paddingLeft: 2 }}
                  >
                    now superseded by: {b.revisedBy}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* What's unresolved — the open questions: decisions in active conflict + unsettled outcomes. */}
      <div
        className="bento"
        style={{
          padding: 16,
          borderLeft: d.unresolved.count > 0 ? "2px solid var(--coral)" : undefined,
        }}
      >
        <MonoLabel icon={HelpCircle} style={{ marginBottom: 10 }}>
          What is unresolved
        </MonoLabel>
        {d.unresolved.count === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-faint)", lineHeight: 1.5 }}>
            Nothing open right now — no recorded decisions are in active conflict, and no outcomes
            are sitting mixed.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {d.unresolved.contradictions.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                <AlertTriangle
                  size={13}
                  strokeWidth={1.9}
                  color="var(--coral)"
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <span style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.5 }}>
                  <span style={{ color: "var(--ink-muted, #4a443c)" }}>{c.title}</span> — {c.detail}
                </span>
              </div>
            ))}
            {d.unresolved.mixedOutcomes > 0 ? (
              <p
                style={{ fontSize: 11.5, color: "var(--ink-faint)", lineHeight: 1.5, marginTop: 2 }}
              >
                {d.unresolved.mixedOutcomes} outcome{d.unresolved.mixedOutcomes === 1 ? "" : "s"}{" "}
                came back mixed — partial signal, still waiting on a clean result.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Timeline. */}
      {d.timeline.length > 0 ? (
        <div className="bento" style={{ padding: 16 }}>
          <MonoLabel icon={Activity} style={{ marginBottom: 10 }}>
            How it accrued
          </MonoLabel>
          <Timeline buckets={d.timeline} />
          <p style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 8 }}>
            Decisions + outcomes per month; the darker base marks revised decisions.
          </p>
        </div>
      ) : null}

      {/* Recent learnings with their verdict + ICE shift. */}
      {d.recentLearnings.length > 0 ? (
        <div className="bento" style={{ padding: 16 }}>
          <MonoLabel style={{ marginBottom: 12 }}>Recent outcomes</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {d.recentLearnings.map((l, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span
                  className="mono-label"
                  style={{
                    fontSize: 9,
                    color: VERDICT_COLOR[l.verdict?.toLowerCase()] ?? "var(--ink-subtle)",
                    flexShrink: 0,
                    minWidth: 60,
                    textTransform: "uppercase",
                  }}
                >
                  {l.verdict || "—"}
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-muted, #4a443c)",
                    lineHeight: 1.5,
                    flex: 1,
                  }}
                >
                  {l.summary || "(no summary)"}
                  {l.metricLabel && l.metricValue ? (
                    <span
                      className="mono-label"
                      style={{ fontSize: 9, color: "var(--ink-faint)", marginLeft: 6 }}
                    >
                      {l.metricLabel}: {l.metricValue}
                    </span>
                  ) : null}
                  {l.iceShift !== null && l.iceShift !== 0 ? (
                    <span
                      className="mono-label tabular-nums"
                      style={{
                        fontSize: 9,
                        marginLeft: 6,
                        color: l.iceShift > 0 ? "var(--emerald)" : "var(--coral)",
                      }}
                    >
                      ICE {l.iceShift > 0 ? "+" : ""}
                      {l.iceShift}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
