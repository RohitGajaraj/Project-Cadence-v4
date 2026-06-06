import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Activity, ArrowRight, Bot, GitBranch, Inbox, ShieldAlert, Zap } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { useWorkspace } from "@/hooks/use-workspace";
import { getSwarmHud, type SwarmHud } from "@/lib/swarm.functions";
import { resolveApproval } from "@/lib/governance.functions";
import { decideEventDispatch } from "@/lib/reactor.functions";

export const Route = createFileRoute("/_authenticated/swarm")({
  component: SwarmPage,
  head: () => ({ meta: [{ title: "Swarm HUD · Cadence" }] }),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div className="p-8">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
          <h2 className="text-lg font-semibold text-destructive">Couldn't load the swarm</h2>
          <p className="mt-2 text-sm text-muted-foreground">{(error as Error)?.message ?? "Unknown error"}</p>
          <button onClick={reset} className="mt-4 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">Retry</button>
        </div>
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell><div className="p-8 text-muted-foreground">Not found.</div></AppShell>
  ),
});

function relative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(ms);
  const s = Math.round(abs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(abs / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(abs / 3_600_000);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(abs / 86_400_000)}d ago`;
}

function runStatusTone(s: string | null): string {
  if (!s) return "bg-muted text-muted-foreground border-border";
  if (s === "running") return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
  if (s === "completed") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (s === "failed" || s === "halted") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  if (s === "paused" || s === "queued") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-muted text-muted-foreground border-border";
}

function eventStatusTone(s: string): string {
  if (s === "dispatched") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (s === "failed") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  if (s === "skipped") return "bg-muted text-muted-foreground border-border";
  return "bg-amber-500/15 text-amber-300 border-amber-400/30"; // pending
}

function arcLabel(arc: string | null): string {
  if (!arc) return "—";
  return arc.charAt(0).toUpperCase() + arc.slice(1);
}

function MonoLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{children}</div>;
}

function SwarmPage() {
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();
  const hudFn = useServerFn(getSwarmHud);
  const approveFn = useServerFn(resolveApproval);
  const dispatchFn = useServerFn(decideEventDispatch);

  const { data, isLoading, error } = useQuery({
    queryKey: ["swarm", "hud", activeWorkspaceId],
    queryFn: () => hudFn({ data: { workspaceId: activeWorkspaceId ?? null } }),
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  });

  const resolveMut = useMutation({
    mutationFn: (v: { approvalId: string; decision: "approved" | "rejected" }) => approveFn({ data: v }),
    onSuccess: () => { toast.success("Approval decided"); qc.invalidateQueries({ queryKey: ["swarm", "hud"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const decideMut = useMutation({
    mutationFn: (v: { eventId: string; decision: "approve" | "reject" }) => dispatchFn({ data: v }),
    onSuccess: () => { toast.success("Reactor event handled"); qc.invalidateQueries({ queryKey: ["swarm", "hud"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const hud = data as SwarmHud | undefined;

  const liveAgents = useMemo(() => {
    if (!hud) return 0;
    return hud.agents.filter((a) => a.latest_run?.status === "running").length;
  }, [hud]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <header className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Swarm HUD
            </div>
            <h1 className="mt-3 font-display text-3xl tracking-tight">Live swarm</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              Every agent at work, every mission in flight, everything waiting on you — refreshed every 2 seconds.
              Approve, reject, dispatch and skip inline. Click any card for the full mission graph.
            </p>
          </div>
          <div className="text-right text-[11px] text-muted-foreground tabular-nums">
            <div>{liveAgents} agent{liveAgents === 1 ? "" : "s"} running · {hud?.missions.length ?? 0} mission{hud?.missions.length === 1 ? "" : "s"} in flight</div>
            <div className="mt-1">Refreshed {hud ? relative(hud.generated_at) : "—"}</div>
          </div>
        </header>

        {isLoading && !hud ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">Loading swarm…</div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : !hud ? null : (
          <>
            {/* TOP STRIP: throughput · agents · attention */}
            <div className="grid grid-cols-12 gap-4">
              <ThroughputStrip hud={hud} />
              <AttentionQueue
                hud={hud}
                onApprove={(id) => resolveMut.mutate({ approvalId: id, decision: "approved" })}
                onReject={(id) => resolveMut.mutate({ approvalId: id, decision: "rejected" })}
                onDispatch={(id) => decideMut.mutate({ eventId: id, decision: "approve" })}
                onSkip={(id) => decideMut.mutate({ eventId: id, decision: "reject" })}
                actionPending={resolveMut.isPending || decideMut.isPending}
              />
            </div>

            <AgentsGrid hud={hud} />

            <MissionsTable hud={hud} />

            <div className="grid grid-cols-12 gap-4">
              <HandoffFeed hud={hud} />
              <ReactorFirings hud={hud} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ThroughputStrip({ hud }: { hud: SwarmHud }) {
  const t = hud.throughput;
  const max = Math.max(1, ...t.buckets.map((b) => b.runs));
  return (
    <section className="col-span-12 lg:col-span-7 rounded-xl border border-border bg-background/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <MonoLabel>Throughput · last hour</MonoLabel>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldAlert className="h-3 w-3" /> {hud.guardrail_hits_last_hour} guardrail hit{hud.guardrail_hits_last_hour === 1 ? "" : "s"}
        </div>
      </div>
      <div className="flex items-end gap-6 tabular-nums">
        <div>
          <div className="text-2xl font-display">{t.total_runs}</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-1">AI calls</div>
        </div>
        <div>
          <div className="text-2xl font-display">${t.total_cost_usd.toFixed(4)}</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-1">Cost</div>
        </div>
        <div>
          <div className="text-2xl font-display">{t.p50_latency_ms}ms</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-1">p50 latency</div>
        </div>
      </div>
      <div className="flex items-end gap-[2px] h-12">
        {t.buckets.map((b, i) => (
          <div
            key={b.bucket_start}
            title={`${new Date(b.bucket_start).toLocaleTimeString()} · ${b.runs} runs · $${b.cost_usd.toFixed(4)} · ${b.p50_latency_ms}ms p50`}
            className="flex-1 bg-foreground/70 rounded-sm"
            style={{ height: `${Math.max(2, (b.runs / max) * 100)}%`, opacity: 0.4 + 0.6 * (i / Math.max(1, t.buckets.length - 1)) }}
          />
        ))}
      </div>
    </section>
  );
}

function AttentionQueue({
  hud, onApprove, onReject, onDispatch, onSkip, actionPending,
}: {
  hud: SwarmHud;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDispatch: (id: string) => void;
  onSkip: (id: string) => void;
  actionPending: boolean;
}) {
  const pendingReactor = hud.reactor_events.filter((e) => e.status === "pending" && e.approval_mode === "confirm");
  const empty = hud.approvals.length === 0 && pendingReactor.length === 0;
  return (
    <section className="col-span-12 lg:col-span-5 rounded-xl border border-border bg-background/40 p-4 space-y-3">
      <MonoLabel>Attention queue</MonoLabel>
      {empty ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nothing waiting on you. The swarm is humming.</p>
      ) : (
        <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
          {hud.approvals.map((a) => (
            <div key={a.id} className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>{a.agent_slug ?? "—"} · {a.tool_name}</span>
                <span>{relative(a.created_at)}</span>
              </div>
              {a.rationale ? <p className="text-xs leading-relaxed text-foreground/85">{a.rationale}</p> : null}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => onReject(a.id)}
                  disabled={actionPending}
                  className="rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-secondary disabled:opacity-50"
                >Reject</button>
                <button
                  onClick={() => onApprove(a.id)}
                  disabled={actionPending}
                  className="rounded-md bg-primary px-2.5 py-1 text-[11px] text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >Approve</button>
              </div>
            </div>
          ))}
          {pendingReactor.map((e) => (
            <div key={e.id} className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> {e.event_type} → {e.target_agent_slug}</span>
                <span>{relative(e.created_at)}</span>
              </div>
              <p className="text-xs text-foreground/85">{(e.payload?.title as string) ?? "(no title)"}</p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => onSkip(e.id)}
                  disabled={actionPending}
                  className="rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-secondary disabled:opacity-50"
                >Skip</button>
                <button
                  onClick={() => onDispatch(e.id)}
                  disabled={actionPending}
                  className="rounded-md bg-primary px-2.5 py-1 text-[11px] text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >Dispatch</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AgentsGrid({ hud }: { hud: SwarmHud }) {
  return (
    <section className="space-y-3">
      <MonoLabel>Agents</MonoLabel>
      {hud.agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agents configured yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {hud.agents.map((a) => {
            const r = a.latest_run;
            return (
              <div key={a.agent_id} className="rounded-xl border border-border bg-background/40 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium truncate">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {a.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{a.slug} · {arcLabel(a.trust_arc)}</div>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${runStatusTone(r?.status ?? null)}`}>
                    {r?.status ?? "idle"}
                  </span>
                </div>
                {r ? (
                  <>
                    <p className="text-[12px] text-foreground/80 line-clamp-2">{r.input}</p>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      <span>step {r.step_index}</span>
                      <span>{relative(r.last_checkpoint_at ?? r.created_at)}</span>
                    </div>
                    {r.mission_id ? (
                      <Link
                        to="/missions/$missionId"
                        params={{ missionId: r.mission_id }}
                        className="text-[11px] inline-flex items-center gap-1 text-foreground/80 hover:text-foreground"
                      >
                        Open mission <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </>
                ) : (
                  <p className="text-[12px] text-muted-foreground italic">Idle · no recent run</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MissionsTable({ hud }: { hud: SwarmHud }) {
  return (
    <section className="space-y-3">
      <MonoLabel>Missions in flight</MonoLabel>
      {hud.missions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">
          No missions in flight. The orchestrator is idle.
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-background/40 divide-y divide-border">
          {hud.missions.map((m) => {
            const pct = m.steps_total > 0 ? Math.round((m.steps_done / m.steps_total) * 100) : 0;
            return (
              <Link
                key={m.id}
                to="/missions/$missionId"
                params={{ missionId: m.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40"
              >
                <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{m.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{m.goal}</div>
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-20 text-right">
                  {m.steps_done}/{m.steps_total} steps
                </div>
                <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden shrink-0">
                  <div className="h-full bg-foreground/70" style={{ width: `${pct}%` }} />
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] shrink-0 ${runStatusTone(m.status)}`}>
                  {m.status}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums w-16 text-right shrink-0">
                  {relative(m.updated_at)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function HandoffFeed({ hud }: { hud: SwarmHud }) {
  return (
    <section className="col-span-12 lg:col-span-7 rounded-xl border border-border bg-background/40 p-4 space-y-3">
      <MonoLabel>Handoff feed</MonoLabel>
      {hud.handoffs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No agent-to-agent handoffs yet.</p>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {hud.handoffs.map((h) => (
            <Link
              key={h.id}
              to="/missions/$missionId"
              params={{ missionId: h.mission_id }}
              className="block border-l-2 border-border pl-3 py-1 hover:border-foreground/70"
            >
              <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                <span>{relative(h.created_at)}</span>
                <span>·</span>
                <span>{h.from_agent_slug ?? "operator"}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="text-foreground/85">{h.to_agent_slug}</span>
                <span>·</span>
                <span>{h.kind}</span>
              </div>
              {h.task ? <p className="text-[12px] text-foreground/80 line-clamp-2 mt-0.5">{h.task}</p> : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function ReactorFirings({ hud }: { hud: SwarmHud }) {
  return (
    <section className="col-span-12 lg:col-span-5 rounded-xl border border-border bg-background/40 p-4 space-y-3">
      <MonoLabel>Reactor firings</MonoLabel>
      {hud.reactor_events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Reactor has been quiet.</p>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {hud.reactor_events.map((e) => (
            <div key={e.id} className="border border-border rounded-md p-2.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-foreground/85 truncate">
                  <Zap className="h-3 w-3 text-muted-foreground" />
                  <span>{e.event_type}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>{e.target_agent_slug}</span>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] shrink-0 ${eventStatusTone(e.status)}`}>
                  {e.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <span>{e.approval_mode}</span>
                <span>{relative(e.created_at)}</span>
              </div>
              {e.error ? <p className="text-[11px] text-destructive">{e.error}</p> : null}
              {e.mission_id ? (
                <Link
                  to="/missions/$missionId"
                  params={{ missionId: e.mission_id }}
                  className="text-[11px] inline-flex items-center gap-1 hover:text-foreground"
                >
                  Open mission <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-2">
        <Inbox className="h-3 w-3" /> Pending confirm rows appear in the Attention queue above.
      </p>
    </section>
  );
}
