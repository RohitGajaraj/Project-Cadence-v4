import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
const Editor = lazy(() => import("@monaco-editor/react").then((m) => ({ default: m.default })));
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Play, Save, Sparkles, Trash2, Plus, Globe, Copy, Loader2, FileCode,
  Paperclip, Brain, Code2, Repeat, Send, Check, X, FileText, Lightbulb, Calendar, ListTodo, Gavel,
} from "lucide-react";
import {
  getPrototype, saveFile, deleteFile, togglePublic,
  listMessages, applyChanges, listContextItems, recordAttachment,
} from "@/lib/studio.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/studio/$id")({ component: StudioEditor });

type FileRow = { id?: string; path: string; content: string; language: string };
type ContextRef = { kind: "prd" | "opportunity" | "decision" | "meeting" | "task"; id: string; title: string };
type AttachmentRef = { id: string; name: string; kind: string };
type ChangeItem = { path: string; content: string; action?: string };
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  changes_json: ChangeItem[];
  applied: boolean;
  created_at: string;
};

function buildSrcDoc(files: FileRow[], entry: string): string {
  const html = files.find((f) => f.path === entry) ?? files.find((f) => f.path.endsWith(".html"));
  if (!html) return "<html><body><p>No HTML file</p></body></html>";
  let out = html.content;
  out = out.replace(/<link[^>]*href=["']([^"']+\.css)["'][^>]*>/g, (_m, href) => {
    const css = files.find((f) => f.path === href);
    return css ? `<style>${css.content}</style>` : _m;
  });
  out = out.replace(/<script[^>]*src=["']([^"']+\.js)["'][^>]*><\/script>/g, (_m, src) => {
    const js = files.find((f) => f.path === src);
    return js ? `<script>\n${js.content}\n</script>` : _m;
  });
  return out;
}

