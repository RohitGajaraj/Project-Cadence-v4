import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bot, Sparkles, Send, Clock, Gauge } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listAgents, listAgentRuns, updateAgentSchedule } from "@/lib/agents.functions";
import { runAgent } from "@/lib/agent_loop.functions";
import { listProjects } from "@/lib/projects.functions";
import { listApiKeys } from "@/lib/byokeys.functions";
import { getAllAgentTrust, setAgentArc, type AgentTrust, type Arc } from "@/lib/trust.functions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/agents")({
  component: AgentsPage,
  head: () => ({ meta: [{ title: "Agents · Cadence" }] }),
});

function AgentsPage() {
  const qc = useQueryClient();
  const fetchAgents = useServerFn(listAgents);
  const fetchRuns = useServerFn(listAgentRuns);
  const fetchProjects = useServerFn(listProjects);
  const mRun = useServerFn(runAgent);
  const fSchedule = useServerFn(updateAgentSchedule);

  const agents = useQuery({ queryKey: ["agents"], queryFn: () => fetchAgents() });
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => fetchRuns() });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fetchProjects() });

  const fTrust = useServerFn(getAllAgentTrust);
  const fSetArc = useServerFn(setAgentArc);
  const trustQ = useQuery({ queryKey: ["agent-trust"], queryFn: () => fTrust() });
  const trustByAgent = new Map<string, AgentTrust>(
    (trustQ.data?.trust ?? []).map((t) => [t.agent_id, t]),
  );
  const arcMutation = useMutation({
    mutationFn: (v: { agentId: string; arc: Arc }) => fSetArc({ data: v }),
    onSuccess: (_res, v) => {
      qc.invalidateQueries({ queryKey: ["agent-trust"] });
      toast.success(`Autonomy set to ${v.arc}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dispatch = useMutation({
    mutationFn: (data: { agentSlug: string; goal: string; model?: string; asMission?: boolean; missionTitle?: string }) => mRun({ data }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["agent-trust"] });
      const mid = (res as { mission_id?: string | null } | undefined)?.mission_id;
      const tid = (res as { trace_id?: string } | undefined)?.trace_id;
      if (mid) toast.success("Mission started — open Missions to follow the hops");
      else toast.success("Agent finished" + (tid ? " — trace ready" : ""));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [schedule, setSchedule] = useState<string>("");
  const [cronInput, setCronInput] = useState<string>("");
  const [model, setModel] = useState<string>("google/gemini-2.5-flash");
  const [asMission, setAsMission] = useState<boolean>(false);

  const fKeys = useServerFn(listApiKeys);
  const keysQ = useQuery({ queryKey: ["byo-keys"], queryFn: () => fKeys(), retry: false });
  const byoProviders = new Set((keysQ.data?.keys ?? []).map((k: { provider: string }) => k.provider));

  const modelOptions: { id: string; label: string; provider: string }[] = [
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Lovable)", provider: "lovable" },
    { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Lovable)", provider: "lovable" },
    { id: "openai/gpt-5-mini", label: "GPT-5 mini (Lovable)", provider: "lovable" },
    { id: "anthropic/claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet (your key)", provider: "anthropic" },
    { id: "openai/gpt-4o", label: "GPT-4o (your key)", provider: "openai" },
    { id: "deepseek/deepseek-chat", label: "DeepSeek Chat (your key)", provider: "deepseek" },
    { id: "xai/grok-2-latest", label: "Grok 2 (your key)", provider: "xai" },
  ];

  const selected = (agents.data?.agents ?? []).find((a) => a.id === selectedId) ?? (agents.data?.agents ?? [])[0];
  const selAny = selected as (typeof selected & { cron_schedule?: string | null; cron_input?: string | null; last_scheduled_run_at?: string | null }) | undefined;
  const selectedRuns = (runs.data?.runs ?? []).filter((r) => r.agent_id === selected?.id);

  useEffect(() => {
    setSchedule(selAny?.cron_schedule ?? "");
    setCronInput(selAny?.cron_input ?? "");
  }, [selAny?.id, selAny?.cron_schedule, selAny?.cron_input]);

  const saveSchedule = useMutation({
    mutationFn: () => fSchedule({ data: {
      agentId: selected!.id,
      cron_schedule: schedule || null,
      cron_input: cronInput || null,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); toast.success(schedule ? "Schedule saved" : "Schedule removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TooltipProvider delayDuration={150}>
      <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-violet-400" /> AI agents
          </div>
          <h1 className="mt-3 font-display text-4xl tracking-tight">Your <span className="neural-text">AI team</span></h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">Specialized agents that ground in your workspace and execute work alongside you. Brief any agent — review the output, approve, and ship.</p>
        </header>

        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Roster — compact list, no wrapping chips, anchored active row */}
          <aside className="col-span-12 lg:col-span-4 bento p-2">
            <div className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Active roster · {(agents.data?.agents ?? []).length}
            </div>
            <div className="max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
              {(agents.data?.agents ?? []).map((a) => {
                const isActive = selected?.id === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className={`relative w-full text-left rounded-lg px-3 py-2.5 flex items-center gap-3 transition ${
                      isActive
                        ? "bg-secondary/60 ring-1 ring-border"
                        : "hover:bg-secondary/30"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-foreground/70" />
                    )}
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-violet-500/30 to-cyan-500/20 grid place-items-center">
                      <Bot className="h-4 w-4 text-foreground/80" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm truncate flex-1">{a.name}</span>
                        <TrustChip trust={trustByAgent.get(a.id)} compact />
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">{a.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="col-span-12 lg:col-span-8 space-y-5">
            {selected && (
              <>
                {/* Detail header — editorial, no nested card */}
                <div className="px-1">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{selected.role}</div>
                  <div className="mt-2 flex items-baseline gap-3 flex-wrap">
                    <h2 className="font-display text-3xl tracking-tight">{selected.name}</h2>
                    <TrustChip trust={trustByAgent.get(selected.id)} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">{selected.system_prompt}</p>
                </div>

                {/* Autonomy Dial — own card */}
                <div className="bento p-5">
                  <AutonomyDial
                    trust={trustByAgent.get(selected.id)}
                    onChange={(arc) => arcMutation.mutate({ agentId: selected.id, arc })}
                    pending={arcMutation.isPending}
                  />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!input.trim()) return;
                    dispatch.mutate({
                      agentSlug: selected.slug,
                      goal: input.trim(),
                      model,
                      asMission,
                      missionTitle: asMission ? input.trim().slice(0, 80) : undefined,
                    });
                    setInput("");
                  }}
                  className="bento p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <Sparkles className="h-3 w-3 text-violet-400" /> Brief <span className="text-foreground">{selected.name}</span>
                    </span>
                    <span className="mx-1 h-3 w-px bg-border/60" />
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="rounded-md bg-secondary border hairline px-2 py-0.5 text-[11px] outline-none"
                    >
                      {modelOptions.map((m) => {
                        const usable = m.provider === "lovable" || byoProviders.has(m.provider);
                        return (
                          <option key={m.id} value={m.id} disabled={!usable}>
                            {m.label}{!usable ? " — add key in Settings" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <label className="ml-auto inline-flex items-center gap-1.5 text-[11px] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={asMission}
                        onChange={(e) => setAsMission(e.target.checked)}
                        className="h-3 w-3 accent-violet-400"
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-2">
                            Start as mission
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-left p-3 text-[11px] leading-snug">
                          Wraps this run in a mission so the agent can hand off to other agents using the <code>agent.handoff</code> tool. Each hop appears in <Link to="/missions" className="underline">Missions</Link> with structured payloads.
                        </TooltipContent>
                      </Tooltip>
                    </label>
                  </div>
                  <textarea
                    value={input} onChange={(e) => setInput(e.target.value)} rows={3}
                    placeholder={`e.g. "Plan a 2-week sprint to ship onboarding v2 with 3 engineers"`}
                    className="w-full rounded-lg border hairline bg-background/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                  <div className="flex justify-end">
                    <Link
                      to="/traces"
                      className="mr-auto inline-flex items-center text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    >
                      View traces →
                    </Link>
                    <button disabled={dispatch.isPending} className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-3.5 py-2 text-sm disabled:opacity-60">
                      <Send className="h-3.5 w-3.5" /> {dispatch.isPending ? "Running…" : "Dispatch"}
                    </button>
                  </div>
                </form>

                <div className="bento p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 text-violet-300" /> Run on schedule (autonomous)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={schedule} onChange={(e) => setSchedule(e.target.value)}
                            className="bg-secondary/40 rounded-md px-2 py-1.5 text-xs outline-none">
                      <option value="">Off</option>
                      <option value="15">Every 15 min</option>
                      <option value="60">Every hour</option>
                      <option value="360">Every 6 hours</option>
                      <option value="1440">Daily</option>
                    </select>
                    <input value={cronInput} onChange={(e) => setCronInput(e.target.value)}
                           placeholder={`Default brief for ${selected.name}…`}
                           className="flex-1 min-w-[180px] bg-secondary/40 rounded-md px-2 py-1.5 text-xs outline-none focus:bg-secondary/60" />
                    <button onClick={() => saveSchedule.mutate()} disabled={saveSchedule.isPending}
                            className="rounded-md bg-foreground text-background px-3 py-1.5 text-xs disabled:opacity-60">
                      {saveSchedule.isPending ? "Saving…" : "Save"}
                    </button>
                  </div>
                  {selAny?.last_scheduled_run_at && (
                    <div className="text-[10px] text-muted-foreground">
                      Last autonomous run: {new Date(selAny.last_scheduled_run_at).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recent runs</div>
                  {selectedRuns.length === 0 && <div className="text-xs text-muted-foreground">No runs yet for {selected.name}.</div>}
                  {selectedRuns.map((r) => (
                    <div key={r.id} className="bento p-4">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(r.created_at).toLocaleString()}</span>
                        <span className="ml-auto">{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : ""}</span>
                      </div>
                      <div className="mt-2 text-xs italic text-muted-foreground">{r.input}</div>
                      {r.output && <div className="mt-3 text-sm whitespace-pre-wrap">{r.output}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
      </TooltipProvider>
    </AppShell>
  );
}

const ARC_LABELS: Record<Arc, string> = {
  observing: "Observing",
  proving: "Proving",
  trusted: "Trusted",
  ambient: "Ambient",
};

const ARC_ORDER: Arc[] = ["observing", "proving", "trusted", "ambient"];

const ARC_BLURB: Record<Arc, string> = {
  observing: "Every tool call queues for review. Use for brand-new agents or after a regression.",
  proving: "Auto-mode tools require one-click confirm. Use while building a track record.",
  trusted: "Confirm-mode tools run inline. Review-mode tools still queue. Day-to-day default once an agent has earned it.",
  ambient: "Everything runs inline except hard-locked tools (e.g. calendar.create still confirms). Reserve for top-trust agents.",
};

function qualitativeLabel(score: number, samples: number): string {
  if (samples < 3) return "New";
  if (score >= 90) return "Ambient";
  if (score >= 75) return "Trusted";
  if (score >= 55) return "Proving";
  if (score >= 35) return "Observing";
  return "At-risk";
}

function scoreTone(score: number): string {
  if (score >= 75) return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (score >= 55) return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
  if (score >= 35) return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-muted text-muted-foreground border-border";
}

function TrustChip({ trust, compact = false }: { trust?: AgentTrust; compact?: boolean }) {
  if (!trust) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="shrink-0 inline-flex items-center rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground cursor-help">
            {compact ? "—" : "Trust —"}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-left">
          No trust data yet. Score appears after the first mission, approval, or eval is recorded for this agent.
        </TooltipContent>
      </Tooltip>
    );
  }
  const b = trust.breakdown;
  const label = qualitativeLabel(trust.score, b.samples);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] cursor-help whitespace-nowrap ${scoreTone(trust.score)}`}
        >
          {compact ? `T${trust.score}` : `Trust ${trust.score} · ${label}`}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm text-left space-y-1.5 p-3">
        <div className="font-semibold text-[12px]">Trust {trust.score}/100 · {label}</div>
        <div className="text-[11px] opacity-80 leading-snug">
          0 = no track record · 50 = neutral · 100 = exceptionally reliable. New agents are pulled toward 50 until they have ~10 missions (Bayesian shrinkage).
        </div>
        <div className="pt-1 space-y-0.5 text-[11px]">
          <div>Missions <span className="opacity-70">(40%)</span>: {b.missions_completed}/{b.missions_total} · {Math.round(b.mission_success_rate * 100)}%</div>
          <div>Approvals <span className="opacity-70">(30%)</span>: {b.approvals_approved}/{b.approvals_total} · {Math.round(b.approval_acceptance_rate * 100)}%</div>
          <div>Evals <span className="opacity-70">(30%)</span>: {b.evals_total} runs · avg {b.eval_mean_score.toFixed(2)}</div>
          <div className="opacity-70">Samples: {b.samples}</div>
        </div>
        <div className="pt-1 text-[10px] opacity-70 italic">
          0.4·mission + 0.3·approval + 0.3·eval, shrunk toward 0.5 when n&lt;10. Suggested arc: {ARC_LABELS[trust.suggested_arc]}.
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function AutonomyDial({
  trust,
  onChange,
  pending,
}: {
  trust?: AgentTrust;
  onChange: (arc: Arc) => void;
  pending: boolean;
}) {
  const current: Arc = trust?.arc ?? "observing";
  const suggested: Arc | undefined = trust?.suggested_arc;
  return (
    <div>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <Gauge className="h-3 w-3 text-violet-400" />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">Autonomy dial</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm text-left p-3 text-[11px] leading-snug">
            The trust arc this agent runs at. It composes with each tool's own mode to decide whether a call runs inline, queues a confirm, or queues a review. Safety floor: <em>review</em> is sticky and hard-locked tools (e.g. calendar.create) always confirm.
          </TooltipContent>
        </Tooltip>
        {suggested && suggested !== current && (
          <span className="ml-auto normal-case tracking-normal text-muted-foreground/80">
            Suggested: <span className="text-foreground">{ARC_LABELS[suggested]}</span>
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {ARC_ORDER.map((arc) => {
          const active = arc === current;
          return (
            <Tooltip key={arc}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={pending || active}
                  onClick={() => onChange(arc)}
                  className={`rounded-md border px-2 py-1.5 text-[11px] transition ${
                    active
                      ? "border-foreground/30 bg-foreground text-background"
                      : "border-border bg-secondary/40 hover:bg-secondary/70 disabled:opacity-60"
                  }`}
                >
                  {ARC_LABELS[arc]}
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-left p-2.5 text-[11px] leading-snug">
                <div className="font-semibold mb-1">{ARC_LABELS[arc]}</div>
                {ARC_BLURB[arc]}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground leading-relaxed">
        Currently <span className="text-foreground">{ARC_LABELS[current]}</span> — {ARC_BLURB[current]}
      </p>
    </div>
  );
}