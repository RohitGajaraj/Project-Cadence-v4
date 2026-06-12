// Approvals tab — ported 1:1 from design-reference/cadence/loop.jsx
// (GovernScreen tab "Approvals" + ApprovalCard + RiskTag): "{n} waiting"
// mono header with the real median response time, "Approve all low-risk"
// ghost, and the detailed approval card — StepDot, "{agent} wants {tool}"
// (agent mono ink, tool mono orchid), RiskTag, "in {mission}", expiry clock,
// summary, consequence-labeled approve/reject, Mission ↗ link. Resolved
// cards dim to 0.45 with the resolved mono line. Production functionality
// kept: decideApproval (approve EXECUTES the tool), extendApprovalTtl,
// the exact-args payload and execution errors — restyled quiet-Ember.
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Clock, ExternalLink, Shield, X } from "lucide-react";
import { toast } from "sonner";
import { decideApproval } from "@/lib/agent_loop.functions";
import { listGovernApprovals, extendApprovalTtl } from "@/lib/governance.functions";
import { MonoLabel, RiskTag, StepDot } from "@/components/cadence/Primitives";

type GovernApproval = Awaited<ReturnType<typeof listGovernApprovals>>["approvals"][number];

/** "expires in 2h" / "expired 3h ago" from the real expires_at. */
function relExpiry(iso: string | null): { text: string; expired: boolean } | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const m = Math.max(1, Math.round(abs / 60_000));
  const h = Math.round(abs / 3_600_000);
  const d = Math.round(abs / 86_400_000);
  const v = d >= 1 ? `${d}d` : h >= 1 ? `${h}h` : `${m}m`;
  return ms >= 0
    ? { text: `expires in ${v}`, expired: false }
    : { text: `expired ${v} ago`, expired: true };
}