function StudioEditor() {
  const { id } = Route.useParams();
  const getProto = useServerFn(getPrototype);
  const fProjects = useServerFn(listProjects);
  const saveFn = useServerFn(saveFile);
  const delFn = useServerFn(deleteFile);
  const toggleFn = useServerFn(togglePublic);
  const msgsFn = useServerFn(listMessages);
  const applyFn = useServerFn(applyChanges);
  const ctxFn = useServerFn(listContextItems);
  const recordAttFn = useServerFn(recordAttachment);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["prototype", id],
    queryFn: () => getProto({ data: { id } }),
  });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const msgs = useQuery({
    queryKey: ["prototype-messages", id],
    queryFn: () => msgsFn({ data: { prototype_id: id } }),
  });
  const ctxItems = useQuery({ queryKey: ["studio-context"], queryFn: () => ctxFn() });

  const [active, setActive] = useState<string>("index.html");
  const [buffers, setBuffers] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [srcDoc, setSrcDoc] = useState<string>("");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [pickedCtx, setPickedCtx] = useState<ContextRef[]>([]);
  const [pickedAtts, setPickedAtts] = useState<AttachmentRef[]>([]);
  const [coworkOn, setCoworkOn] = useState(false);
  const [coworkTurn, setCoworkTurn] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data) return;
    const init: Record<string, string> = {};
    for (const f of data.files) init[f.path] = f.content;
    setBuffers(init);
    setDirty(new Set());
    if (!data.files.find((f) => f.path === active) && data.files[0]) setActive(data.files[0].path);
    setSrcDoc(buildSrcDoc(data.files, data.prototype.entry_path ?? "index.html"));
  }, [data]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.data?.messages.length, streamText]);

  const files: FileRow[] = useMemo(
    () => (data?.files ?? []).map((f) => ({ ...f, content: buffers[f.path] ?? f.content })),
    [data, buffers],
  );

  function onChange(value: string | undefined) {
    if (value == null) return;
    setBuffers((b) => ({ ...b, [active]: value }));
    setDirty((d) => new Set(d).add(active));
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const paths = Array.from(dirty);
      for (const p of paths) {
        const f = data?.files.find((x) => x.path === p);
        await saveFn({ data: { prototype_id: id, path: p, content: buffers[p] ?? "", language: f?.language } });
      }
      return paths.length;
    },
    onSuccess: (n) => { setDirty(new Set()); qc.invalidateQueries({ queryKey: ["prototype", id] }); toast.success(`Saved ${n} file${n === 1 ? "" : "s"}`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (path: string) => delFn({ data: { prototype_id: id, path } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prototype", id] }); toast.success("File deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyMut = useMutation({
    mutationFn: (message_id: string) => applyFn({ data: { message_id, prototype_id: id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["prototype", id] });
      await qc.invalidateQueries({ queryKey: ["prototype-messages", id] });
      toast.success("Applied changes");
      if (coworkOn && coworkTurn < 5) {
        setTimeout(() => sendMessage("Review the current preview against my latest goal. Critique and propose the next iteration. If the goal is met, say so and propose no changes."), 600);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (v: boolean) => toggleFn({ data: { id, is_public: v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prototype", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function run() {
    setSrcDoc(buildSrcDoc(files, data?.prototype.entry_path ?? "index.html"));
  }

  function addFile() {
    const name = newFileName.trim();
    if (!name) return;
    if (buffers[name] != null) { toast.error("File already exists"); return; }
    setBuffers((b) => ({ ...b, [name]: "" }));
    setDirty((d) => new Set(d).add(name));
    setActive(name);
    setNewFileName("");
    setNewFileOpen(false);
  }

  function copyShare() {
    if (!data?.prototype.share_slug) return;
    const url = `${window.location.origin}/p/${data.prototype.share_slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied");
  }

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5_000_000) { toast.error("Max 5 MB"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Sign in"); return; }
    const path = `${u.user.id}/${id}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("studio-attachments").upload(path, file);
    if (up.error) { toast.error(up.error.message); return; }
    let extracted = "";
    let kind: "text" | "image" | "pdf" | "other" = "other";
    if (file.type.startsWith("image/")) kind = "image";
    else if (file.type === "application/pdf") kind = "pdf";
    else if (/\.(md|txt|json|csv|tsv|html|css|js|ts|tsx|jsx)$/i.test(file.name) || file.type.startsWith("text/")) {
      kind = "text";
      extracted = (await file.text()).slice(0, 100_000);
    }
    const r = await recordAttFn({ data: {
      prototype_id: id, name: file.name, kind, storage_path: path,
      size_bytes: file.size, extracted_text: extracted || undefined,
    } });
    if (r.attachment) {
      setPickedAtts((p) => [...p, { id: r.attachment.id, name: file.name, kind }]);
      toast.success(`Attached ${file.name}`);
    }
  }

  async function sendMessage(text: string) {
    const content = text.trim();
    if (!content || streaming || !data) return;
    setStreaming(true);
    setStreamText("");
    const refs = pickedCtx.map((r) => ({ kind: r.kind, id: r.id }));
    const attIds = pickedAtts.map((a) => a.id);
    setInput("");
    try {
      const sess = await supabase.auth.getSession();
      const token = sess.data.session?.access_token;
      const res = await fetch("/api/studio-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          prototype_id: id, content, context_refs: refs, attachment_ids: attIds,
          cowork_turn: coworkOn ? coworkTurn : 0,
        }),
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        toast.error(`Chat error: ${res.status} ${t.slice(0, 120)}`);
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let done = false;
      while (!done) {
        const r = await reader.read();
        if (r.done) break;
        buf += decoder.decode(r.value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(payload);
            const piece: string | undefined = parsed.choices?.[0]?.delta?.content;
            if (piece) { acc += piece; setStreamText(acc); }
          } catch { /* partial */ }
        }
      }
      if (coworkOn) setCoworkTurn((n) => n + 1);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStreaming(false);
      setStreamText("");
      setPickedCtx([]);
      setPickedAtts([]);
      await qc.invalidateQueries({ queryKey: ["prototype-messages", id] });
    }
  }

  if (isLoading || !data) return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="p-10 text-sm text-muted-foreground">Loading editor…</div>
    </AppShell>
  );

  const proto = data.prototype;
  const allPaths = Array.from(new Set([...(data.files.map((f) => f.path)), ...Object.keys(buffers)])).sort();
  const currentLang = data.files.find((f) => f.path === active)?.language ?? (active.endsWith(".css") ? "css" : active.endsWith(".js") ? "javascript" : "html");
  const chat: ChatMessage[] = (msgs.data?.messages ?? []) as unknown as ChatMessage[];

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="h-[calc(100vh-1px)] flex flex-col">
        <header className="border-b hairline px-4 py-2.5 flex items-center gap-3 bg-background/60 backdrop-blur">
          <Link to="/studio" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs">
            <ArrowLeft className="h-4 w-4" /> Studio
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <div className="font-display text-base">{proto.name}</div>
          <div className="ml-auto flex items-center gap-2">
            <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
              <SheetTrigger asChild>
                <Button size="sm" variant="outline"><Code2 className="h-3.5 w-3.5 mr-1.5" /> Files</Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[90vw] sm:max-w-3xl p-0 flex flex-col">
                <SheetHeader className="px-4 py-3 border-b hairline"><SheetTitle>Files</SheetTitle></SheetHeader>
                <div className="flex-1 grid grid-cols-12 min-h-0">
                  <aside className="col-span-4 border-r hairline overflow-y-auto p-2">
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Files</div>
                      <button onClick={() => setNewFileOpen((v) => !v)} className="text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    {newFileOpen && (
                      <div className="px-2 pb-2 flex gap-1">
                        <Input value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder="path/file.js" className="h-7 text-xs" onKeyDown={(e) => e.key === "Enter" && addFile()} />
                        <Button size="sm" className="h-7 px-2" onClick={addFile}>Add</Button>
                      </div>
                    )}
                    {allPaths.map((p) => (
                      <div key={p} className={`group flex items-center gap-2 rounded px-2 py-1.5 text-xs cursor-pointer ${active === p ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`} onClick={() => setActive(p)}>
                        <FileCode className="h-3 w-3 shrink-0" />
                        <span className="truncate flex-1">{p}</span>
                        {dirty.has(p) && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                        {data.files.find((f) => f.path === p) && (
                          <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${p}?`)) delMut.mutate(p); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                        )}
                      </div>
                    ))}
                  </aside>
                  <section className="col-span-8 min-h-0 flex flex-col">
                    <div className="px-3 py-2 border-b hairline flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">{active}</div>
                      <Button size="sm" variant="outline" onClick={() => saveMut.mutate()} disabled={dirty.size === 0 || saveMut.isPending}>
                        {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1.5" /> Save{dirty.size > 0 ? ` (${dirty.size})` : ""}</>}
                      </Button>
                    </div>
                    <div className="flex-1 min-h-0">
                      <Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Loading editor…</div>}>
                        <Editor key={active} height="100%" theme="vs-dark" language={currentLang}
                          value={buffers[active] ?? ""} onChange={onChange}
                          options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: "on", scrollBeyondLastLine: false, automaticLayout: true }} />
                      </Suspense>
                    </div>
                  </section>
                </div>
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5" /> Public
              <Switch checked={proto.is_public} onCheckedChange={(v) => toggleMut.mutate(v)} />
            </div>
            {proto.is_public && (
              <Button size="sm" variant="outline" onClick={copyShare}><Copy className="h-3.5 w-3.5 mr-1.5" /> Share</Button>
            )}
            <Button size="sm" onClick={run}><Play className="h-3.5 w-3.5 mr-1.5" /> Run</Button>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-12 min-h-0">
          {/* Chat (primary) */}
          <section className="col-span-5 border-r hairline flex flex-col min-h-0 bg-background/40">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {chat.length === 0 && !streaming && (
                <div className="text-center py-12 space-y-3">
                  <Sparkles className="mx-auto h-6 w-6 text-violet-400" />
                  <div className="font-display text-lg">Build with chat</div>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Describe what you want. Attach a PRD or doc as context. The agent edits files for you.
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                    {[
                      "Make a SaaS pricing page with 3 tiers, dark theme",
                      "Turn this into a marketing landing page",
                      "Add a dark/light toggle that persists",
                    ].map((s) => (
                      <button key={s} onClick={() => setInput(s)}
                        className="text-[11px] px-2.5 py-1 rounded-full border hairline text-muted-foreground hover:text-foreground hover:border-primary/40">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chat.map((m) => (
                <MessageBubble key={m.id} msg={m}
                  onApply={() => applyMut.mutate(m.id)}
                  applying={applyMut.isPending && applyMut.variables === m.id}
                />
              ))}
              {streaming && (
                <div className="rounded-2xl border hairline bg-card/60 p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" /> Assistant <Loader2 className="h-3 w-3 animate-spin" />
                  </div>
                  <div className="prose prose-sm prose-invert max-w-none text-sm">
                    <ReactMarkdown>{streamText.replace(/<<<CHANGES_JSON>>>[\s\S]*$/, "")}</ReactMarkdown>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t hairline p-3 space-y-2 bg-background/60">
              {(pickedCtx.length > 0 || pickedAtts.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {pickedCtx.map((c) => (
                    <Badge key={`c-${c.id}`} variant="secondary" className="gap-1 text-[10px]">
                      <Brain className="h-2.5 w-2.5" />{c.title}
                      <button onClick={() => setPickedCtx((p) => p.filter((x) => x.id !== c.id))}><X className="h-2.5 w-2.5 ml-0.5" /></button>
                    </Badge>
                  ))}
                  {pickedAtts.map((a) => (
                    <Badge key={`a-${a.id}`} variant="secondary" className="gap-1 text-[10px]">
                      <Paperclip className="h-2.5 w-2.5" />{a.name}
                      <button onClick={() => setPickedAtts((p) => p.filter((x) => x.id !== a.id))}><X className="h-2.5 w-2.5 ml-0.5" /></button>
                    </Badge>
                  ))}
                </div>
              )}
              <Textarea rows={3} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendMessage(input); }
                }}
                placeholder="Ask, attach a PRD, or paste a URL…  (⌘↵ to send)"
                className="text-sm resize-none" />
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" hidden onChange={handleAttach}
                  accept=".md,.txt,.json,.csv,.html,.css,.js,.ts,.tsx,.jsx,.pdf,image/*" />
                <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-3.5 w-3.5" />
                </Button>
                <ContextPicker items={ctxItems.data} picked={pickedCtx} setPicked={setPickedCtx} />
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground ml-1">
                  <Repeat className="h-3 w-3" />
                  <span>Co-work</span>
                  <Switch checked={coworkOn} onCheckedChange={(v) => { setCoworkOn(v); setCoworkTurn(0); }} />
                  {coworkOn && <span className="text-[10px]">({coworkTurn}/5)</span>}
                </div>
                <Button size="sm" className="ml-auto" disabled={!input.trim() || streaming}
                  onClick={() => sendMessage(input)}>
                  {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3.5 w-3.5 mr-1.5" /> Send</>}
                </Button>
              </div>
            </div>
          </section>

          {/* Preview + tabs */}
          <section className="col-span-7 flex flex-col min-h-0">
            <Tabs defaultValue="preview" className="flex-1 flex flex-col min-h-0">
              <TabsList className="m-2">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="flex-1 min-h-0 m-0">
                <iframe ref={iframeRef} title="Preview" sandbox="allow-scripts allow-forms allow-modals"
                  srcDoc={srcDoc || "<html><body style='font-family:ui-sans-serif;color:#888;padding:40px;background:#0b0b12;'><p>Click <strong>Run</strong> to preview.</p></body></html>"}
                  className="w-full h-full bg-white" />
              </TabsContent>
              <TabsContent value="files" className="flex-1 m-0 overflow-y-auto p-4">
                <div className="space-y-1">
                  {allPaths.map((p) => (
                    <button key={p} onClick={() => { setActive(p); setEditorOpen(true); }}
                      className="w-full text-left flex items-center gap-2 rounded-lg border hairline px-3 py-2 text-xs hover:border-primary/40">
                      <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1">{p}</span>
                      {dirty.has(p) && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </button>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="history" className="flex-1 m-0 overflow-y-auto p-4 space-y-2">
                {chat.filter((m) => m.changes_json?.length > 0).map((m) => (
                  <div key={m.id} className="rounded-lg border hairline p-3 text-xs">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                      {m.applied && <Badge variant="secondary" className="text-[10px]">Applied</Badge>}
                    </div>
                    <div className="text-muted-foreground line-clamp-2">{m.content.slice(0, 200)}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1">{m.changes_json.length} file(s)</div>
                  </div>
                ))}
                {chat.filter((m) => m.changes_json?.length > 0).length === 0 && (
                  <div className="text-xs text-muted-foreground">No edits yet.</div>
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function MessageBubble({ msg, onApply, applying }: { msg: ChatMessage; onApply: () => void; applying: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div className={`rounded-2xl border hairline p-3 ${isUser ? "bg-secondary/30" : "bg-card/60"}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {isUser ? "You" : <><Sparkles className="h-3 w-3" /> Assistant</>}
      </div>
      <div className="prose prose-sm prose-invert max-w-none text-sm">
        <ReactMarkdown>{msg.content}</ReactMarkdown>
      </div>
      {msg.changes_json?.length > 0 && (
        <div className="mt-3 rounded-lg border hairline bg-background/40 p-2.5 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Proposed changes ({msg.changes_json.length})</span>
            {msg.applied ? (
              <Badge variant="secondary" className="text-[10px] gap-1"><Check className="h-2.5 w-2.5" />Applied</Badge>
            ) : (
              <Button size="sm" className="h-6 text-[11px]" onClick={onApply} disabled={applying}>
                {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply all"}
              </Button>
            )}
          </div>
          {msg.changes_json.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                c.action === "delete" ? "bg-destructive/20 text-destructive" :
                c.action === "create" ? "bg-emerald-500/20 text-emerald-400" :
                "bg-primary/20 text-primary"}`}>{c.action ?? "update"}</span>
              <FileCode className="h-3 w-3 text-muted-foreground" />
              <span className="truncate">{c.path}</span>
              <span className="ml-auto text-muted-foreground/60">{(c.content?.length ?? 0).toLocaleString()} ch</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContextPicker({ items, picked, setPicked }: {
  items: Awaited<ReturnType<typeof listContextItems>> | undefined;
  picked: ContextRef[];
  setPicked: React.Dispatch<React.SetStateAction<ContextRef[]>>;
}) {
  const [open, setOpen] = useState(false);
  function add(kind: ContextRef["kind"], id: string, title: string) {
    if (picked.find((p) => p.id === id)) return;
    setPicked((p) => [...p, { kind, id, title }]);
  }
  const groups: { label: string; icon: typeof FileText; kind: ContextRef["kind"]; rows: { id: string; title: string }[] }[] = [
    { label: "PRDs", icon: FileText, kind: "prd", rows: items?.prds ?? [] },
    { label: "Opportunities", icon: Lightbulb, kind: "opportunity", rows: items?.opportunities ?? [] },
    { label: "Decisions", icon: Gavel, kind: "decision", rows: items?.decisions ?? [] },
    { label: "Meetings", icon: Calendar, kind: "meeting", rows: items?.meetings ?? [] },
    { label: "Tasks", icon: ListTodo, kind: "task", rows: items?.tasks ?? [] },
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs">
          <Brain className="h-3.5 w-3.5" /> Context
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0 max-h-96 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.label} className="border-b hairline last:border-0">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-1.5">
              <g.icon className="h-3 w-3" /> {g.label}
            </div>
            {g.rows.length === 0 && <div className="px-3 pb-2 text-[11px] text-muted-foreground/60">None</div>}
            {g.rows.slice(0, 12).map((r) => (
              <button key={r.id} onClick={() => add(g.kind, r.id, r.title)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary/60 truncate">
                {r.title}
              </button>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}