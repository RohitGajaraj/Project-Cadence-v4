import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bot, Sparkles, Send, Clock } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listAgents, listAgentRuns, updateAgentSchedule } from "@/lib/agents.functions";
import { runAgent } from "@/lib/agent_loop.functions";
import { listProjects } from "@/lib/projects.functions";
import { listApiKeys } from "@/lib/byokeys.functions";

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

  const dispatch = useMutation({
    mutationFn: (data: { agentSlug: string; goal: string; model?: string }) => mRun({ data }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      const tid = (res as { trace_id?: string } | undefined)?.trace_id;
      toast.success("Agent finished" + (tid ? " — trace ready" : ""));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [schedule, setSchedule] = useState<string>("");
  const [cronInput, setCronInput] = useState<string>("");
  const [model, setModel] = useState<string>("google/gemini-2.5-flash");

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
      <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-violet-300" /> AI agents
          </div>
          <h1 className="mt-3 font-display text-4xl tracking-tight">Your <span className="neural-text">AI team</span></h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">Specialized agents that ground in your workspace and execute work alongside you. Brief any agent — review the output, approve, and ship.</p>
        </header>

        <div className="grid grid-cols-12 gap-5">
          <aside className="col-span-12 lg:col-span-4 space-y-2">
            {(agents.data?.agents ?? []).map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`w-full text-left bento p-4 transition ${selected?.id === a.id ? "ring-1 ring-white/15" : "hover:ring-1 hover:ring-white/10"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500/40 to-cyan-500/30 grid place-items-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-sm">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{a.role}</div>
                  </div>
                </div>
              </button>
            ))}
          </aside>

          <section className="col-span-12 lg:col-span-8 space-y-5">
            {selected && (
              <>
                <div className="bento p-6 relative overflow-hidden">
                  <div className="absolute inset-0 neural-gradient opacity-20" />
                  <div className="relative">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{selected.role}</div>
                    <h2 className="font-display text-2xl mt-1">{selected.name}</h2>
                    <p className="mt-3 text-sm text-muted-foreground max-w-2xl">{selected.system_prompt}</p>
                  </div>
                </div>

                <form
                  onSubmit={(e) => { e.preventDefault(); if (!input.trim()) return; dispatch.mutate({ agentSlug: selected.slug, goal: input.trim(), model }); setInput(""); }}
                  className="bento p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-violet-300" /> Brief {selected.name}
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
    </AppShell>
  );
}