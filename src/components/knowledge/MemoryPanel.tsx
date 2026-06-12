// Memory — Knowledge tab 2, ported from design-reference/cadence/loop.jsx
// (KnowledgeScreen · Memory): 2fr/1fr grid, the learnings feed (mono when +
// text rows, search) and the band-stone "Product memory" stat list. All
// numbers are real head counts; learnings come from the outcome loop
// (outcome.functions.ts listLearnings) and lead with a VerdictChip — a
// recorded verdict (validated / mixed / missed), per the founder's
// inline-annotation ruling. The reference's "Ask memory" bento is NOT here:
// production has no ask-memory endpoint yet (see unported).
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search } from "lucide-react";
import { listLearnings } from "@/lib/outcome.functions";
import { getBrainStatus, getCompanyBrainStats } from "@/lib/brain.functions";
import { MonoLabel, VerdictChip, type VerdictTone } from "@/components/cadence/Primitives";

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

export function MemoryPanel() {
  const [q, setQ] = useState("");

  const fLearnings = useServerFn(listLearnings);
  const learnings = useQuery({ queryKey: ["learnings"], queryFn: () => fLearnings() });
  const fBrain = useServerFn(getBrainStatus);
  const brain = useQuery({ queryKey: ["brain-status"], queryFn: () => fBrain() });
  const fStats = useServerFn(getCompanyBrainStats);
  const stats = useQuery({ queryKey: ["company-brain-stats"], queryFn: () => fStats() });

  const rows = ((learnings.data?.learnings ?? []) as LearningRow[]).filter((l) =>
    l.summary.toLowerCase().includes(q.toLowerCase()),
  );

  if (learnings.isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 2px" }}>
        <span className="spinner" />
        <span className="mono-label" style={{ fontSize: 9 }}>
          loading…
        </span>
      </div>
    );
  }
  if (learnings.isError) {
    return (
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel style={{ marginBottom: 8 }}>memory · failed to load</MonoLabel>
        <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 12 }}>
          {(learnings.error as Error).message}
        </p>
        <button className="btn btn-ghost btn-sm" onClick={() => void learnings.refetch()}>
          Retry · reloads memory
        </button>
      </div>
    );
  }

  // Real counts only — rows render once each query resolves.
  const memoryStats: [string, string][] = [];
  if (brain.data) memoryStats.push(["Decisions on record", String(brain.data.counts.decisions)]);
  if (stats.data) memoryStats.push(["Learnings written", String(stats.data.learnings)]);
  if (brain.data) memoryStats.push(["Findings indexed", String(brain.data.counts.findings)]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <MonoLabel icon={BookOpen}>Learnings · written as outcomes land</MonoLabel>
          <span style={{ position: "relative", width: 200 }}>
            <Search
              size={12}
              style={{
                position: "absolute",
                left: 9,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-faint)",
              }}
            />
            <input
              className="input"
              value={q}
              placeholder="Search memory…"
              onChange={(e) => setQ(e.target.value)}
              style={{ paddingLeft: 28, fontSize: 12 }}
            />
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.length === 0 ? (
            <div style={{ padding: "18px 0", fontSize: 12.5, color: "var(--ink-faint)" }}>
              {q
                ? `Nothing in memory matches “${q}” yet. Learnings land here as outcomes are recorded.`
                : "Nothing in memory yet. Record an outcome on a shipped spec and its learning lands here."}
            </div>
          ) : (
            rows.map((l, i) => (
              <div
                key={l.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: i < rows.length - 1 ? "1px solid var(--hairline)" : "none",
                  fontSize: 13,
                }}
              >
                <span className="mono-label tabular-nums" style={{ width: 64, flexShrink: 0 }}>
                  {whenOf(l.created_at)}
                </span>
                <span style={{ flexShrink: 0, alignSelf: "flex-start" }}>
                  <VerdictChip tone={VERDICT_TONE[l.verdict]}>{l.verdict}</VerdictChip>
                </span>
                <span style={{ color: "var(--ink-muted)", lineHeight: 1.5, flex: 1, minWidth: 0 }}>
                  {l.summary}
                  {l.metric_label && l.metric_value ? (
                    <span
                      className="mono-label"
                      style={{ fontSize: 8.5, display: "block", marginTop: 4 }}
                    >
                      {l.metric_label} {l.metric_value}
                    </span>
                  ) : null}
                  {l.prior_ice != null && l.new_ice != null ? (
                    <span
                      className="mono-label tabular-nums"
                      style={{ fontSize: 8.5, display: "block", marginTop: 2 }}
                    >
                      ICE {l.prior_ice.toFixed(1)} → {l.new_ice.toFixed(1)}
                    </span>
                  ) : null}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="band-stone">
        <MonoLabel icon={BookOpen} style={{ marginBottom: 12 }}>
          Product memory
        </MonoLabel>
        {memoryStats.map(([l, v]) => (
          <div
            key={l}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "7px 0",
              borderBottom: "1px solid var(--hairline)",
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--ink-muted)" }}>{l}</span>
            <span className="font-display tabular-nums" style={{ fontSize: 16 }}>
              {v}
            </span>
          </div>
        ))}
        <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 12 }}>
          Every learning is tied back to the spec and opportunity that taught it.
        </p>
      </div>
    </div>
  );
}
