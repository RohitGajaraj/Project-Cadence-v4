import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X, Clock, AlertTriangle, CheckCheck, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { listApprovals, decideApproval } from "@/lib/agent_loop.functions";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: InboxPage,
  head: () => ({ meta: [{ title: "Approvals · Cadence" }] }),
});

type Status = "pending" | "approved" | "rejected" | "executed" | "failed" | "all";

const STATUS_TABS: { value: Status; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "executed", label: "Done" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
  { value: "all", label: "All" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
    pending:  { label: "Pending",  cls: "bg-amber-500/10 text-amber-300 border-amber-500/30", Icon: Clock },
    approved: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", Icon: Check },
    executed: { label: "Done",     cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", Icon: CheckCheck },
    rejected: { label: "Rejected", cls: "bg-rose-500/10 text-rose-300 border-rose-500/30", Icon: X },
    failed:   { label: "Failed",   cls: "bg-rose-500/10 text-rose-300 border-rose-500/30", Icon: AlertTriangle },
    cancelled:{ label: "Cancelled",cls: "bg-muted text-muted-foreground border-border", Icon: XCircle },
    expired:  { label: "Expired",  cls: "bg-muted text-muted-foreground border-border", Icon: XCircle },
  };
  const s = map[status] ?? map.pending;
  const { Icon } = s;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${s.cls}`}>
      <Icon className="h-3 w-3" /> {s.label}
    </span>
  );
}

function InboxPage() {
  const fProjects = useServerFn(listProjects);
  const fList = useServerFn(listApprovals);
  const fDecide = useServerFn(decideApproval);
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("pending");

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const approvals = useQuery({
    queryKey: ["approvals", status],
    queryFn: () => fList({ data: { status } }),
  });

  const decide = useMutation({
    mutationFn: (input: { approvalId: string; decision: "approve" | "reject" }) =>
      fDecide({ data: input }),
    onSuccess: (r, vars) => {
      toast.success(
        vars.decision === "approve"
          ? (r.executed ? "Approved & executed" : "Approved")
          : "Rejected",
      );
      qc.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = approvals.data?.approvals ?? [];

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-tight">Approvals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Agents queue write actions here when they need a human in the loop.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-background/40 p-1">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setStatus(t.value)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  status === t.value ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {approvals.isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
            No {status === "all" ? "" : status} approvals.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((a) => (
              <article key={a.id} className="rounded-xl border border-border bg-background/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{a.agent_slug ?? "agent"}</span>
                      <span>·</span>
                      <span className="font-mono">{a.tool_name}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    {a.rationale && (
                      <p className="mt-1.5 text-sm text-foreground/90">{a.rationale}</p>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        View args
                      </summary>
                      <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-muted/40 p-3 text-[11px] leading-relaxed">
                        {JSON.stringify(a.args, null, 2)}
                      </pre>
                    </details>
                    {a.error && (
                      <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
                        {a.error}
                      </div>
                    )}
                  </div>
                  {a.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ approvalId: a.id, decision: "reject" })}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                      <button
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ approvalId: a.id, decision: "approve" })}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve & run
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}