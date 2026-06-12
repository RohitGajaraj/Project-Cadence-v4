import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { decideApproval } from "@/lib/agent_loop.functions";
import type { StudioApproval } from "@/lib/studio.functions";
import { summarizeArgs } from "./studio-format";

/**
 * Inline governance gate for a Studio session — tool name, args summary,
 * rationale, and consequence-first approve/reject. Mirrors the chat surface's
 * inline approvals pattern in the cockpit's dark token language.
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
    <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-amber-300">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> Waiting on you
      </div>
      <div className="text-xs">
        <code className="rounded border hairline bg-background/60 px-1 py-0.5 font-mono text-[11px] text-foreground">
          {approval.tool_name}
        </code>
      </div>
      <div className="text-[11px] text-muted-foreground break-words">
        {summarizeArgs(approval.args)}
      </div>
      {approval.rationale && (
        <p className="text-[11px] italic text-muted-foreground">"{approval.rationale}"</p>
      )}
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => decide.mutate("approve")}
          disabled={decide.isPending}
          className="rounded-md border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
        >
          {decide.isPending ? "Deciding…" : "Approve · run"}
        </button>
        <button
          type="button"
          onClick={() => decide.mutate("reject")}
          disabled={decide.isPending}
          className="rounded-md border border-rose-400/30 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
        >
          Reject · nothing runs
        </button>
      </div>
    </div>
  );
}
