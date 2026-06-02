import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles, Brain, Users, MessageSquare, Target, Plus, Send, RefreshCw,
  Calendar, Bot, Zap, Activity, CheckCircle2, XCircle, Clock, ArrowRight,
} from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { ShaderAnimation } from "@/components/ui/shader-animation";
import { getDashboard } from "@/lib/dashboard.functions";
import { listTasks, createTask, updateTask, deleteTask } from "@/lib/tasks.functions";
import { listProjects, createProject } from "@/lib/projects.functions";
import { createMeeting } from "@/lib/meetings.functions";
import { listCopilotMessages, sendCopilotMessage, generateDailyBrief } from "@/lib/copilot.functions";
import { listAgents, listAgentRuns, runAgent } from "@/lib/agents.functions";
import { listDecisions, createDecision, updateDecision } from "@/lib/decisions.functions";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Mission Control · Cadence" }] }),
});

const AGENT_COLORS: Record<string, string> = {
  violet: "from-violet-500/30 to-fuchsia-500/20 text-violet-200",
  cyan: "from-cyan-500/30 to-sky-500/20 text-cyan-200",
  emerald: "from-emerald-500/30 to-teal-500/20 text-emerald-200",
  amber: "from-amber-500/30 to-yellow-500/20 text-amber-200",
  blue: "from-blue-500/30 to-indigo-500/20 text-blue-200",
  rose: "from-rose-500/30 to-pink-500/20 text-rose-200",
  orange: "from-orange-500/30 to-amber-500/20 text-orange-200",
  pink: "from-pink-500/30 to-rose-500/20 text-pink-200",
};

