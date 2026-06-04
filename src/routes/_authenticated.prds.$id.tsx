import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Eye, Pencil, Save, Sparkles, Send, Github, Hammer, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import { getPrd, savePrd, prdAssist, createGithubIssueForPrd } from "@/lib/discovery.functions";
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
  const mCreateIssue = useServerFn(createGithubIssueForPrd);

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

  const createIssue = useMutation({
    mutationFn: () => mCreateIssue({ data: { id } }),
    onSuccess: (r) => {
      toast.success(r.cached ? "GitHub issue already linked" : `GitHub issue #${r.number} created`);
      qc.invalidateQueries({ queryKey: ["prd", id] });
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
        <Link to="/prds" className="inline-flex items-center gap-1.5 mono-label hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> All PRDs
        </Link>

        {/* Document metadata row */}
        <div className="mono-label flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
          <span>{prdQ.data.prd.status}</span>
          <span aria-hidden>/</span>
          <span>Updated {new Date(prdQ.data.prd.updated_at).toLocaleDateString()}</span>
          <span aria-hidden>/</span>
          <span>{prdTasks.length} linked task{prdTasks.length === 1 ? "" : "s"}</span>
          {prdQ.data.prd.github_issue_url ? (() => {
            const m = prdQ.data.prd.github_issue_url.match(/\/issues\/(\d+)/);
            return m ? (
              <>
                <span aria-hidden>/</span>
                <a
                  href={prdQ.data.prd.github_issue_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 link-action"
                >
                  <Github className="h-3 w-3" /> Issue #{m[1]} <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </>
            ) : null;
          })() : null}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 bg-transparent font-display text-4xl tracking-tight leading-[1.05] outline-none border-b hairline focus:border-foreground pb-2"
          />
        </div>

        {/* Sticky actions bar */}
        <div className="sticky top-2 z-20 mb-8 rounded-lg border hairline bg-card/95 backdrop-blur px-3 py-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border hairline overflow-hidden">
            <button onClick={() => setMode("edit")} className={`px-3 py-1.5 text-xs inline-flex items-center gap-1 ${mode === "edit" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button onClick={() => setMode("preview")} className={`px-3 py-1.5 text-xs inline-flex items-center gap-1 ${mode === "preview" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              <Eye className="h-3 w-3" /> Preview
            </button>
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="btn-pill px-4 py-1.5 text-xs disabled:opacity-50"
          >
            <Save className="h-3 w-3" /> {save.isPending ? "Saving…" : "Save"}
          </button>

          <span className="mx-1 h-4 w-px bg-[var(--hairline)]" />

          {prdQ.data.prd.github_issue_url ? (
            <button
              onClick={() => sendToBuilder.mutate()}
              disabled={sendToBuilder.isPending}
              className="btn-pill-outline px-3 py-1 text-xs disabled:opacity-50"
              title="Dispatch the Builder agent to open a scoped PR for this issue"
            >
              <Hammer className="h-3 w-3" />
              {sendToBuilder.isPending ? "Dispatching…" : "Send to Builder"}
            </button>
          ) : (
            <button
              onClick={() => createIssue.mutate()}
              disabled={createIssue.isPending}
              className="btn-pill-outline px-3 py-1 text-xs disabled:opacity-50"
              title="Create a GitHub issue from this PRD, then unlock Send to Builder."
            >
              <Github className="h-3 w-3" />
              {createIssue.isPending ? "Creating…" : "Create GitHub issue"}
            </button>
          )}

          <span className="mx-1 h-4 w-px bg-[var(--hairline)]" />

          <span className="mono-label inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> AI
          </span>
          {(["rewrite", "expand", "shorten", "critique"] as const).map((a) => (
            <button
              key={a}
              onClick={() => assist.mutate(a)}
              disabled={assist.isPending}
              className="rounded-md border hairline px-2.5 py-1 text-[11px] hover:bg-[var(--soft-stone)] capitalize disabled:opacity-50"
            >
              {a}
            </button>
          ))}
        </div>

        {teamsQ.data?.teams && teamsQ.data.teams.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border hairline bg-card px-3 py-2.5 text-xs">
            <Send className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Push {prdTasks.length} linked task{prdTasks.length === 1 ? "" : "s"} to Linear:</span>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-md border hairline bg-background px-2 py-1 text-xs outline-none"
            >
              <option value="">Select team…</option>
              {teamsQ.data.teams.map((t: { id: string; key: string; name: string }) => (
                <option key={t.id} value={t.id}>{t.key} · {t.name}</option>
              ))}
            </select>
            <button
              onClick={() => pushLinear.mutate()}
              disabled={!teamId || prdTasks.length === 0 || pushLinear.isPending}
              className="btn-pill px-3 py-1 text-xs disabled:opacity-40"
            >
              {pushLinear.isPending ? "Creating…" : "Create issues"}
            </button>
          </div>
        )}

        {mode === "edit" ? (
          <textarea
            ref={taRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full min-h-[600px] rounded-lg border hairline bg-card p-6 text-sm font-mono outline-none focus:border-foreground resize-y leading-relaxed"
            spellCheck={false}
          />
        ) : (
          <article className="rounded-lg border hairline bg-card p-10 prose prose-neutral max-w-none prose-headings:font-display prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-10 prose-p:text-[15px] prose-p:leading-relaxed prose-li:text-[15px] prose-strong:text-foreground">
            <ReactMarkdown>{body || "_Empty PRD_"}</ReactMarkdown>
          </article>
        )}
      </div>
    </AppShell>
  );
}