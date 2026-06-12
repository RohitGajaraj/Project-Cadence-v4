import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Brain,
  Gavel,
  ShieldAlert,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import {
  MessageMetaFooter,
  parseChatMeta,
  pickFeedbackId,
  type ChatMeta,
} from "@/components/chat/MessageMeta";
import { ModelSwitcher } from "@/components/chat/ModelSwitcher";
import {
  parseResearchStatus,
  ResearchActivityLine,
  ResearchSummaryRow,
  type ResearchStatus,
} from "@/components/chat/ResearchActivity";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  listConversations,
  getConversation,
  createConversation,
  deleteConversation,
} from "@/lib/conversations.functions";
import { getBrainStatus, rememberMessage } from "@/lib/brain.functions";
import { createDecision } from "@/lib/decisions.functions";
import { listProjects } from "@/lib/projects.functions";
import { getProfile } from "@/lib/profile.functions";
import { getMission } from "@/lib/missions.functions";
import { listMissionSteps } from "@/lib/orchestrator.functions";
import { decideApproval } from "@/lib/agent_loop.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
  head: () => ({ meta: [{ title: "Brain · Cadence" }] }),
});

type Msg = {
  id: string;
  role: string;
  content: string;
  mission_id?: string | null;
  meta?: ChatMeta | null;
  error?: boolean;
};

