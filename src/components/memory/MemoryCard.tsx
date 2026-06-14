// One agent_memory row. The recall line (last_used_at) leads because a memory
// the loop keeps reaching for is the compounding signal; a never-recalled row
// says so plainly rather than implying it was used.
import type { MemoryRow } from "@/lib/memory-view";
import { agentLabel, kindBlurb, kindLabel, relativeTime, scopeLabel } from "@/lib/memory-view";

export function MemoryCard({ row, now }: { row: MemoryRow; now: number }) {
  const recalled = row.lastUsedAt
    ? `recalled ${relativeTime(row.lastUsedAt, now)}`
    : "not recalled yet";
  const blurb = kindBlurb(row.kind);
  return (
    <div className="bento p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[10px] uppercase tracking-wider rounded-full bg-secondary px-2 py-0.5">
            {kindLabel(row.kind)}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {scopeLabel(row.scope)}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{recalled}</div>
      </div>
      <p className="text-sm mt-2 leading-relaxed">{row.content}</p>
      <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground flex-wrap">
        <span>from {agentLabel(row.agentSlug)}</span>
        <span aria-hidden>·</span>
        <span>saved {relativeTime(row.createdAt, now)}</span>
        {blurb ? (
          <>
            <span aria-hidden>·</span>
            <span className="italic">{blurb}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
