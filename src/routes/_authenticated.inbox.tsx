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
  const map: Record<string, { label: string; Icon: typeof Clock; tone: "pending" | "ok" | "bad" | "muted" }> = {
    pending:  { label: "Pending",   Icon: Clock,         tone: "pending" },
    approved: { label: "Approved",  Icon: Check,         tone: "ok" },
    executed: { label: "Done",      Icon: CheckCheck,    tone: "ok" },
    rejected: { label: "Rejected",  Icon: X,             tone: "bad" },
    failed:   { label: "Failed",    Icon: AlertTriangle, tone: "bad" },
    cancelled:{ label: "Cancelled", Icon: XCircle,       tone: "muted" },
    expired:  { label: "Expired",   Icon: XCircle,       tone: "muted" },
  };
  const s = map[status] ?? map.pending;
  const { Icon } = s;
  const dot =
    s.tone === "ok" ? "bg-[var(--deep-green)]" :
    s.tone === "bad" ? "bg-[var(--coral)]" :
    s.tone === "pending" ? "bg-foreground" :
    "bg-muted-foreground";
  return (
    <span className="mono-label inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
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
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <div className="mono-label">Workspace · Governance gate</div>
          <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">Approvals</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground leading-relaxed">
            Agents queue write actions here when they need a human in the loop.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-1 border-b hairline">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setStatus(t.value)}
                className={`-mb-px px-3 py-2 text-xs border-b-2 transition-colors ${
                  status === t.value
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
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
          <div className="rounded-lg border border-dashed hairline py-16 text-center text-sm text-muted-foreground">
            No {status === "all" ? "" : status} approvals.
          </div>
        ) : (
          <div className="border-t hairline">
            {rows.map((a) => (
              <article key={a.id} className="rule-hairline py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mono-label flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>{a.agent_slug ?? "agent"}</span>
                      <span aria-hidden>/</span>
                      <span>{a.tool_name}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    {a.rationale && (
                      <p className="mt-3 font-display text-lg leading-snug text-foreground">{a.rationale}</p>
                    )}
                    <details className="mt-3">
                      <summary className="cursor-pointer link-action text-xs">View args</summary>
                      <pre className="mt-2 max-h-60 overflow-auto rounded-md border hairline bg-[var(--soft-stone)] p-3 text-[11px] leading-relaxed text-foreground">
                        {JSON.stringify(a.args, null, 2)}
                      </pre>
                    </details>
                    {a.error && (
                      <div className="mt-3 rounded-md border-l-2 border-[var(--coral)] bg-[color-mix(in_oklab,var(--coral)_8%,transparent)] px-3 py-2 text-xs text-foreground">
                        {a.error}
                      </div>
                    )}
                    <div className="mt-3 mono-label">
                      {new Date(a.created_at).toLocaleString()}
                    </div>
                  </div>
                  {a.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ approvalId: a.id, decision: "reject" })}
                        className="btn-pill-outline disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                      <button
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ approvalId: a.id, decision: "approve" })}
                        className="btn-pill disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve & run
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}