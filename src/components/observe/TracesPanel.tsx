import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { listTraces } from "@/lib/traces.functions";

function fmtMs(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
function fmtUsd(n: number) {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

export function TracesPanel() {
  const fList = useServerFn(listTraces);
  const [days, setDays] = useState(7);
  const [status, setStatus] = useState<"all" | "ok" | "error">("all");

  const traces = useQuery({
    queryKey: ["traces", days, status],
    queryFn: () => fList({ data: { days, status, limit: 100 } }),
  });

  const rows = traces.data?.traces ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 text-xs">
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-md border border-border bg-background px-2 py-1.5">
          <option value={1}>24h</option><option value={7}>7d</option>
          <option value={14}>14d</option><option value={30}>30d</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as "all" | "ok" | "error")}
          className="rounded-md border border-border bg-background px-2 py-1.5">
          <option value="all">All</option>
          <option value="ok">Successful</option>
          <option value="error">Errors</option>
        </select>
      </div>

      {traces.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          No traces in this window. Trigger an agent run or AI chat to populate.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Root surface</th>
                <th className="px-4 py-2 text-right">Spans</th>
                <th className="px-4 py-2 text-right">Wall</th>
                <th className="px-4 py-2 text-right">CPU</th>
                <th className="px-4 py-2 text-right">Tokens</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2 text-left">Models</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.trace_id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(t.last_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] font-mono">{t.root_surface}</span>
                    {t.errors > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">
                        <AlertTriangle className="h-3 w-3" /> {t.errors}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.spans}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmtMs(t.wall_ms || t.latency_ms)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmtMs(t.latency_ms)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.tokens.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtUsd(t.cost)}</td>
                  <td className="px-4 py-2 text-[11px] text-muted-foreground truncate max-w-[200px]">
                    {t.models.join(", ")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to="/traces/$traceId"
                      params={{ traceId: t.trace_id }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                    >
                      Open <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}