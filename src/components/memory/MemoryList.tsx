// The /memory body: a real-count summary strip over a list of MemoryCards.
// Every number is a head count from agent_memory - no estimates, no filler. The
// empty state is honest about there being nothing learned yet rather than
// implying the loop has done work it has not.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { getAgentMemory } from "@/lib/memory.functions";
import { kindLabel, relativeTime } from "@/lib/memory-view";
import { MonoLabel } from "@/components/cadence/Primitives";
import { MemoryCard } from "./MemoryCard";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function MemoryList() {
  const f = useServerFn(getAgentMemory);
  const q = useQuery({ queryKey: ["agent-memory"], queryFn: () => f({ data: {} }) });
  const now = Date.now();

  if (q.isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 2px" }}>
        <span className="spinner" />
        <span className="mono-label" style={{ fontSize: 9 }}>
          loading…
        </span>
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel style={{ marginBottom: 8 }}>memory · failed to load</MonoLabel>
        <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 12 }}>
          {(q.error as Error).message}
        </p>
        <button className="btn btn-ghost btn-sm" onClick={() => void q.refetch()}>
          Retry · reloads memory
        </button>
      </div>
    );
  }

  const rows = q.data?.rows ?? [];
  const summary = q.data?.summary;
  const totalAll = q.data?.totalAll ?? rows.length;

  if (rows.length === 0) {
    return (
      <div className="bento p-10 text-center">
        <Sparkles className="h-6 w-6 mx-auto text-violet-300/70" />
        <h3 className="font-display text-base mt-3">Nothing learned yet</h3>
        <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
          Memory fills in as the loop works. Record an outcome on a shipped spec, or let an agent
          reflect on a run, and the takeaway is stored here so the loop can recall it next time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Real-count summary - the moat in one line. */}
      <div
        className="band-stone"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 18px",
          flexWrap: "wrap",
        }}
      >
        <MonoLabel icon={Sparkles} style={{ color: "var(--ink)" }}>
          What the loop recalls
        </MonoLabel>
        <span className="mono-label" style={{ fontSize: 9 }}>
          <strong className="tabular-nums" style={{ color: "var(--ink)", fontWeight: 600 }}>
            {totalAll}
          </strong>{" "}
          stored
        </span>
        {summary?.byKind.map((k) => (
          <span key={k.kind} className="mono-label" style={{ fontSize: 9 }}>
            <strong className="tabular-nums" style={{ color: "var(--ink)", fontWeight: 600 }}>
              {k.count}
            </strong>{" "}
            {kindLabel(k.kind).toLowerCase()}
            {k.count === 1 ? "" : "s"}
          </span>
        ))}
        {summary && summary.agents.length > 0 ? (
          <span className="mono-label" style={{ fontSize: 9 }}>
            {plural(summary.agents.length, "source agent")}
          </span>
        ) : null}
        {summary?.lastLearnedAt ? (
          <span className="mono-label" style={{ fontSize: 9 }}>
            last learned {relativeTime(summary.lastLearnedAt, now)}
          </span>
        ) : null}
        <span style={{ flex: 1 }} />
        {totalAll > rows.length ? (
          <span className="mono-label" style={{ fontSize: 8.5 }}>
            showing the {rows.length} most recent
          </span>
        ) : null}
      </div>

      {rows.map((r) => (
        <MemoryCard key={r.id} row={r} now={now} />
      ))}
    </div>
  );
}
