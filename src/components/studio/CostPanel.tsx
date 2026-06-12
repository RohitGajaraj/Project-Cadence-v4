import type { StudioRunDetail } from "@/lib/studio.functions";
import { StatusChip } from "./studio-ui";
import { fmtCost } from "./studio-format";

/** Cost tab — per-run model, status, tokens, and cost, with the session total. */
export function CostPanel({ runs, total }: { runs: StudioRunDetail[]; total: number }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        No runs yet, so nothing spent.
      </div>
    );
  }
  return (
    <div className="bento p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Spend by run
      </div>
      <div className="mt-3 divide-y divide-border/60">
        {runs.map((r, i) => (
          <div key={r.run_id} className="flex items-center gap-2 py-2 text-[11px]">
            <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">
              {i + 1}.
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-foreground/90">
              {r.model ?? "default model"}
            </span>
            <StatusChip status={r.status} />
            <span className="w-20 text-right tabular-nums text-muted-foreground">
              {r.tokens.toLocaleString()} tok
            </span>
            <span className="w-16 text-right tabular-nums text-foreground">
              {fmtCost(r.cost_usd)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t hairline pt-2 text-xs">
        <span className="text-muted-foreground">Session total</span>
        <span className="font-medium tabular-nums text-foreground">{fmtCost(total)}</span>
      </div>
    </div>
  );
}