/** Errors safe to show in the thread verbatim — anything else gets a generic line. */
class ChatUiError extends Error {}

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
  // Research-progress events for the in-flight reply (protocol v2 status events).
  const [liveStatuses, setLiveStatuses] = useState<ResearchStatus[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Autoscroll only while the user is pinned to the bottom; scrolling up detaches.
  const pinnedRef = useRef(true);

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
    // Never clobber the in-flight optimistic messages mid-stream (the query can
    // resolve right after ensureConversation creates a fresh conversation).
    if (streaming) return;
    // Historical messages may carry persisted meta in a `metadata` jsonb column;
    // absent or malformed metadata simply renders no footer.
    const rows = (active.data?.messages ?? []) as Array<Msg & { metadata?: unknown }>;
    setLiveMessages(rows.map((r) => ({ ...r, meta: parseChatMeta(r.metadata) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- streaming intentionally excluded: re-running on stream end would replace the just-streamed reply with stale rows
  }, [active.data]);

  useEffect(() => {
    if (!pinnedRef.current) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: streaming ? "auto" : "smooth",
    });
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

  function stopStreaming() {
    abortRef.current?.abort();
  }

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setStreaming(true);
    setLiveStatuses([]);
    pinnedRef.current = true;

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content };
    const assistantMsg: Msg = { id: `a-${Date.now()}`, role: "assistant", content: "" };
    setLiveMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      let convId: string;
      try {
        convId = await ensureConversation();
      } catch (err) {
        console.error(err);
        throw new ChatUiError("I couldn't start this conversation. Please try again.");
      }
      // /api/chat validates a Bearer token (same contract as requireSupabaseAuth);
      // without this header every chat request 401s silently.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ conversationId: convId, content, model }),
        signal: ctrl.signal,
      });
      if (res.status === 401)
        throw new ChatUiError("Your session needs a refresh — reload the page and try again.");
      if (res.status === 429)
        throw new ChatUiError("Rate limit reached — give it a few seconds and try again.");
      if (res.status === 402)
        throw new ChatUiError("AI credits exhausted. Add credits in Settings → Usage.");
      if (!res.ok || !res.body) {
        console.error("chat request failed", res.status, await res.text().catch(() => ""));
        throw new ChatUiError("I couldn't reach the model just now. Please try again.");
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
            // Protocol v2: research-progress events stream before token chunks.
            const status = parseResearchStatus((parsed as { status?: unknown }).status);
            if (status) {
              setLiveStatuses((prev) => [...prev, status]);
              continue;
            }
            // Shared contract: one `{"meta": …}` event arrives just before [DONE].
            const meta = parseChatMeta((parsed as { meta?: unknown }).meta);
            if (meta) {
              setLiveMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { ...next[next.length - 1], meta };
                return next;
              });
              continue;
            }
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
      if (e instanceof Error && e.name === "AbortError") {
        // User pressed Stop — keep the partial reply; drop the bubble if empty.
        setLiveMessages((prev) => {
          const last = prev[prev.length - 1];
          return last?.role === "assistant" && !last.content ? prev.slice(0, -1) : prev;
        });
      } else {
        console.error(e);
        const friendly =
          e instanceof ChatUiError
            ? e.message
            : "Something went wrong reaching the model. Please try again.";
        setLiveMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && !last.content) {
            next[next.length - 1] = { ...last, content: friendly, error: true };
          }
          return next;
        });
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }

  const isEmpty = liveMessages.length === 0;

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="grid grid-cols-[260px,1fr] h-[100dvh] max-h-[100dvh] overflow-hidden">
        {/* Conversation rail */}
        <aside className="border-r hairline bg-background/40 backdrop-blur-xl flex flex-col min-h-0">
          <div className="p-3 border-b hairline">
            <button
              onClick={() => {
                abortRef.current?.abort();
                mNew.mutate();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--primary)_60%,transparent)] hover:opacity-95 transition"
              style={{
                background:
                  "var(--gradient-primary, linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 60%, var(--agent))))",
              }}
            >
              <Plus className="h-3.5 w-3.5" /> New thread
            </button>
          </div>
          <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Threads
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
                onClick={() => {
                  abortRef.current?.abort();
                  setActiveId(c.id);
                }}
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
              <div className="text-xs text-muted-foreground p-3">No threads yet.</div>
            )}
          </div>
        </aside>

        {/* Conversation pane */}
        <section className="flex flex-col min-h-0 h-[100dvh] relative">
          <header className="flex items-center justify-between gap-4 px-6 h-14 border-b hairline glass shrink-0">
            <div className="flex min-w-0 items-baseline gap-2.5">
              <h1 className="font-display text-sm font-semibold tracking-tight shrink-0">Brain</h1>
              <span className="text-sm text-muted-foreground truncate">
                {active.data?.conversation?.title ?? "New thread"}
              </span>
            </div>
            <BrainStatusButton />
          </header>

          <div
            ref={scrollRef}
            onScroll={() => {
              const el = scrollRef.current;
              if (!el) return;
              pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            className="flex-1 min-h-0 overflow-y-auto scrollbar-thin"
          >
            {isEmpty ? (
              <div className="h-full grid place-items-center px-6 py-10">
                <div className="max-w-2xl text-center">
                  <div className="mx-auto h-16 w-16 rounded-2xl ring-glow-violet relative overflow-hidden">
                    <div className="absolute inset-0 neural-gradient animate-aurora" />
                  </div>
                  <h1 className="mt-8 font-display text-4xl md:text-5xl tracking-tight leading-tight">
                    <span className="neural-text">Brain</span>
                  </h1>
                  <p className="mt-3 text-sm md:text-base text-muted-foreground">
                    Everything inward and outward — captured, cited, compounding.
                  </p>
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                    {[
                      "What is the weather in Munich?",
                      "What am I building next — how does the roadmap look?",
                      "Compare our opportunity queue against what competitors shipped this month",
                      "Draft a stakeholder update from this week's decisions",
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
              <div className="max-w-3xl mx-auto px-6 py-10 space-y-7">
                {liveMessages.map((m, i) => (
                  <MessageBubble
                    key={m.id}
                    role={m.role}
                    content={m.content}
                    missionId={m.mission_id}
                    meta={m.meta}
                    error={m.error}
                    feedbackId={pickFeedbackId(m.id, activeId)}
                    streaming={streaming && m === liveMessages[liveMessages.length - 1]}
                    statuses={liveStatuses}
                    question={
                      liveMessages
                        .slice(0, i)
                        .reverse()
                        .find((p) => p.role === "user")?.content ?? null
                    }
                    conversationId={activeId}
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
                    "linear-gradient(135deg, color-mix(in oklab, var(--primary) 55%, transparent), color-mix(in oklab, var(--agent) 45%, transparent), color-mix(in oklab, var(--action-blue) 35%, transparent))",
                }}
              >
                <div className="rounded-2xl bg-background/80 backdrop-blur-xl">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    placeholder="Message Cadence…"
                    className="block w-full bg-transparent px-4 pt-3.5 pb-1 text-sm outline-none resize-none min-h-[44px] placeholder:text-muted-foreground/70"
                  />
                  <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
                    <ModelSwitcher value={model} onChange={setModel} />
                    {streaming ? (
                      <button
                        type="button"
                        onClick={stopStreaming}
                        aria-label="Stop generating"
                        className="h-9 w-9 grid place-items-center rounded-xl border hairline bg-background/60 text-foreground transition hover:bg-secondary/60 active:scale-[0.97]"
                      >
                        <Square className="h-3 w-3 fill-current" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!input.trim()}
                        aria-label="Send message"
                        className="h-9 w-9 grid place-items-center rounded-xl text-white shadow-[0_8px_24px_-10px_color-mix(in_oklab,var(--primary)_70%,transparent)] disabled:opacity-40 transition active:scale-[0.97]"
                        style={{
                          background: "linear-gradient(135deg, var(--primary), var(--agent))",
                        }}
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 text-[10px] text-muted-foreground text-center tracking-wide">
                Enter to send · Shift+Enter for newline · Answers can use your workspace and the web
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

function StreamingCaret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-4 w-[3px] translate-y-[2px] rounded-full bg-foreground/50 animate-pulse"
    />
  );
}

/** Compact relative-time label for the brain freshness line, e.g. "2h". */
function relativeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return "moments";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * F-BRAIN status — "what the brain knows": counts by kind + freshness, in a
 * quiet popover off the thread header. Errors render nothing (best-effort).
 */
function BrainStatusButton() {
  const fStatus = useServerFn(getBrainStatus);
  const status = useQuery({ queryKey: ["brain-status"], queryFn: () => fStatus() });
  const s = status.data;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="What the brain knows"
          aria-label="What the brain knows"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground/70 transition hover:bg-secondary/60 hover:text-foreground"
        >
          <Brain className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-auto max-w-xs px-3 py-2">
        {s ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>
              The brain knows · {s.counts.signals} signals · {s.counts.docs} docs ·{" "}
              {s.counts.meetings} meetings · {s.counts.decisions} decisions · {s.counts.prds} PRDs ·{" "}
              {s.counts.findings} findings
            </div>
            <div className="text-[10px] text-muted-foreground/60">
              {s.latest ? `updated ${relativeAgo(s.latest)} ago` : "nothing captured yet"}
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/**
 * F-BRAIN message actions — quiet ghost icon buttons in the assistant footer:
 * "Remember this" distills the answer into indexed memory; "Capture as
 * decision" files it in the decision log. Both are best-effort one-taps.
 */
function BrainMessageActions({
  question,
  answer,
  conversationId,
}: {
  question?: string | null;
  answer: string;
  conversationId?: string | null;
}) {
  const fRemember = useServerFn(rememberMessage);
  const fDecide = useServerFn(createDecision);
  // Title = the user question; fall back to the start of the answer.
  const baseTitle = question?.trim() || answer.trim().slice(0, 80);

  const mRemember = useMutation({
    mutationFn: () =>
      fRemember({
        data: {
          ...(conversationId ? { conversationId } : {}),
          title: baseTitle.slice(0, 160),
          content: answer.trim().slice(0, 4000),
        },
      }),
    onSuccess: (r) =>
      toast.success(
        r.indexed ? "Saved to the brain" : "Saved — will index when embeddings are available",
      ),
    onError: () => toast.error("Couldn't save that just now."),
  });

  const mDecide = useMutation({
    mutationFn: () =>
      fDecide({
        data: { title: baseTitle.slice(0, 280), rationale: answer.trim().slice(0, 500) },
      }),
    onSuccess: () => toast.success("Captured as decision"),
    onError: () => toast.error("Couldn't capture that just now."),
  });

  const btnClass =
    "grid h-5 w-5 place-items-center rounded text-xs text-muted-foreground/60 transition-colors duration-150 hover:bg-secondary/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

  return (
    <span className="ml-1 inline-flex items-center gap-0.5">
      <button
        type="button"
        title="Remember this"
        aria-label="Remember this"
        disabled={mRemember.isPending || mRemember.isSuccess}
        onClick={() => mRemember.mutate()}
        className={btnClass}
      >
        <Brain className="h-3 w-3" />
      </button>
      <button
        type="button"
        title="Capture as decision"
        aria-label="Capture as decision"
        disabled={mDecide.isPending || mDecide.isSuccess}
        onClick={() => mDecide.mutate()}
        className={btnClass}
      >
        <Gavel className="h-3 w-3" />
      </button>
    </span>
  );
}

function MessageBubble({
  role,
  content,
  missionId,
  meta,
  error,
  feedbackId,
  streaming,
  statuses,
  question,
  conversationId,
}: {
  role: string;
  content: string;
  missionId?: string | null;
  meta?: ChatMeta | null;
  error?: boolean;
  feedbackId?: string | null;
  streaming?: boolean;
  /** Live research-progress events — only rendered on the streaming bubble. */
  statuses?: ResearchStatus[];
  /** Preceding user question — becomes the title for the brain actions. */
  question?: string | null;
  conversationId?: string | null;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end animate-in fade-in slide-in-from-bottom-1 duration-200">
        <div className="max-w-[75%] rounded-2xl bg-secondary/60 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div data-message-root className="flex gap-3 animate-in fade-in duration-200">
      <div className="h-7 w-7 rounded-lg relative overflow-hidden shrink-0 ring-glow-violet">
        <div className="absolute inset-0 neural-gradient" />
      </div>
      <div className="flex-1 min-w-0 space-y-3 pt-0.5">
        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-coral-soft bg-coral/5 px-3.5 py-2.5 text-sm text-ink-muted">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-coral" />
            <span>{content}</span>
          </div>
        ) : (
          <>
            {streaming && statuses && statuses.length > 0 && (
              <ResearchActivityLine statuses={statuses} />
            )}
            {meta && !streaming && <ResearchSummaryRow meta={meta} />}
            {content && (
              <div>
                <ChatMarkdown content={content} citations={meta?.sources.map((s) => s.n)} />
                {streaming && <StreamingCaret />}
              </div>
            )}
            {!content && streaming && (!statuses || statuses.length === 0) && <StreamingCaret />}
            {missionId && <InlineMissionProgress missionId={missionId} />}
            {meta && !streaming && (
              <MessageMetaFooter
                meta={meta}
                feedbackId={feedbackId}
                actions={
                  <BrainMessageActions
                    question={question}
                    answer={content}
                    conversationId={conversationId}
                  />
                }
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