function Dashboard() {
  const qc = useQueryClient();
  const fetchDashboard = useServerFn(getDashboard);
  const fetchTasks = useServerFn(listTasks);
  const fetchProjects = useServerFn(listProjects);
  const fetchMessages = useServerFn(listCopilotMessages);
  const fetchAgents = useServerFn(listAgents);
  const fetchRuns = useServerFn(listAgentRuns);
  const fetchDecisions = useServerFn(listDecisions);

  const mCreateTask = useServerFn(createTask);
  const mUpdateTask = useServerFn(updateTask);
  const mDeleteTask = useServerFn(deleteTask);
  const mCreateProject = useServerFn(createProject);
  const mCreateMeeting = useServerFn(createMeeting);
  const mSend = useServerFn(sendCopilotMessage);
  const mBrief = useServerFn(generateDailyBrief);
  const mRunAgent = useServerFn(runAgent);
  const mCreateDecision = useServerFn(createDecision);
  const mUpdateDecision = useServerFn(updateDecision);

  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fetchProjects() });
  const messages = useQuery({ queryKey: ["copilot"], queryFn: () => fetchMessages() });
  const agents = useQuery({ queryKey: ["agents"], queryFn: () => fetchAgents() });
  const runs = useQuery({ queryKey: ["runs"], queryFn: () => fetchRuns() });
  const decisions = useQuery({ queryKey: ["decisions"], queryFn: () => fetchDecisions() });

  const invalidate = (k: string) => qc.invalidateQueries({ queryKey: [k] });

  const addTask = useMutation({
    mutationFn: (data: { title: string; is_deep_work: boolean }) => mCreateTask({ data }),
    onSuccess: () => { invalidate("tasks"); invalidate("dashboard"); toast.success("Task added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleTask = useMutation({
    mutationFn: (data: { id: string; status: "todo" | "done" }) => mUpdateTask({ data }),
    onSuccess: () => { invalidate("tasks"); invalidate("dashboard"); },
  });
  const removeTask = useMutation({
    mutationFn: (id: string) => mDeleteTask({ data: { id } }),
    onSuccess: () => invalidate("tasks"),
  });
  const addProject = useMutation({
    mutationFn: (data: { name: string }) => mCreateProject({ data }),
    onSuccess: () => { invalidate("projects"); invalidate("dashboard"); toast.success("Product added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const addMeeting = useMutation({
    mutationFn: (data: { title: string; start_at: string; end_at: string; stakeholder?: string }) =>
      mCreateMeeting({ data }),
    onSuccess: () => { invalidate("dashboard"); toast.success("Meeting added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendMsg = useMutation({
    mutationFn: (prompt: string) => mSend({ data: { prompt } }),
    onSuccess: () => invalidate("copilot"),
    onError: (e: Error) => toast.error(e.message),
  });
  const regenBrief = useMutation({
    mutationFn: () => mBrief(),
    onSuccess: () => { invalidate("dashboard"); toast.success("Brief refreshed"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dispatchAgent = useMutation({
    mutationFn: (data: { agentId: string; input: string }) => mRunAgent({ data }),
    onSuccess: () => { invalidate("runs"); toast.success("Agent finished"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const addDecision = useMutation({
    mutationFn: (data: { title: string; rationale?: string }) => mCreateDecision({ data }),
    onSuccess: () => { invalidate("decisions"); toast.success("Decision queued"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setDecisionStatus = useMutation({
    mutationFn: (data: { id: string; status: "approved" | "rejected" | "pending" }) => mUpdateDecision({ data }),
    onSuccess: () => invalidate("decisions"),
  });

  const d = dash.data;
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
  }, []);
  const focusScore = d?.focusScore ?? 0;
  const profileName = d?.profile?.display_name?.split(" ")[0] ?? "there";
  const activeAgents = (runs.data?.runs ?? []).filter((r) => r.status === "running").length;

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      {/* TopBar */}
      <header className="sticky top-0 z-30 glass border-b hairline">
        <div className="flex items-center gap-4 px-6 lg:px-10 h-14">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
            <span>{today}</span>
            {activeAgents > 0 && (
              <span className="ml-3 inline-flex items-center gap-1.5 text-xs text-violet-300">
                <Activity className="h-3 w-3" /> {activeAgents} agent{activeAgents > 1 ? "s" : ""} running
              </span>
            )}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => regenBrief.mutate()}
            disabled={regenBrief.isPending}
            className="flex items-center gap-2 rounded-xl bg-foreground text-background px-3.5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {regenBrief.isPending ? "Thinking…" : "Refresh brief"}
          </button>
        </div>
      </header>

      <div className="px-6 lg:px-10 py-8 max-w-[1500px] mx-auto">
        {/* HERO */}
        <section className="bento p-7 md:p-10 relative overflow-hidden mb-5">
          <div className="absolute inset-0 opacity-70 mix-blend-screen">
            <ShaderAnimation className="h-full w-full" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-paper/85 via-paper/40 to-transparent" />
          <div className="absolute inset-0 neural-gradient opacity-15 animate-aurora" />
          <div className="relative grid md:grid-cols-[1fr,auto] gap-8 items-end">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-violet-300" /> Mission control
              </div>
              <h1 className="mt-4 font-display text-3xl md:text-5xl leading-[1.05] tracking-tight text-balance">
                Good morning, <span className="neural-text">{profileName}</span>.
              </h1>
              <p className="mt-3 text-base text-muted-foreground">
                Your AI team is ready. Hit <em className="not-italic text-foreground">Refresh brief</em> to orient the day.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <Pill icon={Brain} label={`${(d?.deepWorkSeries ?? []).reduce((a, x) => a + x.count, 0)} deep blocks`} />
                <Pill icon={Calendar} label={`${Math.round(((d?.meetingMinutes ?? 0) / 60) * 10) / 10}h meetings`} />
                <Pill icon={Target} label={`${(d?.projects ?? []).length} products`} />
                <Pill icon={Bot} label={`${(agents.data?.agents ?? []).length} agents online`} />
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 shrink-0">
              <div className="text-right">
                <div className="font-display text-6xl tracking-tight tabular-nums neural-text">{focusScore}</div>
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground mt-1">Focus score</div>
              </div>
              <div className="h-1.5 w-40 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400" style={{ width: `${focusScore}%` }} />
              </div>
            </div>
          </div>
        </section>

        {/* TODAY'S BRIEF — clean bullets */}
        <section className="bento p-5 md:p-6 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm tracking-tight flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Today's brief
            </h2>
            <button
              onClick={() => regenBrief.mutate()}
              disabled={regenBrief.isPending}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-60"
            >
              <RefreshCw className={`h-3 w-3 ${regenBrief.isPending ? "animate-spin" : ""}`} /> refresh
            </button>
          </div>
          {d?.brief?.summary ? (
            <div className="prose prose-sm prose-invert max-w-none prose-ul:my-2 prose-li:my-0.5 prose-p:my-2 text-sm">
              <ReactMarkdown>{normalizeBrief(d.brief.summary)}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No brief yet — hit refresh and Cadence will draft one from your workspace.</p>
          )}
        </section>

        {/* AGENT RAIL — always visible */}
        <section className="mb-5">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm tracking-tight flex items-center gap-2"><Bot className="h-3.5 w-3.5 text-violet-300" /> AI agents</h2>
              <span className="text-[11px] text-muted-foreground">Tap to dispatch · grounded in your workspace</span>
            </div>
            <Link to="/agents" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5">
            {(agents.data?.agents ?? []).map((a) => (
              <AgentChip
                key={a.id}
                agent={a}
                onRun={(input) => dispatchAgent.mutate({ agentId: a.id, input })}
                pending={dispatchAgent.isPending && dispatchAgent.variables?.agentId === a.id}
              />
            ))}
          </div>
        </section>

        {/* TABBED SECTIONS — keep dashboard organized */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="work">Work</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="pulse">Pulse</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-12 gap-4 md:gap-5">
              <section className="bento p-5 col-span-12 lg:col-span-6">
                <h3 className="font-display text-sm tracking-tight flex items-center gap-2 mb-4">
                  <Target className="h-3.5 w-3.5 text-emerald-300" /> Priority alignment
                </h3>
                <div className="space-y-3">
                  {(d?.projects ?? []).map((p) => (
                    <div key={p.id}>
                      <div className="flex justify-between text-xs">
                        <span className="truncate pr-2">{p.name}</span>
                        <span className="tabular-nums text-muted-foreground">{p.done}/{p.total}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${p.pct}%` }} />
                      </div>
                    </div>
                  ))}
                  {(d?.projects ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">Add your first product below.</p>
                  )}
                  <QuickProjectForm onAdd={(name) => addProject.mutate({ name })} />
                </div>
              </section>

              <section className="bento p-5 col-span-6 lg:col-span-3">
                <h3 className="font-display text-sm tracking-tight flex items-center gap-2"><Brain className="h-3.5 w-3.5 text-violet-300" /> Deep work</h3>
                <div className="mt-4 font-display text-4xl tabular-nums">
                  {(d?.deepWorkSeries ?? []).reduce((a, x) => a + x.count, 0)}
                  <span className="text-sm text-muted-foreground"> /wk</span>
                </div>
                <div className="mt-4 flex items-end gap-1 h-14">
                  {(d?.deepWorkSeries ?? []).map((b, i) => {
                    const max = Math.max(1, ...(d?.deepWorkSeries ?? []).map((s) => s.count));
                    return (
                      <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-violet-500/80 to-cyan-400/80" style={{ height: `${(b.count / max) * 100}%`, minHeight: 4 }} />
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  {(d?.deepWorkSeries ?? []).map((b, i) => <span key={i}>{b.day}</span>)}
                </div>
              </section>

              <section className="bento p-5 col-span-6 lg:col-span-3">
                <h3 className="font-display text-sm tracking-tight flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-cyan-300" /> Today's meetings</h3>
                <div className="mt-4 font-display text-4xl tabular-nums">
                  {Math.round(((d?.meetingMinutes ?? 0) / 60) * 10) / 10}
                  <span className="text-lg text-muted-foreground">h</span>
                </div>
                <ul className="mt-4 space-y-2 text-xs">
                  {(d?.todayMeetings ?? []).slice(0, 4).map((m) => (
                    <li key={m.id} className="flex justify-between gap-2">
                      <span className="truncate">{m.title}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {new Date(m.start_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </li>
                  ))}
                  {(d?.todayMeetings ?? []).length === 0 && <li className="text-muted-foreground">No meetings today.</li>}
                </ul>
                <QuickMeetingForm onAdd={(data) => addMeeting.mutate(data)} />
              </section>
            </div>
          </TabsContent>

          <TabsContent value="work" className="space-y-4">
            <div className="grid grid-cols-12 gap-4 md:gap-5">
              <TaskPanel
                tasks={tasks.data?.tasks ?? []}
                onAdd={(t, deep) => addTask.mutate({ title: t, is_deep_work: deep })}
                onToggle={(id, done) => toggleTask.mutate({ id, status: done ? "done" : "todo" })}
                onDelete={(id) => removeTask.mutate(id)}
              />
              <section className="bento p-5 col-span-12 lg:col-span-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-sm tracking-tight flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Copilot
                  </h3>
                  <button onClick={() => invalidate("copilot")} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> refresh
                  </button>
                </div>
                <CopilotChat
                  messages={messages.data?.messages ?? []}
                  onSend={(t) => sendMsg.mutate(t)}
                  pending={sendMsg.isPending}
                />
              </section>
            </div>
          </TabsContent>

          <TabsContent value="agents" className="space-y-4">
            <div className="grid grid-cols-12 gap-4 md:gap-5">
              <section className="bento p-5 col-span-12 lg:col-span-7">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-sm tracking-tight flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-cyan-300" /> Agent activity
                  </h3>
                  <span className="text-[11px] text-muted-foreground">{runs.data?.runs?.length ?? 0} recent</span>
                </div>
                <ul className="space-y-2.5 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
                  {(runs.data?.runs ?? []).length === 0 && (
                    <li className="text-xs text-muted-foreground py-6 text-center border hairline rounded-xl">
                      No agent runs yet — dispatch one above.
                    </li>
                  )}
                  {(runs.data?.runs ?? []).map((r) => (
                    <li key={r.id} className="rounded-xl border hairline p-3 bg-background/40">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-foreground">{r.agent_name}</span>
                        <StatusBadge status={r.status} />
                        <span className="ml-auto text-muted-foreground tabular-nums">
                          {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground italic line-clamp-1">{r.input}</div>
                      {r.output && (<div className="mt-2 text-sm whitespace-pre-wrap line-clamp-3">{r.output}</div>)}
                    </li>
                  ))}
                </ul>
              </section>
              <DecisionPanel
                decisions={decisions.data?.decisions ?? []}
                onAdd={(title) => addDecision.mutate({ title })}
                onSet={(id, status) => setDecisionStatus.mutate({ id, status })}
              />
            </div>
          </TabsContent>

          <TabsContent value="pulse" className="space-y-4">
            <div className="grid grid-cols-12 gap-4 md:gap-5">
              <section className="bento p-5 col-span-12 lg:col-span-6">
                <h3 className="font-display text-sm tracking-tight flex items-center gap-2 mb-4">
                  <Users className="h-3.5 w-3.5 text-pink-300" /> Stakeholder pulse
                </h3>
                {(d?.stakeholders ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Add meetings with a stakeholder to populate this.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {d!.stakeholders.map((p) => (
                      <div key={p.name} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500/40 to-violet-500/40 grid place-items-center text-[11px] font-medium">
                            {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <div className="text-sm">{p.name}</div>
                            <div className="text-[11px] text-muted-foreground">{p.count} meeting{p.count > 1 ? "s" : ""} · last {new Date(p.last).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-pink-400 to-rose-400" style={{ width: `${Math.min(100, p.count * 20)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="bento p-5 col-span-12 lg:col-span-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20"><div className="absolute inset-0 neural-gradient" /></div>
                <div className="relative">
                  <h3 className="font-display text-sm tracking-tight flex items-center gap-2 mb-4"><Zap className="h-3.5 w-3.5 text-amber-300" /> Product health</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <Metric label="Velocity" value={`${(tasks.data?.tasks ?? []).filter((t) => t.status === "done").length}`} sub="tasks shipped" />
                    <Metric label="In flight" value={`${(tasks.data?.tasks ?? []).filter((t) => t.status !== "done").length}`} sub="open" />
                    <Metric label="Agent runs" value={`${runs.data?.runs?.length ?? 0}`} sub="last 24h" />
                  </div>
                </div>
              </section>
            </div>
          </TabsContent>
        </Tabs>

        <footer className="mt-12 pt-6 border-t hairline flex items-center justify-between text-xs text-muted-foreground">
          <span>Cadence · the operating system for AI Product Managers</span>
          <span className="neural-text font-medium">Neural Expressive · v0.1</span>
        </footer>
      </div>
    </AppShell>
  );
}

/* ------- Subcomponents ------- */

function normalizeBrief(text: string): string {
  // If the summary already contains list markers, return as-is.
  if (/^\s*[-*]\s/m.test(text) || /^\s*\d+\.\s/m.test(text)) return text;
  // Otherwise split sentences into bullet points for clean display.
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return text;
  return parts.map((s) => `- ${s}`).join("\n");
}

function Pill({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border hairline bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground">
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="font-display text-3xl tabular-nums mt-1">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ComponentType<{ className?: string }>; cls: string; label: string }> = {
    running: { icon: Clock, cls: "text-amber-300", label: "running" },
    complete: { icon: CheckCircle2, cls: "text-emerald-300", label: "complete" },
    failed: { icon: XCircle, cls: "text-rose-300", label: "failed" },
  };
  const v = map[status] ?? map.complete;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider ${v.cls}`}>
      <v.icon className="h-3 w-3" /> {v.label}
    </span>
  );
}

function AgentChip({
  agent,
  onRun,
  pending,
}: {
  agent: { id: string; name: string; role: string; color: string };
  onRun: (input: string) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const grad = AGENT_COLORS[agent.color] ?? AGENT_COLORS.violet;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className={`w-full text-left bento p-3 hover:ring-1 hover:ring-white/10 transition relative overflow-hidden`}
      >
        <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br ${grad} blur-md opacity-60`} />
        <div className="relative">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{agent.role.replace("AI ", "")}</div>
          <div className="font-display text-sm mt-0.5 truncate">{agent.name}</div>
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Bot className="h-2.5 w-2.5" /> dispatch
          </div>
        </div>
      </button>
      {open && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; onRun(text.trim()); setText(""); setOpen(false); }}
          className="absolute z-20 top-full mt-2 left-0 right-0 bento p-3 shadow-xl"
        >
          <textarea
            autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={3}
            placeholder={`Brief ${agent.name}…`}
            className="w-full rounded-lg border hairline bg-background/60 px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted-foreground">Cancel</button>
            <button disabled={pending} className="rounded-lg bg-foreground text-background px-2.5 py-1 text-[11px] disabled:opacity-60">
              {pending ? "Running…" : "Dispatch"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function TaskPanel({
  tasks, onAdd, onToggle, onDelete,
}: {
  tasks: { id: string; title: string; status: string; is_deep_work: boolean }[];
  onAdd: (title: string, deep: boolean) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [deep, setDeep] = useState(false);
  return (
    <section className="bento p-5 col-span-12 lg:col-span-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm tracking-tight">Today's tasks</h3>
        <span className="text-[11px] text-muted-foreground">{tasks.filter((t) => t.status !== "done").length} open</span>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; onAdd(title.trim(), deep); setTitle(""); setDeep(false); }}
        className="flex items-center gap-2 mb-4"
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen today?"
          className="flex-1 rounded-lg border hairline bg-background/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> deep
        </label>
        <button className="rounded-lg bg-foreground text-background px-3 py-2 text-sm"><Plus className="h-3.5 w-3.5" /></button>
      </form>
      <ul className="divide-y divide-border max-h-72 overflow-y-auto scrollbar-thin">
        {tasks.length === 0 && <li className="py-3 text-xs text-muted-foreground">Nothing planned yet.</li>}
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5">
            <input type="checkbox" checked={t.status === "done"} onChange={(e) => onToggle(t.id, e.target.checked)} className="h-4 w-4" />
            <span className={`flex-1 text-sm ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
            {t.is_deep_work && <span className="text-[10px] uppercase tracking-wider rounded-full bg-violet-500/15 text-violet-200 px-2 py-0.5">deep</span>}
            <button onClick={() => onDelete(t.id)} className="text-xs text-muted-foreground hover:text-destructive">×</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuickProjectForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; onAdd(name.trim()); setName(""); }} className="pt-3 flex items-center gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New product" className="flex-1 rounded-lg border hairline bg-background/60 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring" />
      <button className="rounded-lg bg-foreground text-background px-2.5 py-1.5 text-xs">Add</button>
    </form>
  );
}

function QuickMeetingForm({ onAdd }: { onAdd: (data: { title: string; start_at: string; end_at: string; stakeholder?: string }) => void }) {
  const [title, setTitle] = useState("");
  const [stakeholder, setStakeholder] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const start = new Date(); start.setMinutes(0, 0, 0); start.setHours(start.getHours() + 1);
        const end = new Date(start); end.setMinutes(end.getMinutes() + 30);
        onAdd({ title: title.trim(), start_at: start.toISOString(), end_at: end.toISOString(), stakeholder: stakeholder.trim() || undefined });
        setTitle(""); setStakeholder("");
      }}
      className="mt-4 flex flex-col gap-2"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New meeting" className="rounded-lg border hairline bg-background/60 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring" />
      <div className="flex gap-2">
        <input value={stakeholder} onChange={(e) => setStakeholder(e.target.value)} placeholder="With…" className="flex-1 rounded-lg border hairline bg-background/60 px-2.5 py-1.5 text-xs outline-none" />
        <button className="rounded-lg bg-foreground text-background px-2.5 py-1.5 text-xs">Add</button>
      </div>
    </form>
  );
}

function DecisionPanel({
  decisions, onAdd, onSet,
}: {
  decisions: { id: string; title: string; status: string; rationale: string | null; created_at: string }[];
  onAdd: (title: string) => void;
  onSet: (id: string, status: "approved" | "rejected" | "pending") => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <section className="bento p-5 col-span-12 lg:col-span-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm tracking-tight flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5 text-rose-300" /> Decisions awaiting you</h3>
        <span className="text-[11px] text-muted-foreground">{decisions.filter((d) => d.status === "pending").length} pending</span>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; onAdd(title.trim()); setTitle(""); }} className="flex items-center gap-2 mb-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Log a decision the AI surfaced…"
          className="flex-1 rounded-lg border hairline bg-background/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
        <button className="rounded-lg bg-foreground text-background px-3 py-2 text-xs">Log</button>
      </form>
      <ul className="space-y-2">
        {decisions.length === 0 && <li className="text-xs text-muted-foreground py-4">No decisions logged yet.</li>}
        {decisions.map((d) => (
          <li key={d.id} className="flex items-center gap-3 rounded-xl border hairline px-3 py-2.5">
            <span className="flex-1 text-sm">{d.title}</span>
            <span className={`text-[10px] uppercase tracking-wider ${d.status === "approved" ? "text-emerald-300" : d.status === "rejected" ? "text-rose-300" : "text-amber-300"}`}>{d.status}</span>
            {d.status === "pending" && (
              <div className="flex gap-1">
                <button onClick={() => onSet(d.id, "approved")} className="text-[11px] rounded-md bg-emerald-500/15 text-emerald-200 px-2 py-1">Approve</button>
                <button onClick={() => onSet(d.id, "rejected")} className="text-[11px] rounded-md bg-rose-500/15 text-rose-200 px-2 py-1">Reject</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CopilotChat({
  messages, onSend, pending,
}: {
  messages: { id: string; role: string; content: string }[];
  onSend: (prompt: string) => void;
  pending: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-3 min-h-[300px]">
      <div className="flex-1 space-y-3 max-h-80 overflow-y-auto scrollbar-thin pr-1">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ask Cadence — "What should I focus on?", "Draft a launch update", "Plan my afternoon".
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "bg-secondary ml-6" : "bg-background/60 border hairline mr-6"}`}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{m.role === "user" ? "you" : "cadence"}</div>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        {pending && <div className="text-xs text-muted-foreground italic">Cadence is thinking…</div>}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (!text.trim() || pending) return; onSend(text.trim()); setText(""); }}
        className="flex items-center gap-2"
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything…"
          className="flex-1 rounded-xl border hairline bg-background/60 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring" />
        <button disabled={pending} className="rounded-xl bg-foreground text-background px-3 py-2.5 text-sm disabled:opacity-60"><Send className="h-3.5 w-3.5" /></button>
      </form>
    </div>
  );
}