// Brain (Chat) — screen 3/10 of the Ember Editorial migration, ported 1:1 from
// design-reference/cadence/chat.jsx: threads rail (224px), the shared AI
// message contract (Bubble + AiContract footer), the Inline Mission Cockpit,
// and the consequence-first governance gate. Production functionality rides
// the reference layout: SSE streaming, model switching, research activity,
// brain actions, live approvals.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Brain,
  Gavel,
  ShieldAlert,
  Square,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { CadenceMark, MonoLabel, StepDot, StatusBadge } from "@/components/cadence/Primitives";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import {
  MessageMetaFooter,
  parseChatMeta,
  pickFeedbackId,
  type ChatMeta,
} from "@/components/chat/MessageMeta";
import { ModelSwitcher } from "@/components/chat/ModelSwitcher";
import { MODELS } from "@/lib/ai/models";
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
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
  head: () => ({ meta: [{ title: "Cadence" }] }),
});

type Msg = {
  id: string;
  role: string;
  content: string;
  mission_id?: string | null;
  meta?: ChatMeta | null;
  error?: boolean;
  /** Client-measured time to first token (live-streamed replies only). */
  ttftMs?: number | null;
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
  const { activeWorkspace } = useWorkspace();

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

  // Chat authorship contract: user = ember-ringed initials chip (right).
  const [userName, setUserName] = useState("Account");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const name =
        (u?.user_metadata as { display_name?: string } | undefined)?.display_name ??
        u?.email?.split("@")[0] ??
        "Account";
      setUserName(name);
    });
  }, []);
  const userInitials = userName
    .split(/[\s._-]+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

  /** Sends `content`; `modelOverride` powers "Replay with…" without switching the picker. */
  async function sendMessage(content: string, modelOverride?: string) {
    if (!content || streaming) return;
    setStreaming(true);
    setLiveStatuses([]);
    pinnedRef.current = true;

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content };
    const assistantMsg: Msg = { id: `a-${Date.now()}`, role: "assistant", content: "" };
    setLiveMessages((prev) => [...prev, userMsg, assistantMsg]);

    const tStart = performance.now();
    let ttft: number | null = null;

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
        body: JSON.stringify({
          conversationId: convId,
          content,
          model: modelOverride ?? model,
        }),
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
                next[next.length - 1] = { ...next[next.length - 1], meta, ttftMs: ttft };
                return next;
              });
              continue;
            }
            const piece: string | undefined = parsed.choices?.[0]?.delta?.content;
            const missionId: string | undefined = parsed.choices?.[0]?.delta?.mission_id;
            if (piece || missionId) {
              if (piece) {
                if (ttft === null) ttft = performance.now() - tStart;
                acc += piece;
              }
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

  function send() {
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    void sendMessage(content);
  }

  /** "Replay with…" — re-asks the question with the chosen model in this thread. */
  function replayWith(modelId: string, question: string) {
    const label = MODELS.find((m) => m.id === modelId)?.label ?? modelId;
    toast(`Replaying with ${label}. The reply lands in this thread.`);
    void sendMessage(question, modelId);
  }

  const isEmpty = liveMessages.length === 0;
  const activeTitle = active.data?.conversation?.title ?? null;

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <TopBar
        crumbs={[
          activeWorkspace?.name ?? "Workspace",
          "Ask",
          ...(activeTitle ? [activeTitle] : []),
        ]}
        actions={<BrainStatusButton />}
      />
      <div data-screen-label="Chat" style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Threads rail — reference: 224px, hairline right, mono header + ghost plus. */}
        <div
          className="scrollbar-thin"
          style={{
            width: 224,
            flexShrink: 0,
            borderRight: "1px solid var(--hairline)",
            padding: "18px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0 8px 10px",
            }}
          >
            <MonoLabel>Threads</MonoLabel>
            <button
              aria-label="New thread"
              className="btn btn-ghost"
              style={{ padding: "3px 7px" }}
              onClick={() => {
                abortRef.current?.abort();
                mNew.mutate();
              }}
            >
              <Plus size={12} />
            </button>
          </div>
          {convs.isLoading && (
            <div style={{ padding: "8px 10px", fontSize: 12.5, color: "var(--ink-faint)" }}>
              Loading…
            </div>
          )}
          {(convs.data?.conversations ?? []).map((c) => {
            const isActive = activeId === c.id;
            const when = (c as { updated_at?: string }).updated_at;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  abortRef.current?.abort();
                  setActiveId(c.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    abortRef.current?.abort();
                    setActiveId(c.id);
                  }
                }}
                className="group cursor-pointer"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  padding: "8px 10px",
                  borderRadius: 8,
                  textAlign: "left",
                  background: isActive ? "var(--surface-2)" : "transparent",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 13,
                      fontWeight: isActive ? 550 : 400,
                      color: isActive ? "var(--ink)" : "var(--ink-muted)",
                    }}
                  >
                    {c.title}
                  </span>
                  <button
                    aria-label="Delete thread"
                    className="opacity-0 group-hover:opacity-100 transition"
                    style={{ color: "var(--ink-faint)", flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      mDel.mutate(c.id);
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
                <span className="mono-label" style={{ fontSize: 9 }}>
                  {when ? relativeAgo(when) : ""}
                </span>
              </div>
            );
          })}
          {convs.data?.conversations.length === 0 && (
            <div style={{ padding: "8px 10px", fontSize: 12.5, color: "var(--ink-faint)" }}>
              No threads yet.
            </div>
          )}
        </div>

        {/* Conversation */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div
            ref={scrollRef}
            onScroll={() => {
              const el = scrollRef.current;
              if (!el) return;
              pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            className="scrollbar-thin"
            style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}
          >
            <div
              style={{
                maxWidth: 720,
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: 22,
              }}
            >
              {isEmpty ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-faint)" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      marginBottom: 12,
                      color: "var(--ink-subtle)",
                    }}
                  >
                    <CadenceMark size={34} />
                  </div>
                  <p style={{ fontSize: 13 }}>
                    Fresh thread. Hand me a goal and I'll dispatch a mission.
                  </p>
                  {/* Production addition: seeded prompts (quiet, hairline). */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      marginTop: 24,
                      textAlign: "left",
                    }}
                  >
                    {[
                      "What is the weather in Munich?",
                      "What am I building next — how does the roadmap look?",
                      "Compare our opportunity queue against what competitors shipped this month",
                      "Draft a stakeholder update from this week's decisions",
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="lift"
                        style={{
                          border: "1px solid var(--hairline)",
                          borderRadius: 10,
                          padding: "10px 12px",
                          fontSize: 12.5,
                          color: "var(--ink-muted)",
                          textAlign: "left",
                          background: "transparent",
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                liveMessages.map((m, i) => (
                  <MessageBubble
                    key={m.id}
                    role={m.role}
                    content={m.content}
                    missionId={m.mission_id}
                    meta={m.meta}
                    error={m.error}
                    ttftMs={m.ttftMs}
                    feedbackId={pickFeedbackId(m.id, activeId)}
                    streaming={streaming && m === liveMessages[liveMessages.length - 1]}
                    statuses={liveStatuses}
                    userInitials={userInitials}
                    userName={userName}
                    question={
                      liveMessages
                        .slice(0, i)
                        .reverse()
                        .find((p) => p.role === "user")?.content ?? null
                    }
                    conversationId={activeId}
                    onReplay={replayWith}
                  />
                ))
              )}
            </div>
          </div>

          {/* Composer — reference: hairline 14px ring on canvas, ArrowUp send. */}
          <div style={{ padding: "0 32px 22px" }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              style={{ maxWidth: 720, margin: "0 auto" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                  border: "1px solid var(--hairline)",
                  borderRadius: 14,
                  background: "var(--canvas)",
                  padding: "10px 10px 10px 16px",
                  boxShadow: "0 1px 3px oklch(0.2 0.02 60 / 6%)",
                }}
              >
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  placeholder="Message Cadence…"
                  onChange={(e) => {
                    setInput(e.target.value);
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  style={{
                    flex: 1,
                    border: 0,
                    outline: "none",
                    background: "transparent",
                    resize: "none",
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    maxHeight: 120,
                  }}
                />
                {/* Production addition: model switching lives in the composer. */}
                <ModelSwitcher value={model} onChange={setModel} />
                {streaming ? (
                  <button
                    type="button"
                    onClick={stopStreaming}
                    aria-label="Stop generating"
                    className="btn btn-ghost"
                    style={{ borderRadius: 10, padding: "7px 9px" }}
                  >
                    <Square size={14} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    aria-label="Send"
                    className="btn btn-primary"
                    style={{ borderRadius: 10, padding: "7px 9px" }}
                  >
                    <ArrowUp size={14} />
                  </button>
                )}
              </div>
              <div
                className="mono-label"
                style={{ fontSize: 9, marginTop: 6, textAlign: "center" }}
              >
                Enter to send · goals become missions · gates always come back to you
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/** Production step statuses → the reference's StepDot vocabulary. */
function stepDotStatus(s?: string): string {
  if (s === "dispatched" || s === "running") return "running";
  if (s === "completed" || s === "done") return "completed";
  if (s === "failed") return "failed";
  return "planned";
}

/** Production hop/mission statuses → the reference's StatusBadge vocabulary. */
function badgeStatus(s?: string): string {
  if (s === "dispatched") return "running";
  if (s === "done") return "completed";
  return s ?? "planned";
}

/* Inline governance gate — consequence-first controls, ported from the
   reference GatePanel. Production approvals carry tool_name + rationale (no
   per-approval consequence copy), so the labels state the generic consequence. */
function InlineApprovalsPanel({
  traceId,
  agentName,
  onResolved,
}: {
  traceId: string;
  agentName?: string | null;
  onResolved: () => void;
}) {
  const fDecide = useServerFn(decideApproval);

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
            ? "Approved. The tool ran and the mission resumed."
            : "Approved. The mission resumes."
          : "Rejected. Nothing ran.",
      );
      refetch();
      onResolved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!pendingApprovals || pendingApprovals.length === 0) return null;

  return (
    <div
      className="fade-up"
      style={{
        padding: "14px 16px",
        borderRadius: 10,
        background: "color-mix(in oklab, var(--ember) 9%, transparent)",
        border: "1px solid color-mix(in oklab, var(--ember) 35%, transparent)",
      }}
    >
      <div
        className="mono-label"
        style={{
          color: "var(--ember)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 700,
        }}
      >
        <ShieldAlert size={13} /> Action required · governance gate
      </div>
      {pendingApprovals.map((appr) => (
        <div key={appr.id}>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-muted)",
              margin: "6px 0 12px",
              lineHeight: 1.5,
            }}
          >
            {agentName ?? "The agent"} wants{" "}
            <span
              className="mono-label"
              style={{ color: "var(--agent)", fontSize: 10.5, display: "inline-flex" }}
            >
              {appr.tool_name}
            </span>
            {appr.rationale ? `. ${appr.rationale}` : "."}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-approve"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: appr.id, decision: "approve" })}
            >
              <Check size={12} />
              Approve · runs the tool
            </button>
            <button
              className="btn btn-reject"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: appr.id, decision: "reject" })}
            >
              <X size={12} />
              Reject · nothing runs
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Inline Mission Cockpit — the contract from the reference MissionCockpit:
   header, numbered specialist steps with live dots, inline gate when pending,
   raw trace toggle, mission link. `.ai-glow` while the mission is working. */
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

  const [showTrace, setShowTrace] = useState(false);

  if (m.isLoading || steps.isLoading) {
    return (
      <div
        style={{
          borderRadius: 12,
          border: "1px solid var(--hairline)",
          background: "color-mix(in oklab, var(--soft-stone) 45%, transparent)",
          padding: 16,
          maxWidth: 620,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12.5,
          color: "var(--ink-faint)",
        }}
      >
        <span className="spinner" />
        Initializing mission cockpit…
      </div>
    );
  }

  const mission = m.data?.mission;
  const planSteps = steps.data?.steps ?? [];
  const activeHop = m.data?.hops.find((h) => ["running", "queued"].includes(h.status));
  const activeTraceId = activeHop?.trace_id;
  const working = mission?.status === "running" || mission?.status === "awaiting_review";

  return (
    <div
      className={working ? "ai-glow" : undefined}
      style={{
        borderRadius: 12,
        border: "1px solid var(--hairline)",
        background: "color-mix(in oklab, var(--soft-stone) 45%, transparent)",
        padding: 16,
        maxWidth: 620,
        transition: "box-shadow var(--dur-slow)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          borderBottom: "1px solid var(--hairline)",
          paddingBottom: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <span className="mono-label" style={{ fontSize: 9.5 }}>
            Mission cockpit
          </span>
          <h4
            className="font-display"
            style={{
              fontSize: 16,
              marginTop: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {mission?.title}
          </h4>
        </div>
        <StatusBadge status={badgeStatus(mission?.status)} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0" }}>
        {planSteps.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--ink-faint)", fontStyle: "italic" }}>
            Planning stages…
          </div>
        ) : (
          planSteps.map((s, i) => (
            <div
              key={s.id}
              className="fade-up"
              style={{ display: "flex", alignItems: "baseline", gap: 9, fontSize: 12.5 }}
            >
              <span
                className="mono-label tabular-nums"
                style={{ fontSize: 10, width: 14, textAlign: "right", flexShrink: 0 }}
              >
                {i + 1}.
              </span>
              <StepDot status={stepDotStatus(s.status)} />
              <span
                className="mono-label"
                style={{ color: "var(--agent)", fontSize: 10.5, flexShrink: 0 }}
              >
                {s.agent_slug}
              </span>
              <span
                style={{
                  color: "var(--ink-subtle)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.sub_goal}
              </span>
            </div>
          ))
        )}
      </div>

      {activeTraceId && (
        <InlineApprovalsPanel
          traceId={activeTraceId}
          agentName={activeHop?.agent_name}
          onResolved={() => {
            qc.invalidateQueries({ queryKey: ["chat-mission", missionId] });
            qc.invalidateQueries({ queryKey: ["chat-mission-steps", missionId] });
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 10,
          marginTop: 10,
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <button
          onClick={() => setShowTrace(!showTrace)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--action-blue)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {showTrace ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {showTrace ? "Hide raw trace" : "Show raw trace"}
        </button>
        <Link
          to="/missions/$missionId"
          params={{ missionId }}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--action-blue)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          Open mission page
          <ExternalLink size={11} />
        </Link>
      </div>

      {showTrace && (
        <div
          className="fade-up scrollbar-thin"
          style={{
            marginTop: 10,
            padding: 12,
            background: "var(--canvas)",
            border: "1px solid var(--hairline)",
            borderRadius: 10,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          <div
            className="mono-label"
            style={{
              fontSize: 9.5,
              display: "flex",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--hairline)",
              paddingBottom: 5,
              marginBottom: 8,
            }}
          >
            <span>Execution hops</span>
            <span>{m.data?.hops.length ?? 0} hops</span>
          </div>
          {m.data?.hops.map((h) => (
            <div
              key={h.run_id}
              style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, marginBottom: 10 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: "var(--agent)", fontWeight: 600 }}>
                  {h.agent_name} ({h.agent_slug})
                </span>
                <StatusBadge status={badgeStatus(h.status)} />
              </div>
              {h.steps.length === 0 ? (
                <div style={{ paddingLeft: 12, color: "var(--ink-faint)", fontStyle: "italic" }}>
                  No active steps logged
                </div>
              ) : (
                h.steps.map((st, j) => (
                  <div
                    key={j}
                    style={{ paddingLeft: 12, color: "var(--ink-subtle)", lineHeight: 1.7 }}
                  >
                    ·{" "}
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

/** Compact relative-time label, e.g. "2h". */
function relativeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return "now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * F-BRAIN status — "what the brain knows": counts by kind + freshness, in a
 * quiet popover off the topbar. Errors render nothing (best-effort).
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
          className="btn btn-ghost"
          style={{ padding: "4px 7px" }}
        >
          <Brain size={13} strokeWidth={1.75} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-auto max-w-xs border-hairline"
        style={{ background: "var(--canvas)", borderRadius: 10, padding: "10px 14px" }}
      >
        {s ? (
          <div style={{ fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.6 }}>
            <div>
              The brain knows · {s.counts.signals} signals · {s.counts.docs} docs ·{" "}
              {s.counts.meetings} meetings · {s.counts.decisions} decisions · {s.counts.prds} PRDs ·{" "}
              {s.counts.findings} findings
            </div>
            <div className="mono-label" style={{ fontSize: 9, marginTop: 4 }}>
              {s.latest ? `updated ${relativeAgo(s.latest)} ago` : "nothing captured yet"}
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/**
 * F-BRAIN message actions — quiet mono icon buttons in the assistant footer:
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

  return (
    <>
      <button
        type="button"
        title="Remember this"
        aria-label="Remember this"
        disabled={mRemember.isPending || mRemember.isSuccess}
        onClick={() => mRemember.mutate()}
        className="inline-flex items-center disabled:pointer-events-none disabled:opacity-40"
        style={{ color: "var(--ink-faint)" }}
      >
        <Brain size={11} />
      </button>
      <button
        type="button"
        title="Capture as decision"
        aria-label="Capture as decision"
        disabled={mDecide.isPending || mDecide.isSuccess}
        onClick={() => mDecide.mutate()}
        className="inline-flex items-center disabled:pointer-events-none disabled:opacity-40"
        style={{ color: "var(--ink-faint)" }}
      >
        <Gavel size={11} />
      </button>
    </>
  );
}

/* Bubble — the reference chat authorship contract: user = ember-ringed
   initials chip on the right; AI = the Butterfly. Legible at a glance. */
function MessageBubble({
  role,
  content,
  missionId,
  meta,
  error,
  ttftMs,
  feedbackId,
  streaming,
  statuses,
  userInitials,
  userName,
  question,
  conversationId,
  onReplay,
}: {
  role: string;
  content: string;
  missionId?: string | null;
  meta?: ChatMeta | null;
  error?: boolean;
  ttftMs?: number | null;
  feedbackId?: string | null;
  streaming?: boolean;
  /** Live research-progress events — only rendered on the streaming bubble. */
  statuses?: ResearchStatus[];
  userInitials: string;
  userName: string;
  /** Preceding user question — becomes the title for the brain actions. */
  question?: string | null;
  conversationId?: string | null;
  onReplay?: (modelId: string, question: string) => void;
}) {
  if (role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <div
          style={{
            background: "var(--soft-stone)",
            borderRadius: "14px 14px 4px 14px",
            padding: "10px 16px",
            fontSize: 13.5,
            maxWidth: 480,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {content}
        </div>
        <span
          aria-hidden="true"
          title={userName}
          className="fade-up"
          style={{
            width: 26,
            height: 26,
            flexShrink: 0,
            marginTop: 2,
            borderRadius: "50% 50% 4px 50%",
            background: "var(--primary-ink)",
            color: "var(--canvas)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.04em",
            boxShadow: "0 0 0 2px color-mix(in oklab, var(--ember) 30%, transparent)",
          }}
        >
          {userInitials}
        </span>
      </div>
    );
  }

  return (
    <div data-message-root style={{ display: "flex", gap: 12 }}>
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          marginTop: 2,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CadenceMark size={24} />
      </span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--ink)" }}>
        {error ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              padding: "10px 14px",
              borderRadius: 10,
              background: "color-mix(in oklab, var(--rose) 7%, transparent)",
              border: "1px solid color-mix(in oklab, var(--rose) 30%, transparent)",
              fontSize: 12.5,
              color: "var(--ink-muted)",
            }}
          >
            <AlertCircle size={14} style={{ color: "var(--rose)", flexShrink: 0, marginTop: 1 }} />
            <span>{content}</span>
          </div>
        ) : (
          <>
            {streaming && statuses && statuses.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <ResearchActivityLine statuses={statuses} />
              </div>
            )}
            {meta && !streaming && (
              <div style={{ marginBottom: 8 }}>
                <ResearchSummaryRow meta={meta} />
              </div>
            )}
            {content && (
              <div>
                <ChatMarkdown content={content} citations={meta?.sources.map((s) => s.n)} />
                {streaming && <span className="stream-caret">▍</span>}
              </div>
            )}
            {!content && streaming && (!statuses || statuses.length === 0) && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--ink-faint)",
                  fontSize: 12.5,
                }}
              >
                <span className="spinner" />
                thinking
              </span>
            )}
            {missionId && (
              <div style={{ margin: "12px 0" }} className="fade-up">
                <InlineMissionProgress missionId={missionId} />
              </div>
            )}
            {meta && !streaming && (
              <MessageMetaFooter
                meta={meta}
                feedbackId={feedbackId}
                ttftMs={ttftMs}
                onReplay={question && onReplay ? (id) => onReplay(id, question) : undefined}
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
