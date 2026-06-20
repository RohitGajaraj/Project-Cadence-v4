// CompoundingPanel — Brain → Learnings tab landing (MOAT-VIS).
//
// "Make the compounding visible": the outcome loop (recordOutcome) re-scores an
// opportunity's ICE from a real-world verdict and records WHY in a `learnings`
// row. This panel surfaces that as the felt moat artifact: a one-line summary of
// how many decisions memory has re-scored from real outcomes (net ICE movement),
// then the cause-carrying feed (verdict + opportunity + ICE delta + what
// happened), each row drilling to ?learning= for the full detail.
//
// Reads getCompounding (today.functions.ts) which shares the pure summarizer in
// moat-vis.ts, so this feed and Today's "what changed" line never drift. Calm
// front: the VerdictChip carries the only role color; the ICE delta is neutral
// ink with a sign, not a loud green/red. Replaces the old MemoryPanel learnings
// landing on this tab, leading with the aggregate compounding line it lacked
// (the separate "memory" tab still renders agent recall via MemoryList).
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { getCompounding } from "@/lib/today.functions";
import { describeCompounding } from "@/lib/moat-vis";
import { MonoLabel, VerdictChip, type VerdictTone } from "@/components/cadence/Primitives";

const VERDICT_TONE: Record<"validated" | "missed" | "mixed", VerdictTone> = {
  validated: "moss",
  missed: "madder",
  mixed: "ember",
};

/** Same "when" rhythm as LearningDetail: time today, "Yesterday", else "Jun 9". */
function whenOf(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function CompoundingPanel() {
  const fetchCompounding = useServerFn(getCompounding);
  const q = useQuery({ queryKey: ["compounding"], queryFn: () => fetchCompounding() });

  const summary = q.data?.summary;
  const rescores = q.data?.rescores ?? [];
  const headline = summary ? describeCompounding(summary) : null;

  if (q.isLoading) {
    return (
      <div
        className="bento"
        style={{ padding: "16px var(--card-pad)", color: "var(--ink-subtle)" }}
      >
        <MonoLabel icon={RefreshCw}>Compounding</MonoLabel>
        <p style={{ fontSize: 12.5, marginTop: 8 }}>Reading the outcome loop…</p>
      </div>
    );
  }

  if (q.isError) {
    // A load failure must read as a failure, not as "the loop produced nothing"
    // (mirrors DecisionsPanel's error contract). Otherwise a transient server-fn
    // error would be disguised as a proven-empty compounding story.
    return (
      <div className="bento" style={{ padding: "16px var(--card-pad)" }}>
        <MonoLabel icon={RefreshCw}>Compounding · failed to load</MonoLabel>
        <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 8 }}>
          {(q.error as Error)?.message ?? "Unknown error"}
        </p>
      </div>
    );
  }

  if (!rescores.length) {
    // Quiet, honest empty state: the loop has not re-scored anything yet.
    return (
      <div className="bento" style={{ padding: "16px var(--card-pad)" }}>
        <MonoLabel icon={RefreshCw}>Compounding</MonoLabel>
        <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", marginTop: 8, lineHeight: 1.5 }}>
          No decision has been re-scored from a real outcome yet. When you record what a shipped bet
          actually did, memory moves its priority and the change shows up here.
        </p>
      </div>
    );
  }

  return (
    <div className="bento" style={{ padding: "16px var(--card-pad)" }}>
      <MonoLabel icon={RefreshCw}>Compounding</MonoLabel>

      {/* The moat made visible: one honest line + a calm stat row. */}
      {headline && (
        <p
          style={{
            fontFamily: "var(--font-serif, Georgia, serif)",
            fontSize: 15,
            color: "var(--ink)",
            margin: "10px 0 4px",
            lineHeight: 1.4,
          }}
        >
          {headline}
        </p>
      )}
      {summary && (
        <p style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginBottom: 14 }}>
          {summary.movedUp} moved up · {summary.movedDown} moved down · {summary.validatedCount}{" "}
          validated · {summary.missedCount} missed
        </p>
      )}

      {/* The cause-carrying feed: each re-score and what drove it. */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rescores.map((r, i) => (
          <Link
            key={r.id}
            to="/knowledge"
            search={{ tab: "learnings", learning: r.id }}
            style={{
              display: "block",
              textDecoration: "none",
              color: "inherit",
              padding: "12px 0",
              borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <VerdictChip tone={VERDICT_TONE[r.verdict]}>{r.verdict}</VerdictChip>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                {r.opportunity_title ?? "a priority"}
              </span>
              <span style={{ fontSize: 12, color: "var(--ink-subtle)" }}>
                ICE {r.priorIce.toFixed(1)} {r.delta > 0 ? "↑" : "↓"} {r.newIce.toFixed(1)}
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-subtle)", marginLeft: "auto" }}>
                {whenOf(r.created_at)}
              </span>
            </div>
            {r.summary && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--ink-subtle)",
                  marginTop: 6,
                  lineHeight: 1.45,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {r.summary}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