function fmtMedian(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 1) return "<1m";
  if (m < 90) return `${m}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

/* Resolved mono line per the reference; production's extra terminal states
   (failed / cancelled / expired) get honest equivalents. */
const RESOLVED_LINE: Record<string, { text: string; color: string } | undefined> = {
  approved: { text: "approved · agent resumed", color: "var(--emerald)" },
  executed: { text: "approved · agent resumed", color: "var(--emerald)" },
  rejected: { text: "rejected · nothing ran", color: "var(--coral)" },
  failed: { text: "failed · the tool errored", color: "var(--rose)" },
  cancelled: { text: "cancelled · nothing ran", color: "var(--ink-faint)" },
  expired: { text: "expired · nothing ran", color: "var(--ink-faint)" },
};

export function ApprovalsPanel() {
  const fList = useServerFn(listGovernApprovals);
  const fDecide = useServerFn(decideApproval);
  const fExtend = useServerFn(extendApprovalTtl);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["govern-approvals"], queryFn: () => fList() });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ["govern-approvals"] });
    qc.invalidateQueries({ queryKey: ["governance"] });
  };

  const decide = useMutation({
    mutationFn: (v: { approvalId: string; decision: "approve" | "reject"; tool: string }) =>
      fDecide({ data: { approvalId: v.approvalId, decision: v.decision } }),
    onSuccess: (r, v) => {
      toast.success(
        v.decision === "approve"
          ? r.executed
            ? `Approved · ${v.tool} ran.`
            : "Approved."
          : "Rejected · nothing ran.",
      );
      inv();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      inv();
    },
  });

  const approveAll = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await fDecide({ data: { approvalId: id, decision: "approve" } });
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} low-risk approvals ran.`);
      inv();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      inv();
    },
  });

  const extend = useMutation({
    mutationFn: (approvalId: string) => fExtend({ data: { approvalId, additionalHours: 24 } }),
    onSuccess: () => {
      toast.success("Extended · 24h more on the clock.");
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load approvals
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(q.error as Error)?.message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => q.refetch()}
        >
          Retry · reloads the queue
        </button>
      </div>
    );
  }

  if (q.isLoading) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Loading approvals…
      </div>
    );
  }

  const all = q.data?.approvals ?? [];
  // Pending first (soonest expiry on top), resolved history below.
  const pending = all
    .filter((a) => a.status === "pending")
    .sort((x, y) => (x.expires_at ?? "9999").localeCompare(y.expires_at ?? "9999"));
  const resolved = all.filter((a) => a.status !== "pending");
  const rows = [...pending, ...resolved];
  const lowRisk = pending.filter((a) => a.risk === "low");
  const median = q.data?.medianResponseMs;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <MonoLabel icon={Shield}>
          {pending.length} waiting
          {median != null ? ` · median response ${fmtMedian(median)}` : ""}
        </MonoLabel>
        {lowRisk.length > 1 ? (
          <button
            className="btn btn-ghost btn-sm"
            disabled={approveAll.isPending}
            onClick={() => approveAll.mutate(lowRisk.map((a) => a.id))}
          >
            <Check size={11} />
            Approve all low-risk ({lowRisk.length})
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "32px 0",
            textAlign: "center",
          }}
        >
          Nothing waiting. Agents are running inside their lanes.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((a) => (
            <ApprovalCard
              key={a.id}
              a={a}
              busy={decide.isPending && decide.variables?.approvalId === a.id}
              extending={extend.isPending && extend.variables === a.id}
              onApprove={() =>
                decide.mutate({ approvalId: a.id, decision: "approve", tool: a.tool_name })
              }
              onReject={() =>
                decide.mutate({ approvalId: a.id, decision: "reject", tool: a.tool_name })
              }
              onExtend={() => extend.mutate(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* Detailed approval card — the richer layout from the reference, fed by
   production agent_approvals rows. */
function ApprovalCard({
  a,
  busy,
  extending,
  onApprove,
  onReject,
  onExtend,
}: {
  a: GovernApproval;
  busy: boolean;
  extending: boolean;
  onApprove: () => void;
  onReject: () => void;
  onExtend: () => void;
}) {
  const resolvedLine = a.status === "pending" ? undefined : RESOLVED_LINE[a.status];
  const resolved = a.status !== "pending";
  const expiry = a.status === "pending" ? relExpiry(a.expires_at) : null;
  const dot = resolved
    ? a.status === "approved" || a.status === "executed"
      ? "completed"
      : "failed"
    : "gate";
  return (
    <div
      className="fade-up lift"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        border: "1px solid var(--hairline)",
        borderRadius: 8,
        opacity: resolved ? 0.45 : 1,
        transition: "opacity var(--dur-slow)",
        background: "var(--canvas)",
      }}
    >
      <span style={{ marginTop: 5 }}>
        <StepDot status={dot} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span className="mono-label" style={{ color: "var(--ink)" }}>
            {a.agent_slug ?? "agent"}
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>wants</span>
          <span className="mono-label" style={{ color: "var(--agent)" }}>
            {a.tool_name}
          </span>
          <RiskTag risk={a.risk} />
          {a.mission_title ? (
            <>
              <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>in</span>
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{a.mission_title}</span>
            </>
          ) : null}
          <span style={{ flex: 1 }}></span>
          {expiry ? (
            <span
              className="mono-label"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                color: expiry.expired ? "var(--ember)" : undefined,
              }}
            >
              <Clock size={11} />
              {expiry.text}
            </span>
          ) : null}
        </div>
        {a.rationale ? (
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-muted)",
              margin: "4px 0 10px",
              lineHeight: 1.5,
            }}
          >
            {a.rationale}
          </p>
        ) : (
          <div style={{ height: 6 }} />
        )}
        {resolvedLine ? (
          <span className="mono-label" style={{ color: resolvedLine.color }}>
            {resolvedLine.text}
          </span>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-approve btn-sm" disabled={busy} onClick={onApprove}>
              <Check size={11} />
              Approve · runs {a.tool_name}
            </button>
            <button className="btn btn-reject btn-sm" disabled={busy} onClick={onReject}>
              <X size={11} />
              Reject · nothing runs
            </button>
            {a.mission_id ? (
              <Link
                className="btn btn-sm"
                style={{ color: "var(--action-blue)" }}
                to="/missions/$missionId"
                params={{ missionId: a.mission_id }}
              >
                Mission
                <ExternalLink size={11} />
              </Link>
            ) : null}
            <button className="btn btn-ghost btn-sm" disabled={extending} onClick={onExtend}>
              Extend · 24h more
            </button>
          </div>
        )}
        {a.error ? (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--rose)" }}>{a.error}</div>
        ) : null}
        <details style={{ marginTop: 8 }}>
          <summary
            className="mono-label"
            style={{ cursor: "pointer", color: "var(--ink-faint)", listStylePosition: "inside" }}
          >
            args · the exact payload
          </summary>
          <pre
            className="scrollbar-thin"
            style={{
              marginTop: 6,
              maxHeight: 200,
              overflow: "auto",
              border: "1px solid var(--hairline)",
              borderRadius: 8,
              background: "var(--surface-1)",
              padding: 10,
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            {JSON.stringify(a.args, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
