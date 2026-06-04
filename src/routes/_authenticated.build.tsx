import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Hammer, GitPullRequest, Github, Loader2, AlertCircle, CheckCircle2, Clock, ShieldQuestion, Plus, ChevronUp, Send } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { listBuilderRuns, dispatchBuilderMission, type BuilderRun } from "@/lib/build.functions";
import { listProjects } from "@/lib/projects.functions";
import { listPrds } from "@/lib/discovery.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/build")({
  component: BuildConsolePage,
  head: () => ({ meta: [{ title: "Build Console · Cadence" }] }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-8 text-sm">
        <p className="text-destructive">Failed to load Build Console: {error.message}</p>
        <Button className="mt-3" onClick={() => { reset(); router.invalidate(); }}>Retry</Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-8 text-sm">Not found.</div>,
});

type Column = { id: "in_flight" | "needs_approval" | "pr_open" | "done" | "failed"; label: string; tone: string };
const COLUMNS: Column[] = [
  { id: "in_flight",      label: "In flight",     tone: "text-cyan-300" },
  { id: "needs_approval", label: "Awaiting you",  tone: "text-amber-300" },
  { id: "pr_open",        label: "PR open",       tone: "text-violet-300" },
  { id: "done",           label: "Done",          tone: "text-emerald-300" },
  { id: "failed",         label: "Failed",        tone: "text-rose-300" },
];

function columnFor(r: BuilderRun): Column["id"] {
  if (r.pending_approvals > 0) return "needs_approval";
  if (r.status === "failed") return "failed";
  if (r.pr) return r.status === "complete" ? "done" : "pr_open";
  if (r.status === "complete") return "done";
  return "in_flight";
}

function BuildConsolePage() {
  const fProjects = useServerFn(listProjects);
  const fRuns = useServerFn(listBuilderRuns);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const runsQ = useQuery({
    queryKey: ["builder-runs"],
    queryFn: () => fRuns(),
    refetchInterval: 2_000,
  });

  const runs = (runsQ.data?.runs ?? []) as BuilderRun[];
  const grouped = new Map<Column["id"], BuilderRun[]>();
  for (const col of COLUMNS) grouped.set(col.id, []);
  for (const r of runs) grouped.get(columnFor(r))!.push(r);

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 lg:px-10 py-8 max-w-[1600px] mx-auto">
        <header className="flex items-end justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
              <Hammer className="h-3 w-3" /> Build · Bundle 9
            </div>
            <h1 className="font-display text-3xl tracking-tight">Build Console</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Dispatch a Builder mission from free-form intent — optionally referencing a PRD or external links — then watch the agent open a scoped, single-file, approval-gated PR. Click any card to open its Mission Graph.
            </p>
          </div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" /> Live · 2s refresh
          </div>
        </header>

        <BuildComposer hasRuns={runs.length > 0} />

        {runsQ.isLoading ? (
          <div className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading Builder missions…</div>
        ) : runs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {COLUMNS.map((col) => (
              <div key={col.id} className="rounded-xl border hairline bg-card/40 p-3 min-h-[200px]">
                <div className={`text-[10px] uppercase tracking-[0.16em] mb-3 flex items-center justify-between ${col.tone}`}>
                  <span>{col.label}</span>
                  <span className="text-muted-foreground">{grouped.get(col.id)!.length}</span>
                </div>
                <div className="space-y-2">
                  {grouped.get(col.id)!.map((r) => <BuilderCard key={r.run_id} run={r} columnId={col.id} />)}
                  {grouped.get(col.id)!.length === 0 ? (
                    <div className="text-xs text-muted-foreground/60 italic px-1 py-2">—</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

type IssueMode = "prd" | "number" | "auto";

function BuildComposer({ hasRuns }: { hasRuns: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fPrds = useServerFn(listPrds);
  const fDispatch = useServerFn(dispatchBuilderMission);
  const prdsQ = useQuery({ queryKey: ["prds"], queryFn: () => fPrds() });

  const [open, setOpen] = useState(!hasRuns);
  const [goal, setGoal] = useState("");
  const [prdId, setPrdId] = useState<string>("");
  const [links, setLinks] = useState("");
  const [issueMode, setIssueMode] = useState<IssueMode>("auto");
  const [issueNumber, setIssueNumber] = useState("");

  const selectedPrd = prdsQ.data?.prds.find((p: { id: string }) => p.id === prdId);
  const prdHasIssue = !!selectedPrd?.github_issue_url;

  const dispatch = useMutation({
    mutationFn: () => {
      const referenceLinks = links
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => /^https?:\/\//i.test(l))
        .slice(0, 10);
      const payload: {
        goal: string;
        prdId?: string;
        issueNumber?: number;
        autoCreateIssue?: boolean;
        referenceLinks?: string[];
      } = { goal: goal.trim() };
      if (prdId) payload.prdId = prdId;
      if (referenceLinks.length) payload.referenceLinks = referenceLinks;
      if (issueMode === "number" && issueNumber.trim()) payload.issueNumber = Number(issueNumber.trim());
      else if (issueMode === "auto" && !prdHasIssue) payload.autoCreateIssue = true;
      return fDispatch({ data: payload });
    },
    onSuccess: (r) => {
      toast.success(`Builder mission dispatched · issue #${r.issue_number}`);
      qc.invalidateQueries({ queryKey: ["builder-runs"] });
      setGoal("");
      setLinks("");
      setIssueNumber("");
      const missionId = (r as { mission_id?: string | null }).mission_id;
      if (missionId) navigate({ to: "/missions/$missionId", params: { missionId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <div className="mb-4">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border hairline px-3 py-1.5 text-xs hover:bg-secondary"
        >
          <Plus className="h-3 w-3" /> New build
        </button>
      </div>
    );
  }

  const canSubmit = goal.trim().length >= 4
    && !dispatch.isPending
    && (issueMode !== "number" || /^\d+$/.test(issueNumber.trim()))
    && (issueMode !== "prd" || prdHasIssue);

  return (
    <div className="bento p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm inline-flex items-center gap-1.5">
          <Hammer className="h-3.5 w-3.5 text-cyan-300" /> Start a build
        </h3>
        {hasRuns ? (
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px]">
            <ChevronUp className="h-3 w-3" /> Collapse
          </button>
        ) : (
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Single-file · approval-gated · idempotent</span>
        )}
      </div>

      <label className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Goal</label>
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={3}
        placeholder="What should the Builder ship? Be specific about the file or behavior you want changed."
        className="w-full rounded-lg border hairline bg-background/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
      />

      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div>
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Reference PRD (optional)</label>
          <select
            value={prdId}
            onChange={(e) => {
              setPrdId(e.target.value);
              const p = prdsQ.data?.prds.find((x: { id: string }) => x.id === e.target.value);
              if (p?.github_issue_url) setIssueMode("prd");
            }}
            className="w-full rounded-lg bg-secondary border hairline px-2.5 py-1.5 text-sm outline-none"
          >
            <option value="">— None —</option>
            {(prdsQ.data?.prds ?? []).map((p: { id: string; title: string; github_issue_url: string | null }) => (
              <option key={p.id} value={p.id}>
                {p.title}{p.github_issue_url ? " · #linked" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Reference links (optional)</label>
          <textarea
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            rows={2}
            placeholder="https://… (one URL per line, max 10)"
            className="w-full rounded-lg border hairline bg-background/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>
      </div>

      <div className="mt-3">
        <div className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">GitHub issue</div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className={`inline-flex items-center gap-1.5 ${!prdHasIssue ? "opacity-40" : ""}`}>
            <input
              type="radio"
              name="issueMode"
              checked={issueMode === "prd"}
              disabled={!prdHasIssue}
              onChange={() => setIssueMode("prd")}
            />
            Use linked PRD issue
            {prdHasIssue ? (() => {
              const m = selectedPrd!.github_issue_url!.match(/\/issues\/(\d+)/);
              return m ? <span className="text-violet-300">#{m[1]}</span> : null;
            })() : null}
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name="issueMode" checked={issueMode === "number"} onChange={() => setIssueMode("number")} />
            Issue #
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              value={issueNumber}
              onChange={(e) => { setIssueNumber(e.target.value.replace(/\D/g, "")); setIssueMode("number"); }}
              className="w-20 rounded-md bg-secondary border hairline px-2 py-0.5 text-xs outline-none"
              placeholder="123"
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name="issueMode" checked={issueMode === "auto"} onChange={() => setIssueMode("auto")} />
            Auto-create from goal
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          Builder is scoped to a single file per PR and pauses for approval before opening it.
        </p>
        <button
          onClick={() => dispatch.mutate()}
          disabled={!canSubmit}
          className="rounded-xl neural-gradient text-white px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {dispatch.isPending ? "Dispatching…" : "Dispatch Builder"}
        </button>
      </div>
    </div>
  );
}

function BuilderCard({ run, columnId }: { run: BuilderRun; columnId: Column["id"] }) {
  const Icon = columnId === "needs_approval" ? ShieldQuestion
    : columnId === "failed" ? AlertCircle
    : columnId === "done" ? CheckCircle2
    : columnId === "pr_open" ? GitPullRequest
    : Clock;
  const tone = columnId === "needs_approval" ? "text-amber-300"
    : columnId === "failed" ? "text-rose-300"
    : columnId === "done" ? "text-emerald-300"
    : columnId === "pr_open" ? "text-violet-300"
    : "text-cyan-300";

  const inner = (
    <div className="rounded-lg border hairline bg-background/40 p-3 hover:border-primary/30 transition group">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
        <Icon className={`h-3 w-3 ${tone}`} />
        <span>{run.status}</span>
        {run.pending_approvals > 0 ? <span className="text-amber-300">· {run.pending_approvals} pending</span> : null}
      </div>
      <div className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-foreground">
        {run.mission_title ?? run.goal.slice(0, 80)}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{run.goal}</div>
      {run.pr ? (
        <a
          href={run.pr.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1.5 text-[11px] rounded-md border hairline px-1.5 py-0.5 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20"
          title={run.pr.url}
        >
          <Github className="h-3 w-3" />
          PR #{run.pr.number}
          <span className="text-muted-foreground truncate max-w-[140px]">{run.pr.path}</span>
        </a>
      ) : null}
      <div className="mt-2 text-[10px] text-muted-foreground/70">{new Date(run.created_at).toLocaleString()}</div>
    </div>
  );

  return run.mission_id ? (
    <Link to="/missions/$missionId" params={{ missionId: run.mission_id }} className="block">
      {inner}
    </Link>
  ) : inner;
}

function EmptyState() {
  return (
    <div className="rounded-xl border hairline bg-card/30 p-10 text-center">
      <Hammer className="h-6 w-6 mx-auto text-muted-foreground mb-3" />
      <div className="font-display text-lg mb-1">No Builder missions yet</div>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Use <span className="text-cyan-300">Start a build</span> above to dispatch a mission from free-form intent (optionally referencing a PRD or links). Builder will draft a scoped, single-file PR for you to approve — and it will appear here, live.
      </p>
      <Link to="/prds" className="mt-4 inline-flex items-center gap-1.5 text-xs rounded-md border hairline px-3 py-1.5 hover:border-primary/40">
        Browse PRDs
      </Link>
    </div>
  );
}