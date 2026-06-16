import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Eye,
  Pencil,
  Save,
  Sparkles,
  Send,
  Github,
  Hammer,
  ExternalLink,
  Gavel,
} from "lucide-react";
import { toast } from "@/lib/notify";
import { AppShell } from "@/components/cadence/AppShell";
import { listProjects } from "@/lib/projects.functions";
import {
  getPrd,
  savePrd,
  prdAssist,
  createGithubIssueForPrd,
  generateTaskGraph,
  type CriticReview,
} from "@/lib/discovery.functions";
import { CriticBadge } from "@/components/governance/CriticBadge";
import { CitationsCard, type Citation } from "@/components/product/CitationsCard";
import { OutcomeCard, type OutcomePrd } from "@/components/product/OutcomeCard";
import { listTasks } from "@/lib/tasks.functions";
import { listLinearTeams, createLinearIssuesFromTasks } from "@/lib/linear.functions";
import { dispatchStudioSession } from "@/lib/studio.functions";
import { createDecision } from "@/lib/decisions.functions";

export const Route = createFileRoute("/_authenticated/prds/$id")({
  component: PrdEditor,
  head: () => ({ meta: [{ title: "Cadence" }] }),
});

function PrdEditor() {
  const { id } = useParams({ from: "/_authenticated/prds/$id" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fProjects = useServerFn(listProjects);
  const fGet = useServerFn(getPrd);
  const mSave = useServerFn(savePrd);
  const mAssist = useServerFn(prdAssist);
  const mDispatchStudio = useServerFn(dispatchStudioSession);
  const mCreateIssue = useServerFn(createGithubIssueForPrd);
  const mCaptureDecision = useServerFn(createDecision);

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

  // H1 — Planner: decompose the spec into a dependency-ordered task graph.
  const fGenTasks = useServerFn(generateTaskGraph);
  const genTasks = useMutation({
    mutationFn: () => fGenTasks({ data: { prd_id: id } }),
    onSuccess: (r: { count: number; graph: boolean }) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(
        `Planned ${r.count} task${r.count === 1 ? "" : "s"}${r.graph ? "" : " (graph fields apply after next sync)"}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pushLinear = useMutation({
    mutationFn: () =>
      fPushLinear({
        data: { teamId, taskIds: prdTasks.map((t: { id: string }) => t.id) },
      }),
    onSuccess: (r) => toast.success(`Created ${r.created.length} Linear issue(s)`),
    onError: (e: Error) => toast.error(e.message),
  });

  const sendToStudio = useMutation({
    mutationFn: () => mDispatchStudio({ data: { prdId: id } }),
    onSuccess: (r) => {
      toast.success("Build session dispatched");
      navigate({ to: "/build/$missionId", params: { missionId: r.missionId } });
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

  const captureDecision = useMutation({
    mutationFn: () =>
      mCaptureDecision({
        data: {
          title: `Spec decision: ${(title || prdQ.data?.prd?.title || "Untitled spec").slice(0, 220)}`,
          rationale: (body || prdQ.data?.prd?.body_md || "").slice(0, 500) || undefined,
          status: "approved",
          prd_id: id,
        },
      }),
    onSuccess: () => {
      toast.success("Captured to Decisions");
      qc.invalidateQueries({ queryKey: ["decisions"] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prds"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assist = useMutation({
    mutationFn: (action: "rewrite" | "expand" | "critique" | "shorten") => {
      const ta = taRef.current;
      const sel =
        ta && ta.selectionStart !== ta.selectionEnd
          ? body.slice(ta.selectionStart, ta.selectionEnd)
          : body;
      if (!sel.trim()) throw new Error("Select some text first (or have content to work on)");
      return mAssist({ data: { action, selection: sel, context: body.slice(0, 4000) } });
    },
    onSuccess: (r) => {
      const ta = taRef.current;
      if (!ta) return;
      const start = ta.selectionStart,
        end = ta.selectionEnd;
      const next =
        start !== end ? body.slice(0, start) + r.text + body.slice(end) : body + "\n\n" + r.text;
      setBody(next);
      toast.success("AI applied");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (prdQ.isLoading)
    return (
      <AppShell>
        <div className="p-10 text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );
  if (!prdQ.data?.prd)
    return (
      <AppShell>
        <div className="p-10 text-sm text-muted-foreground">PRD not found.</div>
      </AppShell>
    );

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 lg:px-10 py-8 max-w-[1100px] mx-auto">
        <Link
          to="/prds"
          className="inline-flex items-center gap-1.5 mono-label hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" /> All PRDs
        </Link>

        {/* Document metadata row */}
        <div className="mono-label flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
          <span>{prdQ.data.prd.status}</span>
          <span aria-hidden>/</span>
          <span>Updated {new Date(prdQ.data.prd.updated_at).toLocaleDateString()}</span>
          <span aria-hidden>/</span>
          <span>
            {prdTasks.length} linked task{prdTasks.length === 1 ? "" : "s"}
          </span>
          {prdQ.data.prd.github_issue_url
            ? (() => {
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
                      <Github className="h-3 w-3" /> Issue #{m[1]}{" "}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </>
                ) : null;
              })()
            : null}
          <span aria-hidden>/</span>
          <CriticBadge
            review={
              (prdQ.data.prd as { critic_review?: CriticReview | null }).critic_review ?? null
            }
            target={{ kind: "prd", id }}
            invalidateKey={["prd", id]}
          />
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
            <button
              onClick={() => setMode("edit")}
              className={`px-3 py-1.5 text-xs inline-flex items-center gap-1 ${mode === "edit" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              onClick={() => setMode("preview")}
              className={`px-3 py-1.5 text-xs inline-flex items-center gap-1 ${mode === "preview" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
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
              onClick={() => sendToStudio.mutate()}
              disabled={sendToStudio.isPending}
              className="btn-pill-outline px-3 py-1 text-xs disabled:opacity-50"
              title="Dispatch a Build session to plan, stage, and PR the changes for this issue"
            >
              <Hammer className="h-3 w-3" />
              {sendToStudio.isPending ? "Dispatching…" : "Send to Build"}
            </button>
          ) : (
            <button
              onClick={() => createIssue.mutate()}
              disabled={createIssue.isPending}
              className="btn-pill-outline px-3 py-1 text-xs disabled:opacity-50"
              title="Create a GitHub issue from this PRD, then unlock Send to Build."
            >
              <Github className="h-3 w-3" />
              {createIssue.isPending ? "Creating…" : "Create GitHub issue"}
            </button>
          )}

          <span className="mx-1 h-4 w-px bg-[var(--hairline)]" />

          <button
            onClick={() => captureDecision.mutate()}
            disabled={captureDecision.isPending}
            className="btn-pill-outline px-3 py-1 text-xs disabled:opacity-50"
            title="Log this spec as a decision in /knowledge?tab=decisions"
          >
            <Gavel className="h-3 w-3" />
            {captureDecision.isPending ? "Capturing…" : "Capture as decision"}
          </button>

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

        {/* H1 — engineering task graph (Planner) */}
        <div className="mb-6 rounded-lg border hairline bg-card px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="mono-label text-xs text-muted-foreground">
              Task graph · {prdTasks.length} task{prdTasks.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={() => genTasks.mutate()}
              disabled={genTasks.isPending}
              className="btn-pill-outline px-3 py-1 text-xs disabled:opacity-50"
              title="Decompose this spec into a dependency-ordered engineering task graph"
            >
              <Send className="h-3 w-3" />
              {genTasks.isPending ? "Planning…" : "Generate task graph"}
            </button>
          </div>
          {prdTasks.length > 0 ? (
            <ol className="space-y-1.5">
              {[...prdTasks]
                .sort(
                  (a: { seq?: number | null }, b: { seq?: number | null }) =>
                    (a.seq ?? 999) - (b.seq ?? 999),
                )
                .map(
                  (t: {
                    id: string;
                    seq?: number | null;
                    title: string;
                    detail?: string | null;
                    estimate_hours?: number | null;
                    assignee_kind?: string;
                    risk?: string | null;
                    depends_on?: unknown;
                  }) => (
                    <li
                      key={t.id}
                      className="text-xs leading-snug flex flex-wrap items-baseline gap-x-2"
                    >
                      <span className="mono-label text-muted-foreground">
                        {t.seq != null ? `#${t.seq}` : "·"}
                      </span>
                      <span className="font-medium">{t.title}</span>
                      {t.detail ? (
                        <span className="text-muted-foreground">— {t.detail}</span>
                      ) : null}
                      {t.estimate_hours ? (
                        <span className="mono-label text-[10px] text-muted-foreground">
                          {t.estimate_hours}h
                        </span>
                      ) : null}
                      <span className="mono-label text-[10px] text-muted-foreground">
                        {t.assignee_kind === "human" ? "you" : "agent"}
                      </span>
                      {Array.isArray(t.depends_on) && t.depends_on.length > 0 ? (
                        <span className="mono-label text-[10px] text-muted-foreground">
                          after {(t.depends_on as number[]).map((n) => `#${n}`).join(", ")}
                        </span>
                      ) : null}
                      {t.risk ? (
                        <span className="mono-label text-[10px] text-[var(--ember)]" title={t.risk}>
                          risk
                        </span>
                      ) : null}
                    </li>
                  ),
                )}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">
              No tasks yet. Generate a graph from the approved spec.
            </p>
          )}
        </div>

        {teamsQ.data?.teams && teamsQ.data.teams.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border hairline bg-card px-3 py-2.5 text-xs">
            <Send className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              Push {prdTasks.length} linked task{prdTasks.length === 1 ? "" : "s"} to Linear:
            </span>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-md border hairline bg-background px-2 py-1 text-xs outline-none"
            >
              <option value="">Select team…</option>
              {teamsQ.data.teams.map((t: { id: string; key: string; name: string }) => (
                <option key={t.id} value={t.id}>
                  {t.key} · {t.name}
                </option>
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

        <div className="mt-6">
          <CitationsCard
            citations={(prdQ.data.prd as { citations?: Citation[] | null }).citations ?? null}
          />
        </div>

        <div className="mt-6">
          <OutcomeCard prd={prdQ.data.prd as unknown as OutcomePrd} invalidateKey={["prd", id]} />
        </div>
      </div>
    </AppShell>
  );
}
