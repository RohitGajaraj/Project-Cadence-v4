import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Coins,
  FileDiff,
  GitPullRequest,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import {
  getStudioSession,
  steerStudioSession,
  type StudioApproval,
  type StudioChangesetSummary,
  type StudioCi,
  type StudioRunDetail,
} from "@/lib/studio.functions";
import { SessionTimeline } from "@/components/studio/SessionTimeline";
import { ChangesPanel } from "@/components/studio/ChangesPanel";
import { CiPanel } from "@/components/studio/CiPanel";
import { CostPanel } from "@/components/studio/CostPanel";
import { StatusChip } from "@/components/studio/studio-ui";
import { fmtCost } from "@/components/studio/studio-format";

type Tab = "changes" | "pr" | "cost";
const TABS: Tab[] = ["changes", "pr", "cost"];

export const Route = createFileRoute("/_authenticated/studio/$missionId")({
  // Optional so existing dispatch surfaces can navigate without search;
  // the component defaults to the Changes tab.
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const t = search.tab;
    return { tab: (TABS as string[]).includes(t as string) ? (t as Tab) : undefined };
  },
  component: StudioSessionPage,
  head: () => ({ meta: [{ title: "Studio session · Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div className="p-8">
        <div className="rounded-xl border border-rose/30 bg-rose/5 p-6">
          <h2 className="text-lg font-semibold text-rose">Couldn't load this session</h2>
          <p className="mt-2 text-sm text-rose/70">
            {(error as Error)?.message ?? "Unknown error"}
          </p>
          <button
            onClick={reset}
            className="mt-4 rounded-md border hairline px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Retry
          </button>
        </div>
      </div>
    </AppShell>
  ),
});

type MissionRow = {
  id: string;
  title: string;
  goal: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type Steer = { id: string; message: string; created_at: string; consumed: boolean };

type ChangeRow = {
  id: string;
  path: string;
  op: string;
  base_chars: number;
  new_chars: number;
  updated_at: string;
};

function SteerComposer({ missionId, disabled }: { missionId: string; disabled: boolean }) {
  const qc = useQueryClient();
  const fSteer = useServerFn(steerStudioSession);
  const [message, setMessage] = useState("");
  const steer = useMutation({
    mutationFn: () => fSteer({ data: { missionId, message: message.trim() } }),
    onSuccess: () => {
      setMessage("");
      toast.success("Steer sent. The agent reads it at its next step.");
      qc.invalidateQueries({ queryKey: ["studio-session", missionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const canSend = !disabled && message.trim().length > 0 && !steer.isPending;

  return (
    <div className="bento p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSend) {
              e.preventDefault();
              steer.mutate();
            }
          }}
          rows={2}
          disabled={disabled}
          placeholder="Steer the session in plain language…"
          className="min-w-0 flex-1 resize-none rounded-lg border hairline bg-background/60 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => steer.mutate()}
          disabled={!canSend}
          aria-label="Send steer"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {steer.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Send
        </button>
      </div>
      {disabled && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Session completed. Steering is closed.
        </p>
      )}
    </div>
  );
}

function StudioSessionPage() {
  const { missionId } = Route.useParams();
  const tab = Route.useSearch().tab ?? "changes";
  const navigate = useNavigate({ from: "/studio/$missionId" });
  const qc = useQueryClient();

  const fProjects = useServerFn(listProjects);
  const fGet = useServerFn(getStudioSession);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const session = useQuery({
    queryKey: ["studio-session", missionId],
    queryFn: () => fGet({ data: { missionId } }),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 4000;
      const mission = d.mission as MissionRow | null;
      const missionLive = mission?.status === "running" || mission?.status === "queued";
      const runLive = (d.runs as StudioRunDetail[]).some((r) =>
        ["queued", "running", "waiting_approval"].includes(r.status),
      );
      return missionLive || runLive ? 4000 : false;
    },
  });

  const [showWorkOrder, setShowWorkOrder] = useState(false);

  const data = session.data;
  const mission = (data?.mission ?? null) as MissionRow | null;
  const runs = (data?.runs ?? []) as StudioRunDetail[];
  const changeset = (data?.changeset ?? null) as
    | (StudioChangesetSummary & { base_sha?: string | null; updated_at?: string | null })
    | null;
  const changes = (data?.changes ?? []) as ChangeRow[];
  const approvals = (data?.approvals ?? []) as StudioApproval[];
  const ci = (data?.ci ?? null) as StudioCi;
  const steers = (data?.steers ?? []) as Steer[];
  const totalCost = data?.total_cost_usd ?? 0;

  const isLive =
    mission?.status === "running" ||
    runs.some((r) => ["queued", "running", "waiting_approval"].includes(r.status));
  const mergeGatePending = approvals.some(
    (a) => a.status === "pending" && a.tool_name === "studio.pr.merge",
  );
  const invalidate = () => qc.invalidateQueries({ queryKey: ["studio-session", missionId] });

  const tabs: { id: Tab; label: string; Icon: typeof FileDiff; tone: string }[] = [
    {
      id: "changes",
      label: "Changes",
      Icon: FileDiff,
      tone: "bg-action-blue/10 text-action-blue border-action-blue/30",
    },
    {
      id: "pr",
      label: "PR & CI",
      Icon: GitPullRequest,
      tone: "bg-emerald/10 text-emerald border-emerald/30",
    },
    {
      id: "cost",
      label: "Cost",
      Icon: Coins,
      tone: "bg-saffron/10 text-saffron border-saffron/30",
    },
  ];

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="mx-auto max-w-[1400px] space-y-6 px-6 py-8 md:px-10">
        <div>
          <Link
            to="/studio"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> All sessions
          </Link>
          {mission && (
            <>
              <h1 className="mt-2 flex items-center gap-3 font-display text-2xl tracking-tight">
                {mission.title}
                <StatusChip status={mission.status} />
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>started {new Date(mission.created_at).toLocaleString()}</span>
                <span>·</span>
                <span className="tabular-nums">{fmtCost(totalCost)}</span>
                {isLive && (
                  <span className="inline-flex items-center gap-1 text-action-blue">
                    <Loader2 className="h-3 w-3 animate-spin" /> live · refreshing every 4s
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowWorkOrder((v) => !v)}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  {showWorkOrder ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  Work order
                </button>
              </div>
              {showWorkOrder && (
                <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-mono text-[11px]">
                  {mission.goal}
                </pre>
              )}
            </>
          )}
        </div>

        {session.isError ? (
          <div className="rounded-xl border hairline px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              This session could not load. {(session.error as Error)?.message?.slice(0, 160)}
            </p>
            <button
              onClick={() => session.refetch()}
              className="btn-pill-outline mt-3 px-3 py-1 text-xs"
            >
              Retry
            </button>
          </div>
        ) : session.isLoading || !data ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="min-w-0 space-y-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Session timeline
              </div>
              <SessionTimeline
                runs={runs}
                steers={steers}
                approvals={approvals}
                onChanged={invalidate}
              />
              <SteerComposer missionId={missionId} disabled={mission?.status === "completed"} />
            </div>

            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap gap-1 border-b hairline">
                {tabs.map((t) => {
                  const active = tab === t.id;
                  const Icon = t.Icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => navigate({ search: { tab: t.id } })}
                      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${
                        active
                          ? "border-foreground text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${t.tone} ${
                          active ? "ring-1 ring-foreground/20" : "opacity-80"
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {tab === "changes" && <ChangesPanel changeset={changeset} changes={changes} />}
              {tab === "pr" && (
                <CiPanel
                  missionId={missionId}
                  changeset={changeset}
                  ci={ci}
                  mergeGatePending={mergeGatePending}
                  onRefreshed={invalidate}
                />
              )}
              {tab === "cost" && <CostPanel runs={runs} total={totalCost} />}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
