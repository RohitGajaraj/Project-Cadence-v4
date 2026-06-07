import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/cadence/AppShell";
import {
  listConversations,
  getConversation,
  createConversation,
  deleteConversation,
} from "@/lib/conversations.functions";
import { listProjects } from "@/lib/projects.functions";
import { getProfile } from "@/lib/profile.functions";
import { MODELS } from "@/lib/ai/models";
import { getMission } from "@/lib/missions.functions";
import { listMissionSteps } from "@/lib/orchestrator.functions";
import { decideApproval } from "@/lib/agent_loop.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
  head: () => ({ meta: [{ title: "Chat · Cadence" }] }),
});

type Msg = { id: string; role: string; content: string; mission_id?: string | null };

function ChatPage() {
  const qc = useQueryClient();
  const fProjects = useServerFn(listProjects);
  const fProfile = useServerFn(getProfile);
  const fList = useServerFn(listConversations);
  const fGet = useServerFn(getConversation);
  const fCreate = useServerFn(createConversation);
  const fDelete = useServerFn(deleteConversation);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fProfile() });
  const convs = useQuery({ queryKey: ["conversations"], queryFn: () => fList() });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState<string>("google/gemini-3-flash-preview");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [liveMessages, setLiveMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-pick first or auto-create
  useEffect(() => {
    if (!convs.data) return;
    if (!activeId && convs.data.conversations.length > 0) {
      setActiveId(convs.data.conversations[0].id);
    }
  }, [convs.data, activeId]);

  // Set default model from profile
  useEffect(() => {
    if (profile.data?.profile && "default_model" in profile.data.profile) {
      const m = (profile.data.profile as { default_model?: string }).default_model;
      if (m) setModel(m);
    }
  }, [profile.data]);

  const active = useQuery({
    queryKey: ["conversation", activeId],
    queryFn: () => fGet({ data: { id: activeId! } }),
    enabled: !!activeId,
  });

  useEffect(() => {
    setLiveMessages((active.data?.messages as Msg[]) ?? []);
  }, [active.data]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [liveMessages, streaming]);

  const mNew = useMutation({
    mutationFn: () => fCreate({ data: { model } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setActiveId(r.conversation.id);
      setLiveMessages([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => fDelete({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setActiveId(null);
    },
  });

  async function ensureConversation(): Promise<string> {
    if (activeId) return activeId;
    const r = await fCreate({ data: { model } });
    qc.invalidateQueries({ queryKey: ["conversations"] });
    setActiveId(r.conversation.id);
    return r.conversation.id;
  }

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    setStreaming(true);

    const convId = await ensureConversation();
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content };
    const assistantMsg: Msg = { id: `a-${Date.now()}`, role: "assistant", content: "" };
    setLiveMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, content, model }),
      });
      if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Add credits in Settings → Usage.");
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const piece: string | undefined = parsed.choices?.[0]?.delta?.content;
            const missionId: string | undefined = parsed.choices?.[0]?.delta?.mission_id;
            if (piece || missionId) {
              if (piece) acc += piece;
              setLiveMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  content: acc,
                  ...(missionId ? { mission_id: missionId } : {}),
                };
                return next;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
      setLiveMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  }

  const isEmpty = liveMessages.length === 0;
  const firstName =
    (
      profile.data?.profile as { display_name?: string; full_name?: string } | null
    )?.display_name?.split(" ")[0] ||
    (profile.data?.profile as { full_name?: string } | null)?.full_name?.split(" ")[0] ||
    "there";

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="grid grid-cols-[260px,1fr] h-[100dvh] max-h-[100dvh] overflow-hidden">
        {/* Conversation rail */}
        <aside className="border-r hairline bg-background/40 backdrop-blur-xl flex flex-col min-h-0">
          <div className="p-3 border-b hairline">
            <button
              onClick={() => mNew.mutate()}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--primary)_60%,transparent)] hover:opacity-95 transition"
              style={{
                background:
                  "var(--gradient-primary, linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 60%, #a78bfa)))",
              }}
            >
              <Plus className="h-3.5 w-3.5" /> New chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
            {convs.isLoading && <div className="text-xs text-muted-foreground p-3">Loading…</div>}
            {(convs.data?.conversations ?? []).map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm cursor-pointer transition ${
                  activeId === c.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
                onClick={() => setActiveId(c.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{c.title}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    mDel.mutate(c.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {convs.data?.conversations.length === 0 && (
              <div className="text-xs text-muted-foreground p-3">No chats yet.</div>
            )}
          </div>
        </aside>

        {/* Conversation pane */}
        <section className="flex flex-col min-h-0 h-[100dvh] relative">
          <header className="flex items-center justify-between gap-4 px-6 h-14 border-b hairline glass shrink-0">
            <div className="text-sm text-muted-foreground truncate">
              {active.data?.conversation?.title ?? "New conversation"}
            </div>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="text-xs bg-background/60 border hairline rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
            >
              {MODELS.filter((m) => m.live).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
              <optgroup label="— Bring your own key (coming) —">
                {MODELS.filter((m) => !m.live).map((m) => (
                  <option key={m.id} value={m.id} disabled>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </header>

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            {isEmpty ? (
              <div className="h-full grid place-items-center px-6 py-10">
                <div className="max-w-2xl text-center">
                  <div className="mx-auto h-16 w-16 rounded-2xl ring-glow-violet relative overflow-hidden">
                    <div className="absolute inset-0 neural-gradient animate-aurora" />
                  </div>
                  <h1 className="mt-8 font-display text-4xl md:text-5xl tracking-tight leading-tight">
                    Hi <span className="neural-text">{firstName}</span>. How can I help?
                  </h1>
                  <p className="mt-3 text-sm md:text-base text-muted-foreground">
                    Ask anything about your products, tasks, or strategy. I'm grounded in your
                    workspace.
                  </p>
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                    {[
                      "Summarize today and tell me what to focus on",
                      "Draft a PRD outline for my top product",
                      "What's slipping across my open tasks?",
                      "Propose a 2-week sprint plan",
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="bento p-4 text-sm text-left text-muted-foreground hover:text-foreground hover:ring-1 hover:ring-primary/30 transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
                {liveMessages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    role={m.role}
                    content={m.content}
                    missionId={m.mission_id}
                    streaming={streaming && m === liveMessages[liveMessages.length - 1]}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t hairline glass shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="max-w-3xl mx-auto px-6 py-4"
            >
              <div
                className="relative rounded-2xl p-[1px] transition"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in oklab, var(--primary) 55%, transparent), color-mix(in oklab, #a78bfa 45%, transparent), color-mix(in oklab, #38bdf8 35%, transparent))",
                }}
              >
                <div className="flex items-end gap-2 rounded-2xl bg-background/80 backdrop-blur-xl p-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={2}
                    placeholder="Message Cadence…   (Enter to send · Shift+Enter for newline)"
                    className="flex-1 bg-transparent px-3 py-2 text-sm outline-none resize-none max-h-40 placeholder:text-muted-foreground/70"
                  />
                  <button
                    type="submit"
                    disabled={streaming || !input.trim()}
                    className="h-10 w-10 grid place-items-center rounded-xl text-white shadow-[0_8px_24px_-10px_color-mix(in_oklab,var(--primary)_70%,transparent)] disabled:opacity-40 transition hover:scale-[1.03]"
                    style={{ background: "linear-gradient(135deg, var(--primary), #a78bfa)" }}
                  >
                    {streaming ? (
                      <Sparkles className="h-4 w-4 animate-pulse" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="mt-2.5 text-[10px] text-muted-foreground text-center tracking-wide">
                Grounded in your workspace · {MODELS.find((m) => m.id === model)?.label ?? model}
              </div>
            </form>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function statusTone(status?: string) {
  switch (status) {
    case "completed":
    case "done":
      return "bg-pale-green/60 text-deep-green border-deep-green/20";
    case "failed":
      return "bg-rose/10 text-rose border-rose/20";
    case "running":
    case "dispatched":
      return "bg-pale-blue/60 text-action-blue border-action-blue/20 animate-pulse";
    case "queued":
    case "planned":
      return "bg-soft-stone text-ink-muted border-hairline";
    case "skipped":
      return "bg-soft-stone/40 text-ink-subtle border-hairline/60";
    default:
      return "bg-soft-stone text-ink-muted border-hairline";
  }
}

function dotColor(status?: string) {
  switch (status) {
    case "completed":
    case "done":
      return "bg-deep-green";
    case "failed":
      return "bg-rose";
    case "running":
    case "dispatched":
      return "bg-action-blue animate-ping";
    case "queued":
    case "planned":
      return "bg-ink-muted";
    case "skipped":
      return "bg-ink-subtle/50";
    default:
      return "bg-ink-muted";
  }
}

function InlineApprovalsPanel({
  traceId,
  onResolved,
}: {
  traceId: string;
  onResolved: () => void;
}) {
  const fDecide = useServerFn(decideApproval);
  const qc = useQueryClient();

  // Query pending approvals for this trace
  const { data: pendingApprovals, refetch } = useQuery({
    queryKey: ["mission-approvals", traceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_approvals")
        .select("id,tool_name,args,rationale")
        .eq("trace_id", traceId)
        .eq("status", "pending");
      return data ?? [];
    },
  });

  const decide = useMutation({
    mutationFn: (args: { id: string; decision: "approve" | "reject" }) =>
      fDecide({ data: { approvalId: args.id, decision: args.decision } }),
    onSuccess: (r, vars) => {
      toast.success(
        vars.decision === "approve"
          ? r.executed
            ? "Approved & executed tool call"
            : "Approved tool call"
          : "Rejected tool call",
      );
      refetch();
      onResolved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!pendingApprovals || pendingApprovals.length === 0) return null;

  return (
    <div className="p-3 bg-coral/10 border border-coral-soft rounded-lg space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="text-[10px] mono-label text-coral font-bold uppercase flex items-center gap-1.5">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        Action Required: Governance Gate
      </div>
      {pendingApprovals.map((appr) => (
        <div
          key={appr.id}
          className="space-y-2 border-t border-coral-soft/20 pt-2 first:border-0 first:pt-0"
        >
          <div className="text-xs text-ink">
            <strong>Tool:</strong>{" "}
            <code className="bg-canvas px-1 rounded border hairline font-mono text-[11px]">
              {appr.tool_name}
            </code>
          </div>
          {appr.rationale && <p className="text-xs text-ink-muted italic">"{appr.rationale}"</p>}
          <div className="flex gap-2">
            <button
              onClick={() => decide.mutate({ id: appr.id, decision: "approve" })}
              disabled={decide.isPending}
              className="px-2.5 py-1 text-xs font-semibold text-white bg-deep-green rounded hover:bg-opacity-95 transition-opacity disabled:opacity-50"
            >
              {decide.isPending ? "Processing..." : "Approve · run"}
            </button>
            <button
              onClick={() => decide.mutate({ id: appr.id, decision: "reject" })}
              disabled={decide.isPending}
              className="px-2.5 py-1 text-xs font-semibold text-coral border border-coral-soft rounded hover:bg-coral/5 transition-colors disabled:opacity-50"
            >
              Reject · nothing runs
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function InlineMissionProgress({ missionId }: { missionId: string }) {
  const fGet = useServerFn(getMission);
  const fSteps = useServerFn(listMissionSteps);
  const qc = useQueryClient();

  const m = useQuery({
    queryKey: ["chat-mission", missionId],
    queryFn: () => fGet({ data: { missionId } }),
    refetchInterval: (q) => {
      const s = q.state.data?.mission?.status;
      return s === "running" || s === "queued" ? 2000 : false;
    },
  });

  const steps = useQuery({
    queryKey: ["chat-mission-steps", missionId],
    queryFn: () => fSteps({ data: { missionId } }),
    refetchInterval: (q) => {
      const rows = q.state.data?.steps ?? [];
      return rows.some((r) => ["dispatched", "running", "planned"].includes(r.status))
        ? 2500
        : false;
    },
  });

  const [showRawDetails, setShowRawDetails] = useState(false);

  if (m.isLoading || steps.isLoading) {
    return (
      <div className="rounded-xl border hairline bg-soft-stone/40 p-4 max-w-2xl space-y-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono">
            Initializing mission cockpit...
          </span>
        </div>
      </div>
    );
  }

  const mission = m.data?.mission;
  const planSteps = steps.data?.steps ?? [];
  const activeHop = m.data?.hops.find((h) => ["running", "queued"].includes(h.status));
  const activeTraceId = activeHop?.trace_id;

  return (
    <div className="rounded-xl border hairline bg-soft-stone/40 p-4 space-y-4 max-w-2xl transition-all duration-300">
      <div className="flex items-center justify-between gap-3 border-b hairline pb-2">
        <div className="min-w-0">
          <span className="text-[10px] mono-label text-muted-foreground">Mission Cockpit</span>
          <h4 className="font-display text-sm font-semibold text-ink mt-0.5 truncate">
            {mission?.title}
          </h4>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusTone(mission?.status)}`}
        >
          {mission?.status}
        </span>
      </div>

      <div className="space-y-2">
        {planSteps.length === 0 ? (
          <div className="text-xs text-muted-foreground italic pl-1">Planning stages...</div>
        ) : (
          planSteps.map((s, i) => (
            <div
              key={s.id}
              className="flex items-start gap-2.5 text-xs animate-in fade-in slide-in-from-top-1 duration-150"
            >
              <span className="mt-0.5 text-[10px] text-muted-foreground font-mono w-4 shrink-0 text-right">
                {i + 1}.
              </span>
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${dotColor(s.status)}`} />
              <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-ink text-[11px] uppercase shrink-0">
                  {s.agent_slug}
                </span>
                <span className="text-ink-muted text-xs truncate max-w-md">{s.sub_goal}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {activeTraceId && (
        <InlineApprovalsPanel
          traceId={activeTraceId}
          onResolved={() => {
            qc.invalidateQueries({ queryKey: ["chat-mission", missionId] });
            qc.invalidateQueries({ queryKey: ["chat-mission-steps", missionId] });
          }}
        />
      )}

      <div className="flex items-center justify-between pt-2.5 text-[11px] text-muted-foreground border-t border-muted">
        <button
          onClick={() => setShowRawDetails(!showRawDetails)}
          className="text-action-blue hover:text-focus-blue hover:underline font-mono flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
        >
          {showRawDetails ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Hide raw trace
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Show raw trace
            </>
          )}
        </button>
        <Link
          to="/missions/$missionId"
          params={{ missionId }}
          className="text-action-blue hover:text-focus-blue hover:underline font-mono flex items-center gap-1"
        >
          Open mission page
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {showRawDetails && (
        <div className="mt-3 p-3 bg-canvas border hairline rounded-lg space-y-3 max-h-60 overflow-y-auto scrollbar-thin animate-in slide-in-from-top-2 duration-200">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono border-b hairline pb-1 flex items-center justify-between">
            <span>Execution Hops Trace</span>
            <span>{m.data?.hops.length ?? 0} hops</span>
          </div>
          {m.data?.hops.map((h, i) => (
            <div
              key={h.run_id}
              className="text-[11px] font-mono border-b border-muted/50 pb-2 last:border-0 last:pb-0"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-ink">
                  {h.agent_name} ({h.agent_slug})
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${statusTone(h.status)}`}
                >
                  {h.status}
                </span>
              </div>
              {h.steps.length === 0 ? (
                <div className="pl-3 text-muted-foreground text-[10px] italic">
                  No active steps logged
                </div>
              ) : (
                h.steps.map((st, idx) => (
                  <div key={idx} className="pl-3 text-muted-foreground text-[10px] leading-relaxed">
                    -{" "}
                    {st.kind === "thought"
                      ? st.text
                      : st.kind === "tool_call"
                        ? `called ${st.name}`
                        : "reply"}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  role,
  content,
  missionId,
  streaming,
}: {
  role: string;
  content: string;
  missionId?: string | null;
  streaming?: boolean;
}) {
  const isUser = role === "user";

  if (!isUser && missionId) {
    return (
      <div className="flex gap-3 animate-in fade-in duration-200">
        {!isUser && (
          <div className="h-7 w-7 rounded-lg relative overflow-hidden shrink-0 ring-glow-violet">
            <div className="absolute inset-0 neural-gradient" />
          </div>
        )}
        <div className="flex-1 space-y-3 max-w-full">
          {content && (
            <div className="text-sm text-muted-foreground leading-relaxed prose prose-neutral dark:prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:mt-3 prose-pre:bg-background/60 prose-pre:border prose-pre:border-hairline">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
          <InlineMissionProgress missionId={missionId} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-lg relative overflow-hidden shrink-0 ring-glow-violet">
          <div className="absolute inset-0 neural-gradient" />
        </div>
      )}
      <div
        className={`${isUser ? "bento bg-secondary/60 max-w-[80%]" : "max-w-full"} px-4 py-3 rounded-2xl`}
      >
        {content ? (
          <div className="prose prose-neutral dark:prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:mt-3 prose-pre:bg-background/60 prose-pre:border prose-pre:border-hairline">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : streaming ? (
          <div className="flex gap-1 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-pulse [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-pulse [animation-delay:240ms]" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
