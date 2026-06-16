import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  refreshStudioCi,
  type StudioChangesetSummary,
  type StudioCi,
} from "@/lib/studio.functions";
import { MonoLabel, StatusBadge, StepDot, VerdictChip } from "@/components/cadence/Primitives";
import { ChangesetChip } from "./studio-ui";

/** Per-check StepDot vocabulary — live = running, outcomes = moss/madder. */
function checkDotStatus(conclusion: string | null, status: string): string {
  if (conclusion === "success") return "completed";
  if (conclusion === "failure") return "failed";
  if (status !== "completed") return "running";
  return "planned";
}

/* The overall CI verdict — a rendered OUTCOME wears a VerdictChip
   (moss PASS / madder FAIL); CI still running is LIVE state and wears a
   StatusBadge — the law, never swapped. */
function CiVerdict({ overall }: { overall: Exclude<StudioCi, null>["overall"] }) {
  if (overall === "success") return <VerdictChip tone="moss">pass</VerdictChip>;
  if (overall === "failure") return <VerdictChip tone="madder">fail</VerdictChip>;
  if (overall === "pending") return <StatusBadge status="running" />;
  return (
    <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
      {overall}
    </span>
  );
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
      toast.success("Checks refreshed");
      onRefreshed();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!changeset?.pr_url) {
    return (
      <div
        style={{
          border: "1px dashed var(--hairline)",
          borderRadius: 12,
          padding: "48px 0",
          textAlign: "center",
          fontSize: 12.5,
          color: "var(--ink-faint)",
        }}
      >
        No PR yet. The session opens one after the changeset commits.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <a
            href={changeset.pr_url}
            target="_blank"
            rel="noreferrer"
            className="mono-label tabular-nums"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: "var(--action-blue)",
            }}
          >
            PR #{changeset.pr_number}
            <ExternalLink size={9} />
          </a>
          <ChangesetChip status={changeset.status} />
        </div>
        {changeset.branch ? (
          <div
            style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8, minWidth: 0 }}
          >
            <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
              branch
            </span>
            <span
              className="truncate"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--ink-muted)",
                minWidth: 0,
              }}
            >
              {changeset.branch}
            </span>
          </div>
        ) : null}
      </div>

      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MonoLabel>Checks</MonoLabel>
            {ci ? <CiVerdict overall={ci.overall} /> : null}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            {refresh.isPending ? (
              <span className="spinner" style={{ width: 11, height: 11 }} />
            ) : (
              <RefreshCw size={11} />
            )}
            Refresh · re-reads CI
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          {!ci || ci.checks.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)", fontStyle: "italic" }}>
              No checks reported yet. Refresh once CI starts.
            </div>
          ) : (
            ci.checks.map((c, i) => (
              <div
                key={`${c.name}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 0",
                  borderBottom: i < ci.checks.length - 1 ? "1px solid var(--hairline)" : "none",
                }}
              >
                <StepDot status={checkDotStatus(c.conclusion, c.status)} />
                <span
                  className="truncate"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    color: "var(--ink)",
                  }}
                >
                  {c.name}
                </span>
                <span className="mono-label" style={{ color: "var(--ink-muted)" }}>
                  {c.conclusion ?? c.status}
                </span>
                {c.html_url ? (
                  <a
                    href={c.html_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${c.name} on GitHub`}
                    style={{ color: "var(--action-blue)", display: "inline-flex" }}
                  >
                    <ExternalLink size={9} />
                  </a>
                ) : null}
              </div>
            ))
          )}
        </div>
        {ci?.updated_at ? (
          <div className="mono-label" style={{ marginTop: 10, color: "var(--ink-faint)" }}>
            snapshot · {new Date(ci.updated_at).toLocaleString()}
          </div>
        ) : null}
      </div>

      {mergeGatePending ? (
        <div
          className="fade-up"
          style={{
            background: "color-mix(in oklab, var(--ember) 9%, transparent)",
            border: "1px solid color-mix(in oklab, var(--ember) 35%, transparent)",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <MonoLabel icon={ShieldAlert} style={{ color: "var(--ember)", fontWeight: 700 }}>
            Waiting on you
          </MonoLabel>
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--ink-muted)" }}>
            The merge gate is waiting on you. Clear it from the timeline on the left.
          </p>
        </div>
      ) : null}
    </div>
  );
}
