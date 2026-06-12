import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  refreshStudioCi,
  type StudioChangesetSummary,
  type StudioCi,
} from "@/lib/studio.functions";
import { changesetTone } from "./studio-format";

function ciTone(s: string): string {
  if (s === "success") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (s === "failure") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  if (s === "pending") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-muted text-muted-foreground border-border";
}

function checkTone(conclusion: string | null, status: string): string {
  if (conclusion === "success") return "text-emerald-300";
  if (conclusion === "failure") return "text-rose-300";
  if (status !== "completed") return "text-amber-300";
  return "text-muted-foreground";
}

/**
 * PR & CI tab — PR link, branch, CI verdict with per-check rows, manual
 * refresh, and the merge gate pointer (the gate itself clears on the left).
 */
export function CiPanel({
  missionId,
  changeset,
  ci,
  mergeGatePending,
  onRefreshed,
}: {
  missionId: string;
  changeset: StudioChangesetSummary | null;
  ci: StudioCi;
  mergeGatePending: boolean;
  onRefreshed: () => void;
}) {
  const fRefresh = useServerFn(refreshStudioCi);
  const refresh = useMutation({
    mutationFn: () => fRefresh({ data: { missionId } }),
    onSuccess: () => {
      toast.success("CI refreshed");
      onRefreshed();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!changeset?.pr_url) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        No PR yet. The session opens one after the changeset commits.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bento p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <GitPullRequest className="h-4 w-4 text-cyan-300" />
          <a
            href={changeset.pr_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-foreground hover:underline"
          >
            PR #{changeset.pr_number}
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${changesetTone(changeset.status)}`}
          >
            {changeset.status}
          </span>
        </div>
        {changeset.branch && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            <span className="font-mono">{changeset.branch}</span>
          </div>
        )}
      </div>

      <div className="bento p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Checks
            {ci && (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] normal-case tracking-normal ${ciTone(ci.overall)}`}
              >
                {ci.overall}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="btn-pill-outline inline-flex items-center gap-1 px-3 py-1 text-xs disabled:opacity-50"
          >
            {refresh.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh CI
          </button>
        </div>
        <div className="mt-3 space-y-1.5">
          {!ci || ci.checks.length === 0 ? (
            <div className="text-[11px] italic text-muted-foreground">
              No checks reported yet. Refresh once CI starts.
            </div>
          ) : (
            ci.checks.map((c, i) => (
              <div key={`${c.name}-${i}`} className="flex items-center gap-2 text-[11px]">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${checkTone(c.conclusion, c.status)}`}
                />
                <span className="min-w-0 flex-1 truncate font-mono text-foreground/90">
                  {c.name}
                </span>
                <span className={checkTone(c.conclusion, c.status)}>
                  {c.conclusion ?? c.status}
                </span>
                {c.html_url && (
                  <a
                    href={c.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Open ${c.name} on GitHub`}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
        {ci?.updated_at && (
          <div className="mt-2 text-[10px] text-muted-foreground">
            Snapshot {new Date(ci.updated_at).toLocaleString()}
          </div>
        )}
      </div>

      {mergeGatePending && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span>The merge gate is waiting on you. Clear it from the timeline on the left.</span>
        </div>
      )}
    </div>
  );
}
