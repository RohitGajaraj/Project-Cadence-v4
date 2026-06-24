// LOOP-PROVE (v11 #5) - surfaces getLoopClosure on the Brain. A calm "is the decision loop
// closing" pulse: a warmth dot + an outcome-named headline + the engine's gap line when the
// loop is not yet closed, over a stage trail (decisions -> outcomes -> revised -> resolved).
// Self-contained, mirroring the Trust Ledger SealPanel: it owns its getLoopClosure query and
// returns null while pending, on error, or on an empty graph, so it never clutters the panel
// or shows a meaningless "cold" for a brand-new workspace. Read-only; no AI/chokepoint.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity, ChevronRight } from "lucide-react";
import { getLoopClosure } from "@/lib/moat.functions";
import { summarizeLoopClosure } from "@/lib/moat/loop-closure-display";
import type { LoopWarmth } from "@/lib/moat/loop-closure";

const DOT: Record<LoopWarmth, string> = {
  warm: "var(--emerald)",
  warming: "var(--ember, #d97706)",
  cold: "var(--ink-faint)",
};

export function LoopClosureBadge() {
  const fLoop = useServerFn(getLoopClosure);
  const q = useQuery({ queryKey: ["loop-closure"], queryFn: () => fLoop({ data: {} }) });

  const report = q.data;
  // Calm by default: while loading, on error, or on a workspace with no decisions at all, show
  // nothing rather than a spinner or a meaningless cold reading. The Insights panel above owns
  // the primary loading/empty states; this is a supplementary signal.
  if (!report || (report.counts?.decisions ?? 0) === 0) return null;

  const s = summarizeLoopClosure(report);
  const dot = DOT[s.tone];

  return (
    <section
      className="bento"
      style={{
        padding: "12px 15px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderLeft: `2px solid ${dot}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
        <span
          aria-hidden
          style={{ width: 9, height: 9, borderRadius: 999, background: dot, flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{s.label}</span>
        <Activity
          size={13}
          strokeWidth={1.8}
          color="var(--ink-faint)"
          style={{ marginLeft: "auto" }}
        />
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--ink-subtle)", lineHeight: 1.5 }}>
        {s.detail}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        {s.trail.map((step, i) => (
          <span key={step.label} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {i > 0 ? (
              <ChevronRight size={11} strokeWidth={1.8} color="var(--ink-faint)" aria-hidden />
            ) : null}
            <span className="tabular-nums" style={{ fontSize: 11.5, color: "var(--ink)" }}>
              <strong style={{ fontWeight: 600 }}>{step.value}</strong>{" "}
              <span style={{ color: "var(--ink-faint)" }}>{step.label}</span>
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}
