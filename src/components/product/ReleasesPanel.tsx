import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Rocket, Clock } from "lucide-react";
import { getOutcomeData } from "@/lib/outcome.functions";

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtUsd(n: number | string | null | undefined) {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  if (!v) return "$0";
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}

export function ReleasesPanel() {
  const fOutcome = useServerFn(getOutcomeData);
  const outcome = useQuery({ queryKey: ["outcome"], queryFn: () => fOutcome() });

  const releases = outcome.data?.releases;
  const empty = (releases?.missions.length ?? 0) === 0 && (releases?.runs.length ?? 0) === 0;

  return (
    <div className="space-y-4">
      {empty ? (
        <div className="bento p-8 text-center">
          <Rocket className="h-6 w-6 mx-auto text-violet-300/70" />
          <h3 className="font-display text-base mt-3">Releases will land here</h3>
          <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">
            When a Studio mission completes (PR merged, deploy webhook lands), it will appear here
            with the agent, duration, and cost.
          </p>
        </div>
      ) : (
        <>
          {(releases?.missions ?? []).map((m) => (
            <div key={m.id} className="bento p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    to="/missions/$missionId"
                    params={{ missionId: m.id }}
                    className="font-display text-base hover:underline"
                  >
                    {m.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.goal}</p>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {fmtTime(m.completed_at ?? m.updated_at)}
                </div>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                {m.hop_count} hop{m.hop_count === 1 ? "" : "s"} · mission complete
              </div>
            </div>
          ))}
          {(releases?.runs ?? []).slice(0, 10).map((r) => (
            <div key={r.id} className="bento p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm">{r.agent_name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.input}</div>
                </div>
                <div className="text-[10px] text-muted-foreground inline-flex items-center gap-3 shrink-0">
                  <span>{r.duration_ms ? `${Math.round(r.duration_ms / 100) / 10}s` : "—"}</span>
                  <span>{r.tokens_used.toLocaleString()} tok</span>
                  <span>{fmtUsd(r.spend_used_usd)}</span>
                  <span>{fmtTime(r.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
      {outcome.isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}
      {outcome.error && (
        <div className="text-xs text-destructive">{(outcome.error as Error).message}</div>
      )}
    </div>
  );
}
