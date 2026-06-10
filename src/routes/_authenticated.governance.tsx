import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ShieldAlert,
  PauseCircle,
  PlayCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  Trash2,
  Plus,
  SlidersHorizontal,
  Shield,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  getGovernanceOverview,
  setWorkspacePause,
  extendApprovalTtl,
  resolveApproval,
} from "@/lib/governance.functions";
import {
  listEventSubscriptions,
  upsertEventSubscription,
  deleteEventSubscription,
  listEventQueue,
  decideEventDispatch,
} from "@/lib/reactor.functions";
import { ApprovalsPanel } from "@/components/governance/ApprovalsPanel";
import { GuardrailsPanel } from "@/components/governance/GuardrailsPanel";
import { BudgetsPanel } from "@/components/governance/BudgetsPanel";

type Tab = "controls" | "approvals" | "guardrails" | "budgets";

export const Route = createFileRoute("/_authenticated/governance")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => {
    const t = search.tab;
    return { tab: t === "approvals" || t === "guardrails" || t === "budgets" ? t : "controls" };
  },
  component: GovernancePage,
  head: () => ({ meta: [{ title: "Governance · Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div className="p-8">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
          <h2 className="text-lg font-semibold text-rose-200">Couldn't load governance</h2>
          <p className="mt-2 text-sm text-rose-200/70">
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
  notFoundComponent: () => (
    <AppShell>
      <div className="p-8 text-muted-foreground">Not found.</div>
    </AppShell>
  ),
});

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const m = Math.round(abs / 60_000);
  const h = Math.round(abs / 3_600_000);
  const d = Math.round(abs / 86_400_000);
  const v = d >= 1 ? `${d}d` : h >= 1 ? `${h}h` : `${m}m`;
  return ms >= 0 ? `in ${v}` : `${v} ago`;
}

function GovernancePage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/governance" });

  const tabs: {
    id: Tab;
    label: string;
    description: string;
    Icon: typeof SlidersHorizontal;
    tone: "violet" | "emerald" | "sky" | "amber";
  }[] = [
    {
      id: "controls",
      label: "Controls",
      description: "Kill switch, mission caps, stuck approvals, auto-pipelines.",
      Icon: SlidersHorizontal,
      tone: "violet",
    },
    {
      id: "approvals",
      label: "Approvals",
      description: "Tool calls waiting on a human. Approve runs them; reject keeps them paused.",
      Icon: CheckCircle2,
      tone: "emerald",
    },
    {
      id: "guardrails",
      label: "Guardrails",
      description: "Rules that block, warn, or redact text on every AI call.",
      Icon: Shield,
      tone: "sky",
    },
    {
      id: "budgets",
      label: "Budgets",
      description: "Spend caps per day, month, and AI surface. Over-cap calls are blocked.",
      Icon: Wallet,
      tone: "amber",
    },
  ];
  const activeTab = tabs.find((t) => t.id === tab)!;
  const setTab = (next: Tab) => navigate({ search: { tab: next } });

  return (
    <AppShell>
      <div className="px-6 md:px-10 py-8 max-w-6xl mx-auto space-y-6">
        <header>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <ShieldAlert className="h-3 w-3" /> Govern
          </div>
          <h1 className="font-display text-3xl tracking-tight mt-1">Governance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            One place to set the rules, pause the swarm, and clear what's stuck.
          </p>
        </header>

        <div className="flex flex-wrap gap-1 border-b hairline">
          {tabs.map((t) => {
            const active = tab === t.id;
            const Icon = t.Icon;
            const toneIcon =
              t.tone === "violet"
                ? "bg-violet-500/10 text-violet-300 border-violet-500/30"
                : t.tone === "emerald"
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : t.tone === "sky"
                    ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
                    : "bg-amber-500/10 text-amber-300 border-amber-500/30";
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm border-b-2 -mb-px inline-flex items-center gap-2 ${active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${toneIcon} ${active ? "ring-1 ring-foreground/20" : "opacity-80"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">{activeTab.description}</p>

        {tab === "controls" && <ControlsPanel />}
        {tab === "approvals" && <ApprovalsPanel />}
        {tab === "guardrails" && <GuardrailsPanel />}
        {tab === "budgets" && <BudgetsPanel />}
      </div>
    </AppShell>
  );
}

function ControlsPanel() {
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const overviewFn = useServerFn(getGovernanceOverview);
  const pauseFn = useServerFn(setWorkspacePause);
  const extendFn = useServerFn(extendApprovalTtl);
  const resolveFn = useServerFn(resolveApproval);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["governance", "overview", activeWorkspaceId],
    queryFn: () => overviewFn({ data: { workspaceId: activeWorkspaceId ?? null } }),
  });

  // ---- F-AGENT-3 reactor state ----
  const listSubsFn = useServerFn(listEventSubscriptions);
  const upsertSubFn = useServerFn(upsertEventSubscription);
  const deleteSubFn = useServerFn(deleteEventSubscription);
  const listQueueFn = useServerFn(listEventQueue);
  const decideEvtFn = useServerFn(decideEventDispatch);

  const subsQ = useQuery({
    queryKey: ["reactor", "subs", activeWorkspaceId],
    queryFn: () => listSubsFn({ data: { workspaceId: activeWorkspaceId ?? null } }),
  });
  const queueQ = useQuery({
    queryKey: ["reactor", "queue", activeWorkspaceId],
    queryFn: () => listQueueFn({ data: { workspaceId: activeWorkspaceId ?? null } }),
    refetchInterval: 5000,
  });

  type UpsertSubInput = {
    id?: string;
    workspaceId?: string;
    event_type: "signal.created" | "opportunity.scored" | "prd.approved";
    target_agent_slug: string;
    approval_mode: "auto" | "confirm";
    enabled?: boolean;
    filter?: Record<string, unknown>;
  };
  const upsertSubMut = useMutation({
    mutationFn: (v: UpsertSubInput) => upsertSubFn({ data: v }),
    onSuccess: () => {
      toast.success("Subscription saved");
      qc.invalidateQueries({ queryKey: ["reactor", "subs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteSubMut = useMutation({
    mutationFn: (id: string) => deleteSubFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Subscription removed");
      qc.invalidateQueries({ queryKey: ["reactor", "subs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const decideEvtMut = useMutation({
    mutationFn: (v: { eventId: string; decision: "approve" | "reject" }) =>
      decideEvtFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.decision === "approve" ? "Dispatching…" : "Skipped");
      qc.invalidateQueries({ queryKey: ["reactor"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newEvent, setNewEvent] = useState<
    "signal.created" | "opportunity.scored" | "prd.approved"
  >("signal.created");
  const [newAgent, setNewAgent] = useState("discovery");
  const [newMode, setNewMode] = useState<"auto" | "confirm">("confirm");
  const [newMinScore, setNewMinScore] = useState("8");

  const [reason, setReason] = useState("");

  const pauseMut = useMutation({
    mutationFn: (next: boolean) =>
      pauseFn({ data: { workspaceId: activeWorkspaceId!, paused: next, reason: reason || null } }),
    onSuccess: (_d, next) => {
      toast.success(next ? "Workspace paused" : "Workspace resumed");
      setReason("");
      qc.invalidateQueries({ queryKey: ["governance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const extendMut = useMutation({
    mutationFn: (approvalId: string) => extendFn({ data: { approvalId, additionalHours: 24 } }),
    onSuccess: () => {
      toast.success("Extended by 24h");
      qc.invalidateQueries({ queryKey: ["governance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveMut = useMutation({
    mutationFn: (v: { approvalId: string; decision: "approved" | "rejected" }) =>
      resolveFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.decision === "approved" ? "Approved" : "Rejected");
      qc.invalidateQueries({ queryKey: ["governance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ks = data?.killState;
  const paused = !!(ks?.system_paused || ks?.workspace_paused);
  const inflight = (data?.runs ?? []).filter(
    (r) => r.status === "running" || r.status === "halted",
  );
  const expiringApprovals = data?.approvals ?? [];

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border hairline px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {/* Kill-switch panel */}
      <section
        className={`rounded-2xl border p-6 ${paused ? "border-rose-500/40 bg-rose-500/5" : "hairline bg-secondary/20"}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {paused ? (
              <PauseCircle className="h-6 w-6 text-rose-300 mt-0.5" />
            ) : (
              <PlayCircle className="h-6 w-6 text-emerald-300 mt-0.5" />
            )}
            <div>
              <div className="text-sm font-semibold">
                {ks?.system_paused
                  ? "System is paused (admin)"
                  : ks?.workspace_paused
                    ? `Workspace "${activeWorkspace?.name ?? ""}" is paused`
                    : "All systems go"}
              </div>
              {ks?.reason && (
                <div className="text-xs text-muted-foreground mt-1">Reason: {ks.reason}</div>
              )}
              {!paused && (
                <div className="text-xs text-muted-foreground mt-1">
                  Agents in this workspace can make AI calls and run missions.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              paused
                ? "(Optional) note when resuming"
                : "Why are you pausing? (visible in audit log)"
            }
            className="flex-1 rounded-lg border hairline bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-violet-400"
            disabled={pauseMut.isPending || ks?.system_paused || !activeWorkspaceId}
          />
          <button
            type="button"
            disabled={pauseMut.isPending || ks?.system_paused || !activeWorkspaceId}
            onClick={() => pauseMut.mutate(!ks?.workspace_paused)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              ks?.workspace_paused
                ? "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 border border-emerald-500/40"
                : "bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 border border-rose-500/40"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {ks?.workspace_paused ? "Resume workspace" : "Pause workspace"}
          </button>
        </div>
        {ks?.system_paused && (
          <div className="mt-3 text-xs text-rose-200/70">
            System-wide pause is active. Workspace toggle is disabled until system is resumed.
          </div>
        )}
      </section>

      {/* Mission caps panel */}
      <section className="rounded-2xl border hairline p-6 bg-secondary/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Recent missions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Per-mission token and spend usage. Halted missions show the governance reason.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{inflight.length} active or halted</span>
        </div>
        <div className="mt-4 divide-y hairline">
          {(data?.runs ?? []).length === 0 && !isLoading && (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No mission runs yet.
            </div>
          )}
          {(data?.runs ?? []).map((r) => {
            const tokPct = r.mission_token_cap
              ? Math.min(100, ((r.tokens_used ?? 0) / r.mission_token_cap) * 100)
              : null;
            const spendPct = r.mission_spend_cap_usd
              ? Math.min(100, ((r.spend_used_usd ?? 0) / Number(r.mission_spend_cap_usd)) * 100)
              : null;
            const halted = r.status === "halted" || !!r.halted_reason;
            return (
              <div key={r.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium truncate">{r.agent_name}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${
                        halted
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                          : r.status === "running"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                            : "border-muted-foreground/30 bg-secondary/40 text-muted-foreground"
                      }`}
                    >
                      {halted ? "halted" : r.status}
                    </span>
                  </div>
                  {halted && r.halted_reason && (
                    <div className="text-xs text-rose-300/80 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {r.halted_reason}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground space-y-1 w-56">
                  <div>
                    Tokens: <span className="text-foreground font-mono">{r.tokens_used ?? 0}</span>
                    {r.mission_token_cap ? (
                      <span> / {r.mission_token_cap}</span>
                    ) : (
                      <span className="text-muted-foreground/60"> (no cap)</span>
                    )}
                    {tokPct !== null && (
                      <div className="h-1 rounded bg-secondary/60 mt-0.5 overflow-hidden">
                        <div
                          className={`h-full ${tokPct >= 90 ? "bg-rose-400" : tokPct >= 70 ? "bg-amber-400" : "bg-emerald-400"}`}
                          style={{ width: `${tokPct}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                  <div>
                    Spend:{" "}
                    <span className="text-foreground font-mono">
                      ${Number(r.spend_used_usd ?? 0).toFixed(4)}
                    </span>
                    {r.mission_spend_cap_usd ? (
                      <span> / ${Number(r.mission_spend_cap_usd).toFixed(4)}</span>
                    ) : (
                      <span className="text-muted-foreground/60"> (no cap)</span>
                    )}
                    {spendPct !== null && (
                      <div className="h-1 rounded bg-secondary/60 mt-0.5 overflow-hidden">
                        <div
                          className={`h-full ${spendPct >= 90 ? "bg-rose-400" : spendPct >= 70 ? "bg-amber-400" : "bg-emerald-400"}`}
                          style={{ width: `${spendPct}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stale approvals */}
      <section className="rounded-2xl border hairline p-6 bg-secondary/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Pending & expired approvals</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Approvals auto-expire 24h after creation. Extend or decide each one.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{expiringApprovals.length} shown</span>
        </div>
        <div className="mt-4 divide-y hairline">
          {expiringApprovals.length === 0 && !isLoading && (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No approvals waiting.
            </div>
          )}
          {expiringApprovals.map((a) => {
            const isExpired = a.escalation_state === "expired";
            return (
              <div key={a.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs">{a.tool_name}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground text-xs">{a.agent_slug ?? "—"}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${
                        isExpired
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-200"
                      }`}
                    >
                      {a.escalation_state}
                    </span>
                  </div>
                  {a.rationale && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {a.rationale}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Expires {formatRelative(a.expires_at)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={extendMut.isPending}
                    onClick={() => extendMut.mutate(a.id)}
                    className="rounded-md border hairline px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition"
                    title="Extend TTL 24h"
                  >
                    +24h
                  </button>
                  <button
                    type="button"
                    disabled={resolveMut.isPending}
                    onClick={() => resolveMut.mutate({ approvalId: a.id, decision: "approved" })}
                    className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 transition inline-flex items-center gap-1"
                    title="Approve — runs the tool call. Reject keeps it paused."
                  >
                    <CheckCircle2 className="h-3 w-3" /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={resolveMut.isPending}
                    onClick={() => resolveMut.mutate({ approvalId: a.id, decision: "rejected" })}
                    className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20 transition inline-flex items-center gap-1"
                    title="Reject — nothing runs. The mission stays paused on this step."
                  >
                    <XCircle className="h-3 w-3" /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Event reactor — subscriptions */}
      <section className="rounded-2xl border hairline p-6 bg-secondary/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-300" /> Auto-pipelines
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              When a signal, opportunity, or PRD event fires, route it to an agent.{" "}
              <span className="text-foreground">auto</span> dispatches immediately;{" "}
              <span className="text-foreground">confirm</span> waits for you to approve below.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {(subsQ.data?.subscriptions ?? []).length} rules
          </span>
        </div>

        <div className="mt-4 divide-y hairline">
          {(subsQ.data?.subscriptions ?? []).map((s) => (
            <div key={s.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs">{s.event_type}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">{s.target_agent_slug}</span>
                  <span
                    className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${
                      s.approval_mode === "auto"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    {s.approval_mode}
                  </span>
                  {!s.enabled && (
                    <span className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border border-muted-foreground/30 bg-secondary/40 text-muted-foreground">
                      disabled
                    </span>
                  )}
                  {s.is_default && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      default
                    </span>
                  )}
                </div>
                {Object.keys((s.filter as Record<string, unknown>) ?? {}).length > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                    filter: {JSON.stringify(s.filter)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    upsertSubMut.mutate({
                      id: s.id,
                      event_type: s.event_type as UpsertSubInput["event_type"],
                      target_agent_slug: s.target_agent_slug,
                      approval_mode: s.approval_mode as "auto" | "confirm",
                      enabled: !s.enabled,
                      filter: (s.filter as Record<string, unknown>) ?? {},
                    })
                  }
                  className="rounded-md border hairline px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition"
                >
                  {s.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteSubMut.mutate(s.id)}
                  className="rounded-md border hairline px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10 transition inline-flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          {(subsQ.data?.subscriptions ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No reactor rules yet.
            </div>
          )}
        </div>

        {/* Add subscription form */}
        <div className="mt-4 pt-4 border-t hairline grid grid-cols-1 sm:grid-cols-5 gap-2">
          <select
            value={newEvent}
            onChange={(e) => setNewEvent(e.target.value as typeof newEvent)}
            className="rounded-lg border hairline bg-background/60 px-2 py-1.5 text-xs"
          >
            <option value="signal.created">signal.created</option>
            <option value="opportunity.scored">opportunity.scored</option>
            <option value="prd.approved">prd.approved</option>
          </select>
          <input
            type="text"
            value={newAgent}
            onChange={(e) => setNewAgent(e.target.value)}
            placeholder="agent slug (e.g. discovery)"
            className="rounded-lg border hairline bg-background/60 px-2 py-1.5 text-xs"
          />
          <select
            value={newMode}
            onChange={(e) => setNewMode(e.target.value as typeof newMode)}
            className="rounded-lg border hairline bg-background/60 px-2 py-1.5 text-xs"
          >
            <option value="confirm">confirm</option>
            <option value="auto">auto</option>
          </select>
          <input
            type="text"
            value={newMinScore}
            onChange={(e) => setNewMinScore(e.target.value)}
            placeholder="min ICE (opp only)"
            className="rounded-lg border hairline bg-background/60 px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={upsertSubMut.isPending}
            onClick={() => {
              const filter: Record<string, unknown> = {};
              if (newEvent === "opportunity.scored" && newMinScore.trim()) {
                const n = Number(newMinScore);
                if (Number.isFinite(n)) filter.min_score = n;
              }
              upsertSubMut.mutate({
                event_type: newEvent,
                target_agent_slug: newAgent.trim(),
                approval_mode: newMode,
                enabled: true,
                filter,
              });
            }}
            className="rounded-lg border hairline px-3 py-1.5 text-xs hover:bg-secondary inline-flex items-center justify-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add rule
          </button>
        </div>
      </section>

      {/* Event reactor — recent queue */}
      <section className="rounded-2xl border hairline p-6 bg-secondary/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Reactor activity</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Events the reactor has caught. Confirm-mode rows wait for your decision.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {(queueQ.data?.events ?? []).length} shown
          </span>
        </div>
        <div className="mt-4 divide-y hairline">
          {(queueQ.data?.events ?? []).map((e) => {
            const title =
              ((e.payload as Record<string, unknown>)?.title as string) ?? e.source_id.slice(0, 8);
            const isPending = e.status === "pending";
            return (
              <div key={e.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs">{e.event_type}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{e.target_agent_slug}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${
                        e.status === "dispatched"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          : e.status === "failed"
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                            : e.status === "skipped"
                              ? "border-muted-foreground/30 bg-secondary/40 text-muted-foreground"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-200"
                      }`}
                    >
                      {e.status}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {e.approval_mode}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">{title}</div>
                  {e.error && <div className="text-xs text-rose-300/80 mt-1">{e.error}</div>}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
                {isPending && e.approval_mode === "confirm" && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={decideEvtMut.isPending}
                      onClick={() => decideEvtMut.mutate({ eventId: e.id, decision: "approve" })}
                      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 transition inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Dispatch
                    </button>
                    <button
                      type="button"
                      disabled={decideEvtMut.isPending}
                      onClick={() => decideEvtMut.mutate({ eventId: e.id, decision: "reject" })}
                      className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20 transition inline-flex items-center gap-1"
                    >
                      <XCircle className="h-3 w-3" /> Skip
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {(queueQ.data?.events ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No reactor events yet.
            </div>
          )}
        </div>
      </section>

      {isLoading && <div className="text-xs text-muted-foreground">Loading governance state…</div>}
    </div>
  );
}
