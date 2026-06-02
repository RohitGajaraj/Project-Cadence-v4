import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Plus, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/cadence/AppShell";
import {
  listConversations, getConversation, createConversation, deleteConversation,
} from "@/lib/conversations.functions";
import { listProjects } from "@/lib/projects.functions";
import { getProfile } from "@/lib/profile.functions";
import { MODELS } from "@/lib/ai/models";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
  head: () => ({ meta: [{ title: "Chat · Cadence" }] }),
});

type Msg = { id: string; role: string; content: string };

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
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Usage.");
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
            if (piece) {
              acc += piece;
              setLiveMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { ...next[next.length - 1], content: acc };
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
    (profile.data?.profile as { display_name?: string; full_name?: string } | null)?.display_name?.split(" ")[0] ||
    (profile.data?.profile as { full_name?: string } | null)?.full_name?.split(" ")[0] ||
    "there";

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="grid grid-cols-[260px,1fr] h-screen">
        {/* Conversation rail */}
        <aside className="border-r hairline bg-background/40 backdrop-blur-xl flex flex-col">
          <div className="p-3 border-b hairline">
            <button
              onClick={() => mNew.mutate()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-foreground text-background px-3 py-2 text-sm font-medium hover:opacity-90"
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
                  activeId === c.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
                onClick={() => setActiveId(c.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{c.title}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); mDel.mutate(c.id); }}
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
        <section className="flex flex-col h-screen relative">
          <header className="flex items-center justify-between gap-4 px-6 h-14 border-b hairline glass">
            <div className="text-sm text-muted-foreground truncate">
              {active.data?.conversation?.title ?? "New conversation"}
            </div>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="text-xs bg-background/60 border hairline rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
            >
              {MODELS.filter((m) => m.live).map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
              <optgroup label="— Bring your own key (coming) —">
                {MODELS.filter((m) => !m.live).map((m) => (
                  <option key={m.id} value={m.id} disabled>{m.label}</option>
                ))}
              </optgroup>
            </select>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
            {isEmpty ? (
              <div className="h-full grid place-items-center px-6">
                <div className="max-w-xl text-center">
                  <div className="mx-auto h-14 w-14 rounded-2xl ring-glow-violet relative overflow-hidden">
                    <div className="absolute inset-0 neural-gradient animate-aurora" />
                  </div>
                  <h1 className="mt-6 font-display text-3xl tracking-tight">
                    Hi <span className="neural-text">{firstName}</span>. How can I help?
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Ask anything about your products, tasks, or strategy. I'm grounded in your workspace.
                  </p>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-2 text-left">
                    {[
                      "Summarize today and tell me what to focus on",
                      "Draft a PRD outline for my top product",
                      "What's slipping across my open tasks?",
                      "Propose a 2-week sprint plan",
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="bento p-3 text-sm text-left text-muted-foreground hover:text-foreground transition"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
                {liveMessages.map((m) => (
                  <MessageBubble key={m.id} role={m.role} content={m.content} streaming={streaming && m === liveMessages[liveMessages.length - 1]} />
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t hairline glass">
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="max-w-3xl mx-auto p-4"
            >
              <div className="bento p-2 flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  rows={1}
                  placeholder="Message Cadence…   (Enter to send · Shift+Enter for newline)"
                  className="flex-1 bg-transparent px-3 py-2 text-sm outline-none resize-none max-h-40"
                />
                <button
                  type="submit"
                  disabled={streaming || !input.trim()}
                  className="h-9 w-9 grid place-items-center rounded-xl bg-foreground text-background disabled:opacity-40"
                >
                  {streaming ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground text-center">
                Grounded in your workspace · {MODELS.find((m) => m.id === model)?.label ?? model}
              </div>
            </form>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function MessageBubble({ role, content, streaming }: { role: string; content: string; streaming?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-lg relative overflow-hidden shrink-0 ring-glow-violet">
          <div className="absolute inset-0 neural-gradient" />
        </div>
      )}
      <div className={`${isUser ? "bento bg-secondary/60 max-w-[80%]" : "max-w-full"} px-4 py-3 rounded-2xl`}>
        {content ? (
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:mt-3 prose-pre:bg-background/60 prose-pre:border prose-pre:border-white/10">
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