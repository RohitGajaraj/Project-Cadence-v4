// SF-FOCUS (Signal Fabric Phase 1) — the one calm "Focus on this next" card on Today.
//
// Renders the single highest-ranked emerging theme as a proactive recommendation: name the
// outcome (the headline), let the operator Start it (HITL) or expand Why (the evidence).
// Calm-front: when there is no clear next (insight is null), it renders NOTHING.
import { useState } from "react";
import { Target, Sparkles } from "lucide-react";
import type { FocusInsight } from "@/lib/brain/insights.functions";

export function FocusNext({
  insight,
  onStart,
  isStarting,
}: {
  insight: FocusInsight | null;
  onStart: (goal: string) => void;
  isStarting: boolean;
}) {
  const [showWhy, setShowWhy] = useState(false);
  if (!insight) return null;

  const ev = insight.evidence;
  return (
    <section className="rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <Target className="h-3.5 w-3.5" />
        Focus on this next
      </div>
      <h3 className="mt-2 text-[15px] font-semibold leading-snug text-foreground">
        {insight.headline}
      </h3>
      {insight.detail ? (
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{insight.detail}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {insight.recommendedAction ? (
          <button
            type="button"
            disabled={isStarting}
            onClick={() => onStart(insight.recommendedAction!.goal)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isStarting ? "Starting…" : "Start it"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          {showWhy ? "Hide why" : "Why"}
        </button>
      </div>

      {showWhy ? (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-mono text-muted-foreground">
          <Chip label="theme" value={ev.title} />
          <Chip label="severity" value={`${ev.severity}/5`} />
          <Chip label="confidence" value={ev.confidence.toFixed(2)} />
          <Chip label="novelty" value={ev.novelty == null ? "new" : ev.novelty.toFixed(2)} />
          <Chip label="recency" value={`${Math.round(ev.recencyHours)}h`} />
          <Chip label="score" value={ev.score.toFixed(3)} />
        </div>
      ) : null}
    </section>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5">
      <span className="opacity-60">{label}</span>
      <span className="max-w-[16rem] truncate text-foreground/80">{value}</span>
    </span>
  );
}
