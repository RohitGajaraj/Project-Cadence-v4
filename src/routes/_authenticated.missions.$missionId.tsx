import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Brain,
  Wrench,
  MessageSquare,
  Activity,
  GitMerge,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { getMission, type HopStep, type HopToolCall } from "@/lib/missions.functions";
import { MissionGraph } from "@/components/cadence/MissionGraph";
import { listMissionSteps, advanceMission } from "@/lib/orchestrator.functions";

export const Route = createFileRoute("/_authenticated/missions/$missionId")({
  component: MissionDetail,
  head: () => ({ meta: [{ title: "Mission · Cadence" }] }),
});

function statusTone(s: string): string {
  if (s === "completed") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (s === "running") return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
  if (s === "queued") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  if (s === "failed" || s === "halted") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  return "bg-muted text-muted-foreground border-border";
}

function StatusIcon({ s }: { s: string }) {
  if (s === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />;
  if (s === "running") return <Loader2 className="h-3.5 w-3.5 text-cyan-300 animate-spin" />;
  if (s === "queued") return <Loader2 className="h-3.5 w-3.5 text-amber-300" />;
  if (s === "failed" || s === "halted")
    return <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />;
  return <Bot className="h-3.5 w-3.5 text-muted-foreground" />;
}

function fmtDuration(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function hopElapsedMs(h: {
  created_at: string;
  status: string;
  last_checkpoint_at: string | null;
}): number {
  const start = new Date(h.created_at).getTime();
  const isLive = h.status === "running" || h.status === "queued";
  const end = isLive ? Date.now() : new Date(h.last_checkpoint_at ?? h.created_at).getTime();
  return Math.max(0, end - start);
}

function StepRow({ step, idx }: { step: HopStep; idx: number }) {
  const Icon = step.kind === "thought" ? Brain : step.kind === "tool_call" ? Wrench : MessageSquare;
  const tone =
    step.kind === "tool_call"
      ? step.status === "error"
        ? "text-rose-300"
        : step.status === "queued"
          ? "text-amber-300"
          : "text-emerald-300"
      : step.kind === "final"
        ? "text-foreground"
        : "text-muted-foreground";
  const label =
    step.kind === "thought"
      ? "thought"
      : step.kind === "tool_call"
        ? `tool · ${step.name}`
        : "final reply";
  const preview =
    step.kind === "thought"
      ? step.text
      : step.kind === "tool_call"
        ? step.error
          ? `error: ${step.error}`
          : (step.reason ?? JSON.stringify(step.args).slice(0, 160))
        : step.message;
  return (
    <div className="flex items-start gap-2 text-[11px]">
      <span className="mt-0.5 tabular-nums text-muted-foreground w-5 text-right">{idx + 1}.</span>
      <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${tone}`} />
      <div className="min-w-0 flex-1">
        <div className={`font-mono ${tone}`}>
          {label}
          {step.kind === "tool_call" && step.status !== "executed" ? ` · ${step.status}` : ""}
        </div>
        <div className="text-muted-foreground line-clamp-2 break-words">{preview}</div>
      </div>
    </div>
  );
}

function ToolSpanRow({ t }: { t: HopToolCall }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {t.ok ? (
        <CheckCircle2 className="h-3 w-3 text-emerald-300" />
      ) : (
        <AlertTriangle className="h-3 w-3 text-rose-300" />
      )}
      <span className="font-mono text-foreground/90 truncate flex-1">{t.tool_name}</span>
      <span className="tabular-nums text-muted-foreground">{fmtDuration(t.latency_ms)}</span>
    </div>
  );
}

function HopProgressPanel({
  steps,
  toolCalls,
  hopStatus,
}: {
  steps: HopStep[];
  toolCalls: HopToolCall[];
  hopStatus: string;
}) {
  const isLive = hopStatus === "running" || hopStatus === "queued";
  if (steps.length === 0 && toolCalls.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground italic px-1">
        {isLive ? "Waiting for first checkpoint…" : "No recorded steps."}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {steps.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3 w-3" /> Steps{" "}
            {isLive && <Loader2 className="h-3 w-3 animate-spin text-cyan-300" />}
          </div>
          {steps.map((s, i) => (
            <StepRow key={i} step={s} idx={i} />
          ))}
        </div>
      )}
      {toolCalls.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Tool spans
          </div>
          {toolCalls.map((t) => (
            <ToolSpanRow key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

type TimelineHop = {
  run_id: string;
  agent_slug: string;
  agent_name: string;
  status: string;
  created_at: string;
  last_checkpoint_at: string | null;
};

type MissionStepUI = {
  id: string;
  idx: number;
  agent_slug: string;
  sub_goal: string;
  depends_on: number[];
  status: string;
  run_id: string | null;
  error: string | null;
  rationale: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
};

function stepTone(s: string): string {
  if (s === "done") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (s === "running" || s === "dispatched")
    return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
  if (s === "failed") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  if (s === "skipped") return "bg-muted text-muted-foreground border-border";
  return "bg-amber-500/15 text-amber-300 border-amber-400/30";
}

function OrchestratorPlanPanel({
  steps,
  canAdvance,
  advancing,
  onAdvance,
}: {
  steps: MissionStepUI[];
  canAdvance: boolean;
  advancing: boolean;
  onAdvance: () => void;
}) {
  const done = steps.filter((s) => s.status === "done").length;
  const failed = steps.filter((s) => s.status === "failed").length;
  return (
    <div className="bento p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
          <GitMerge className="h-3 w-3 text-violet-300" /> Orchestrator plan · {done}/{steps.length}{" "}
          done{failed > 0 ? ` · ${failed} failed` : ""}
        </div>
        {canAdvance && (
          <button
            onClick={onAdvance}
            disabled={advancing}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
          >
            {advancing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}{" "}
            Advance
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {steps.map((s) => (
          <div key={s.id} className="flex items-start gap-2 text-[11px]">
            <span className="tabular-nums text-muted-foreground w-5 text-right">{s.idx + 1}.</span>
            <span
              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] shrink-0 ${stepTone(s.status)}`}
            >
              {s.status}
            </span>
            <span className="font-mono text-foreground/80 shrink-0">{s.agent_slug}</span>
            <span className="min-w-0 flex-1 text-muted-foreground break-words">{s.sub_goal}</span>
            {s.depends_on.length > 0 && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                deps: {s.depends_on.map((d) => d + 1).join(",")}
              </span>
            )}
            {s.error && (
              <span className="text-[10px] text-rose-300 truncate max-w-[200px]">{s.error}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentTimeline({ hops }: { hops: TimelineHop[] }) {
  if (hops.length === 0) return null;
  return (
    <div className="bento p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3 flex items-center gap-2">
        <Activity className="h-3 w-3 text-violet-300" /> Agent timeline
      </div>
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {hops.map((h, i) => {
          const elapsed = hopElapsedMs(h);
          return (
            <div key={h.run_id} className="flex items-center gap-2 shrink-0">
              <div className={`min-w-[160px] rounded-lg border px-3 py-2 ${statusTone(h.status)}`}>
                <div className="flex items-center gap-1.5">
                  <StatusIcon s={h.status} />
                  <div className="font-display text-xs truncate">{h.agent_name}</div>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] opacity-80">
                  <span className="font-mono">{h.agent_slug}</span>
                  <span className="tabular-nums">{fmtDuration(elapsed)}</span>
                </div>
              </div>
              {i < hops.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MissionDetail() {
  const { missionId } = Route.useParams();
  const fProjects = useServerFn(listProjects);
  const fGet = useServerFn(getMission);
  const fSteps = useServerFn(listMissionSteps);
  const fAdvance = useServerFn(advanceMission);
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const m = useQuery({
    queryKey: ["mission", missionId],
    queryFn: () => fGet({ data: { missionId } }),
    refetchInterval: (q) => {
      const st = q.state.data?.mission.status;
      return st === "running" || st === "queued" ? 2000 : false;
    },
  });
  const steps = useQuery({
    queryKey: ["mission-steps", missionId],
    queryFn: () => fSteps({ data: { missionId } }),
    refetchInterval: (q) => {
      const rows = q.state.data?.steps ?? [];
      const live = rows.some(
        (r) => r.status === "dispatched" || r.status === "running" || r.status === "planned",
      );
      return live ? 2500 : false;
    },
  });
  const advance = useMutation({
    mutationFn: () => fAdvance({ data: { missionId } }),
    onSuccess: () => {
      toast.success("Orchestrator advanced — dispatching newly-ready steps.");
      qc.invalidateQueries({ queryKey: ["mission", missionId] });
      qc.invalidateQueries({ queryKey: ["mission-steps", missionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectHop = (runId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(runId);
      return next;
    });
    // Scroll to the hop card on the next paint so the panel is mounted.
    requestAnimationFrame(() => {
      const el = document.getElementById(`hop-${runId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const data = m.data;
  const stepRows = steps.data?.steps ?? [];
  const isOrchestrated = stepRows.length > 0;
  const hasPending = stepRows.some(
    (r) => r.status === "planned" || r.status === "dispatched" || r.status === "running",
  );

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <div>
          <Link
            to="/cockpit"
            search={{ tab: "missions" }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> All missions
          </Link>
          {data && (
            <>
              <h1 className="mt-2 font-display text-2xl tracking-tight flex items-center gap-3">
                {data.mission.title}
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${statusTone(data.mission.status)}`}
                >
                  {data.mission.status}
                </span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{data.mission.goal}</p>
              <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-2">
                <span>
                  {data.hops.length} hop{data.hops.length === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span>started {new Date(data.mission.created_at).toLocaleString()}</span>
                {data.mission.status === "running" && (
                  <span className="inline-flex items-center gap-1 text-cyan-300">
                    <Loader2 className="h-3 w-3 animate-spin" /> live · refreshing every 2s
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {m.isLoading || !data ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            <AgentTimeline hops={data.hops} />
            {isOrchestrated && (
              <OrchestratorPlanPanel
                steps={stepRows}
                canAdvance={hasPending && data.mission.status === "running"}
                advancing={advance.isPending}
                onAdvance={() => advance.mutate()}
              />
            )}
            <MissionGraph hops={data.hops} messages={data.messages} onSelectHop={handleSelectHop} />
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Hops (chronological)
            </div>
            {data.hops.length === 0 && (
              <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                No hops yet — mission queued.
              </div>
            )}
            {data.hops.map((h, i) => {
              // The inbound handoff (if any) was consumed by THIS run.
              const inbound = data.messages.find((mm) => mm.consumed_by_run_id === h.run_id);
              // The outbound handoff (if any) was emitted FROM this run.
              const outbound = data.messages.find((mm) => mm.source_run_id === h.run_id);
              const isExpanded = expanded.has(h.run_id);
              return (
                <div key={h.run_id} id={`hop-${h.run_id}`} className="scroll-mt-24">
                  {inbound && (
                    <div className="ml-4 mb-2 text-[11px] text-muted-foreground flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md border border-indigo-400/30 bg-indigo-500/10 px-2 py-0.5 text-indigo-300">
                        <ArrowRight className="h-3 w-3" />
                        {inbound.from_agent_slug ?? "operator"} → {inbound.to_agent_slug}
                      </span>
                      <button
                        onClick={() => toggle(`msg-${inbound.id}`)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {expanded.has(`msg-${inbound.id}`) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        Payload
                      </button>
                    </div>
                  )}
                  {inbound && expanded.has(`msg-${inbound.id}`) && (
                    <pre className="ml-4 mb-2 rounded-md bg-muted/40 p-2 text-[11px] whitespace-pre-wrap font-mono max-h-60 overflow-auto">
                      {JSON.stringify(inbound.payload, null, 2)}
                    </pre>
                  )}
                  <div className="bento p-4">
                    <div className="flex items-center gap-3">
                      <StatusIcon s={h.status} />
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-sm flex items-center gap-2">
                          <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                          {h.agent_name}
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({h.agent_slug})
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>{new Date(h.created_at).toLocaleString()}</span>
                          <span>·</span>
                          <span className="tabular-nums">{fmtDuration(hopElapsedMs(h))}</span>
                          <span>·</span>
                          <span>step {h.step_index}</span>
                          {h.tool_calls.length > 0 && (
                            <>
                              <span>·</span>
                              <span>
                                {h.tool_calls.length} tool call
                                {h.tool_calls.length === 1 ? "" : "s"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${statusTone(h.status)}`}
                      >
                        {h.status}
                      </span>
                      {h.trace_id && (
                        <Link
                          to="/traces/$traceId"
                          params={{ traceId: h.trace_id }}
                          className="text-[11px] text-muted-foreground hover:text-foreground underline"
                        >
                          Trace
                        </Link>
                      )}
                      <button
                        onClick={() => toggle(h.run_id)}
                        className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}{" "}
                        Detail
                      </button>
                    </div>

                    {/* Progress panel — always visible so steps + tool spans are inline, live or completed */}
                    <div className="mt-3 rounded-md border border-border/60 bg-muted/20 p-3">
                      <HopProgressPanel
                        steps={h.steps}
                        toolCalls={h.tool_calls}
                        hopStatus={h.status}
                      />
                    </div>

                    {isExpanded && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Input
                          </div>
                          <pre className="rounded bg-muted/40 p-2 text-[11px] whitespace-pre-wrap max-h-40 overflow-auto">
                            {h.input}
                          </pre>
                        </div>
                        {h.output && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Output
                            </div>
                            <pre className="rounded bg-muted/40 p-2 text-[11px] whitespace-pre-wrap max-h-60 overflow-auto">
                              {h.output}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {outbound && (
                    <div className="ml-4 mt-2 text-[11px] text-muted-foreground">
                      Emitted handoff →{" "}
                      <span className="text-foreground">{outbound.to_agent_slug}</span>
                      {outbound.consumed_by_run_id ? null : (
                        <span className="ml-2 italic">(queued, awaiting receiver run)</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
