import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Eye, Pencil, Save, Sparkles, Send, Github, Hammer } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { getPrd, savePrd, prdAssist } from "@/lib/discovery.functions";
import { listTasks } from "@/lib/tasks.functions";
import { listLinearTeams, createLinearIssuesFromTasks } from "@/lib/linear.functions";
import { runAgent } from "@/lib/agent_loop.functions";

export const Route = createFileRoute("/_authenticated/prds/$id")({
  component: PrdEditor,
  head: () => ({ meta: [{ title: "PRD · Cadence" }] }),
});

function PrdEditor() {
  const { id } = useParams({ from: "/_authenticated/prds/$id" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fProjects = useServerFn(listProjects);
  const fGet = useServerFn(getPrd);
  const mSave = useServerFn(savePrd);
  const mAssist = useServerFn(prdAssist);
  const fRunAgent = useServerFn(runAgent);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const prdQ = useQuery({ queryKey: ["prd", id], queryFn: () => fGet({ data: { id } }) });

  const fTasks = useServerFn(listTasks);
  const fTeams = useServerFn(listLinearTeams);
  const fPushLinear = useServerFn(createLinearIssuesFromTasks);
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => fTasks() });
  const teamsQ = useQuery({ queryKey: ["linear-teams"], queryFn: () => fTeams(), retry: false });
  const [teamId, setTeamId] = useState<string>("");

  const prdTasks = (tasksQ.data?.tasks ?? []).filter(
    (t: { prd_id: string | null }) => t.prd_id === id,
  );

  const pushLinear = useMutation({
    mutationFn: () =>
      fPushLinear({
        data: { teamId, taskIds: prdTasks.map((t: { id: string }) => t.id) },
      }),
    onSuccess: (r) => toast.success(`Created ${r.created.length} Linear issue(s)`),
    onError: (e: Error) => toast.error(e.message),
  });

  const sendToBuilder = useMutation({
    mutationFn: () => {
      const url = prdQ.data?.prd?.github_issue_url ?? "";
      const m = url.match(/\/issues\/(\d+)/);
      if (!m) throw new Error("PRD has no linked GitHub issue yet");
      const issueNumber = Number(m[1]);
      const prdTitle = prdQ.data?.prd?.title ?? "PRD";
      return fRunAgent({
        data: {
          agentSlug: "builder",
          goal: `Pick up GitHub issue #${issueNumber} ("${prdTitle}") on the connected repo. Read the issue body, then ship a single-file scoped PR via github.pr.open with idempotency_key="issue-${issueNumber}". Closes #${issueNumber}.`,
          asMission: true,
          missionTitle: `Build · ${prdTitle.slice(0, 60)} (#${issueNumber})`,
        },
      });
    },
    onSuccess: (r) => {
      toast.success("Builder mission dispatched");
      const missionId = (r as { mission_id?: string | null }).mission_id;
      if (missionId) navigate({ to: "/missions/$missionId", params: { missionId } });
      else navigate({ to: "/build" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (prdQ.data?.prd) {
      setTitle(prdQ.data.prd.title);
      setBody(prdQ.data.prd.body_md);
    }
  }, [prdQ.data?.prd?.id]);

  const save = useMutation({
    mutationFn: () => mSave({ data: { id, title, body_md: body } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prds"] }); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const assist = useMutation({
    mutationFn: (action: "rewrite" | "expand" | "critique" | "shorten") => {
      const ta = taRef.current;
      const sel = ta && ta.selectionStart !== ta.selectionEnd
        ? body.slice(ta.selectionStart, ta.selectionEnd)
        : body;
      if (!sel.trim()) throw new Error("Select some text first (or have content to work on)");
      return mAssist({ data: { action, selection: sel, context: body.slice(0, 4000) } });
    },
    onSuccess: (r) => {
      const ta = taRef.current;
      if (!ta) return;
      const start = ta.selectionStart, end = ta.selectionEnd;
      const next = start !== end
        ? body.slice(0, start) + r.text + body.slice(end)
        : body + "\n\n" + r.text;
      setBody(next);
      toast.success("AI applied");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (prdQ.isLoading) return <AppShell><div className="p-10 text-sm text-muted-foreground">Loading…</div></AppShell>;
  if (!prdQ.data?.prd) return <AppShell><div className="p-10 text-sm text-muted-foreground">PRD not found.</div></AppShell>;

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 lg:px-10 py-8 max-w-[1100px] mx-auto">
        <Link to="/prds" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-3 w-3" /> All PRDs
        </Link>

        {prdQ.data?.prd?.github_issue_url ? (
          <a
            href={prdQ.data.prd.github_issue_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 mb-3 ml-3 rounded-md border hairline px-2 py-1 bg-background/40"
            title={prdQ.data.prd.github_issue_url}
          >
            <Github className="h-3 w-3" />
            GitHub issue
            {(() => {
              const m = prdQ.data.prd.github_issue_url.match(/\/issues\/(\d+)/);
              return m ? <span className="text-muted-foreground">#{m[1]}</span> : null;
            })()}
          </a>
        ) : null}

        <div className="flex items-center gap-3 mb-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 bg-transparent font-display text-3xl tracking-tight outline-none border-b hairline focus:border-violet-400 pb-2"
          />
          <div className="flex items-center rounded-xl border hairline overflow-hidden">
            <button onClick={() => setMode("edit")} className={`px-3 py-1.5 text-xs inline-flex items-center gap-1 ${mode === "edit" ? "bg-secondary" : "text-muted-foreground"}`}>
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button onClick={() => setMode("preview")} className={`px-3 py-1.5 text-xs inline-flex items-center gap-1 ${mode === "preview" ? "bg-secondary" : "text-muted-foreground"}`}>
              <Eye className="h-3 w-3" /> Preview
            </button>
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-xl bg-foreground text-background px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>

        {teamsQ.data?.teams && teamsQ.data.teams.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border hairline bg-background/40 px-3 py-2 text-xs">
            <Send className="h-3 w-3 text-violet-300" />
            <span className="text-muted-foreground">Push {prdTasks.length} linked task{prdTasks.length === 1 ? "" : "s"} to Linear:</span>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-md bg-secondary border hairline px-2 py-1 text-xs outline-none"
            >
              <option value="">Select team…</option>
              {teamsQ.data.teams.map((t: { id: string; key: string; name: string }) => (
                <option key={t.id} value={t.id}>{t.key} · {t.name}</option>
              ))}
            </select>
            <button
              onClick={() => pushLinear.mutate()}
              disabled={!teamId || prdTasks.length === 0 || pushLinear.isPending}
              className="rounded-md bg-foreground text-background px-2.5 py-1 text-xs disabled:opacity-40"
            >
              {pushLinear.isPending ? "Creating…" : "Create issues"}
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
          <span className="text-muted-foreground inline-flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-violet-300" /> AI assist:</span>
          {(["rewrite", "expand", "shorten", "critique"] as const).map((a) => (
            <button
              key={a}
              onClick={() => assist.mutate(a)}
              disabled={assist.isPending}
              className="rounded-lg border hairline px-2.5 py-1 hover:bg-secondary capitalize disabled:opacity-50"
            >
              {a}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground ml-2">Select text first, or it'll work on the whole doc.</span>
        </div>

        {mode === "edit" ? (
          <textarea
            ref={taRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full min-h-[600px] rounded-xl border hairline bg-background/60 p-5 text-sm font-mono outline-none focus:ring-1 focus:ring-ring resize-y leading-relaxed"
            spellCheck={false}
          />
        ) : (
          <article className="bento p-8 prose prose-invert max-w-none prose-headings:font-display prose-headings:tracking-tight prose-h2:text-xl prose-h2:mt-8 prose-p:text-sm prose-li:text-sm prose-strong:text-foreground">
            <ReactMarkdown>{body || "_Empty PRD_"}</ReactMarkdown>
          </article>
        )}
      </div>
    </AppShell>
  );
}