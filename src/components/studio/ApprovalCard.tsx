import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { decideApproval } from "@/lib/agent_loop.functions";
import type { StudioApproval } from "@/lib/studio.functions";
import { MonoLabel } from "@/components/cadence/Primitives";
import { summarizeArgs } from "./studio-format";

/** Consequence-first approve label — name what really happens per tool. */
function approveLabel(toolName: string): string {
  if (toolName === "studio.pr.merge") return "Approve · merges the PR";
  return `Approve · runs ${toolName}`;
}

/**
 * Inline governance gate for a Build session — the screen-3 GatePanel
 * contract: ember-tinted panel (the one voice that asks for attention),
 * tool name, args summary, rationale, consequence-first approve/reject.
 */
export function ApprovalCard({
  approval,
  onDecided,
}: {
  approval: StudioApproval;
  onDecided: () => void;
}) {
  const fDecide = useServerFn(decideApproval);
  const decide = useMutation({
    mutationFn: (decision: "approve" | "reject") =>
      fDecide({ data: { approvalId: approval.id, decision } }),
    onSuccess: (r, decision) => {
      toast.success(
        decision === "approve"
          ? r.executed
            ? "Approved. Tool executed."
            : "Approved."
          : "Rejected. Nothing runs.",
      );
      onDecided();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
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
      <div style={{ marginTop: 8 }}>
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            background: "var(--surface-1)",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            padding: "1px 6px",
          }}
        >
          {approval.tool_name}
        </code>
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 11.5,
          lineHeight: 1.55,
          color: "var(--ink-muted)",
          wordBreak: "break-word",
        }}
      >
        {summarizeArgs(approval.args)}
      </div>
      {approval.rationale ? (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 11.5,
            lineHeight: 1.55,
            fontStyle: "italic",
            color: "var(--ink-subtle)",
          }}
        >
          "{approval.rationale}"
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button
          type="button"
          className="btn btn-approve btn-sm"
          disabled={decide.isPending}
          onClick={() => decide.mutate("approve")}
        >
          {decide.isPending ? "Deciding…" : approveLabel(approval.tool_name)}
        </button>
        <button
          type="button"
          className="btn btn-reject btn-sm"
          disabled={decide.isPending}
          onClick={() => decide.mutate("reject")}
        >
          Reject · nothing runs
        </button>
      </div>
    </div>
  );
}
