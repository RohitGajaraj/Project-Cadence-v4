// LearningDetail — Knowledge → Memory drill-down (screen 6 of the Ember
// Editorial migration), ported from design-reference/cadence/loop-detail.jsx
// (LearningDetail) onto the production learnings contract
// (outcome.functions listLearnings). Drill state rides ?learning= on
// /knowledge; the detail replaces only the tab body. Shares the panel's
// ["learnings"] cache and the ["opportunities"] cache (applies-to title).
// Verdict-chip law: the judgment leads, the serif summary follows.
// Reference elements omitted for lack of real data: "written by Historian
// after <mission>" (production learnings are written by the outcome loop and
// carry no mission id), "cited to trace X" (no trace data), and the
// "Where this learning changed behavior" cited-by table (no citation data).
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { listLearnings } from "@/lib/outcome.functions";
import { listOpportunities } from "@/lib/discovery.functions";
import {
  DrillHeader,
  MonoLabel,
  VerdictChip,
  type VerdictTone,
} from "@/components/cadence/Primitives";

type LearningRow = {
  id: string;
  prd_id: string | null;
  opportunity_id: string | null;
  verdict: "validated" | "missed" | "mixed";
  summary: string;
  metric_label: string | null;
  metric_value: string | null;
  prior_ice: number | null;
  new_ice: number | null;
  created_at: string;
};

const VERDICT_TONE: Record<LearningRow["verdict"], VerdictTone> = {
  validated: "moss",
  missed: "madder",
  mixed: "ember", // mixed outcome = the human's call on what to do next
};

/** Reference memoryFeed "when" rhythm: time today, "Yesterday", else "Jun 9". */
function whenOf(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function LearningDetail({ id }: { id: string }) {
  const navigate = useNavigate();

  const fLearnings = useServerFn(listLearnings);
  const learnings = useQuery({ queryKey: ["learnings"], queryFn: () => fLearnings() });
  const fOpps = useServerFn(listOpportunities);
  const opps = useQuery({ queryKey: ["opportunities"], queryFn: () => fOpps() });

  const onBack = () => navigate({ to: "/knowledge", search: { tab: "memory" } });

  if (learnings.isLoading) {
    return (
      <div
        style={{
          padding: "18px 2px",
          textAlign: "center",
          fontSize: 12.5,
          color: "var(--ink-faint)",
        }}
      >
        Loading learning…
      </div>
    );
  }

  const l = ((learnings.data?.learnings ?? []) as LearningRow[]).find((x) => x.id === id);
  if (!l) {
    return (
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel style={{ marginBottom: 10 }}>
          learning not found — it may have been removed
        </MonoLabel>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          Back · all learnings
        </button>
      </div>
    );
  }

  // Mono footer — real fields only (no-filler law): metric, ICE delta.
  const footer = [
    l.metric_label && l.metric_value ? `${l.metric_label} ${l.metric_value}` : null,
    l.prior_ice != null && l.new_ice != null
      ? `ICE ${l.prior_ice.toFixed(1)} → ${l.new_ice.toFixed(1)}`
      : null,
  ].filter((x): x is string => x !== null);

  const opp = l.opportunity_id
    ? ((opps.data?.opportunities ?? []) as { id: string; title: string }[]).find(
        (o) => o.id === l.opportunity_id,
      )
    : undefined;

  return (
    <div className="fade-up">
      <DrillHeader
        onBack={onBack}
        backLabel="All learnings"
        kicker={`Learning · ${whenOf(l.created_at)} · written as the outcome landed`}
        title="What the swarm learned"
        right={
          l.prd_id ? (
            <Link to="/prds/$id" params={{ id: l.prd_id }} className="btn btn-ghost btn-sm">
              <ExternalLink size={11} /> Open spec
            </Link>
          ) : null
        }
      />

      <div className="bento" style={{ padding: "var(--card-pad)", marginBottom: 12 }}>
        <VerdictChip tone={VERDICT_TONE[l.verdict]}>{l.verdict}</VerdictChip>
        <p
          style={{
            fontFamily: "'Newsreader', serif",
            fontSize: 17,
            lineHeight: 1.55,
            color: "var(--ink)",
            margin: "8px 0 0",
          }}
        >
          {l.summary}
        </p>
        {footer.length > 0 ? (
          <p className="mono-label tabular-nums" style={{ fontSize: 8.5, marginTop: 10 }}>
            {footer.join(" · ")}
          </p>
        ) : null}
      </div>

      {/* Cross-surface loop closure — rendered only when the opportunity
          resolves to a real title (no-filler law). */}
      {opp ? (
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 8 }}>Where it points</MonoLabel>
          <div style={{ fontSize: 12.5, display: "flex", gap: 8 }}>
            <span className="mono-label" style={{ width: 80, flexShrink: 0 }}>
              applies to
            </span>
            <button
              style={{ color: "var(--action-blue)", fontWeight: 500, textAlign: "left" }}
              onClick={() =>
                navigate({ to: "/product", search: { tab: "opportunities", opp: opp.id } })
              }
            >
              {opp.title} →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
