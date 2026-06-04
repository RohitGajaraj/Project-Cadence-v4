import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Sparkles, Trash2, GitBranch, ListTodo, Github, Hammer, Pencil, FileEdit } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { LineageDrawer } from "@/components/cadence/LineageDrawer";
import { listProjects } from "@/lib/projects.functions";
import { listPrds, deletePrd, generatePrd, createGithubIssueForPrd } from "@/lib/discovery.functions";
import { promotePrdToTasks } from "@/lib/lineage.functions";
import { dispatchBuilderMission } from "@/lib/build.functions";
import FolderInteraction from "@/components/ui/folder";

export const Route = createFileRoute("/_authenticated/prds")({
  component: PrdsPage,
  head: () => ({ meta: [{ title: "PRDs · Cadence" }] }),
});

function PrdsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fProjects = useServerFn(listProjects);
  const fPrds = useServerFn(listPrds);
  const mDelete = useServerFn(deletePrd);
  const mGen = useServerFn(generatePrd);
  const mTasks = useServerFn(promotePrdToTasks);
  const mCreateIssue = useServerFn(createGithubIssueForPrd);
  const mDispatch = useServerFn(dispatchBuilderMission);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const prds = useQuery({ queryKey: ["prds"], queryFn: () => fPrds() });
  const inv = () => qc.invalidateQueries({ queryKey: ["prds"] });

  const del = useMutation({ mutationFn: (id: string) => mDelete({ data: { id } }), onSuccess: inv });
  const promote = useMutation({
    mutationFn: (prd_id: string) => mTasks({ data: { prd_id } }),
    onSuccess: (r) => {
      toast.success(`Generated ${r.count} task${r.count === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const createIssue = useMutation({
    mutationFn: (id: string) => mCreateIssue({ data: { id } }),
    onSuccess: (r) => {
      toast.success(r.cached ? "GitHub issue already linked" : `GitHub issue #${r.number} created`);
      inv();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendToBuilder = useMutation({
    mutationFn: (p: { id: string; title: string }) =>
      mDispatch({
        data: {
          prdId: p.id,
          goal: `Ship the changes described in PRD "${p.title}".`,
          missionTitle: `Build · ${p.title.slice(0, 60)}`,
        },
      }),
    onSuccess: (r) => {
      toast.success("Builder mission dispatched");
      const missionId = (r as { mission_id?: string | null }).mission_id;
      if (missionId) navigate({ to: "/missions/$missionId", params: { missionId } });
      else navigate({ to: "/build" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const gen = useMutation({
    mutationFn: (brief: string) => mGen({ data: { brief } }),
    onSuccess: (r) => { inv(); toast.success("PRD drafted"); if (r.prd?.id) navigate({ to: "/prds/$id", params: { id: r.prd.id } }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [brief, setBrief] = useState("");
  const [lineage, setLineage] = useState<{ id: string; title: string } | null>(null);
  const all = prds.data?.prds ?? [];

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 lg:px-10 py-8 max-w-[1300px] mx-auto">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Phase 2 · Specs</div>
          <h1 className="mt-3 font-display text-4xl tracking-tight">Product <span className="neural-text">requirement docs</span></h1>
        </header>

        <div className="bento p-5 mb-6">
          <h3 className="font-display text-sm mb-3 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-300" /> Draft a PRD from a brief
          </h3>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe the problem, who it's for, and any constraints. The AI will produce a structured PRD."
            rows={3}
            className="w-full rounded-lg border hairline bg-background/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <button
            onClick={() => { if (brief.trim()) { gen.mutate(brief.trim()); setBrief(""); } }}
            disabled={gen.isPending || !brief.trim()}
            className="mt-2 rounded-xl neural-gradient text-white px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> {gen.isPending ? "Drafting…" : "Generate PRD"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {all.map((p) => (
            <div key={p.id} className="bento p-4 group hover:ring-1 hover:ring-ring transition">
              <div className="flex items-start justify-between gap-2">
                <Link to="/prds/$id" params={{ id: p.id }} className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-violet-300 shrink-0" />
                  <h3 className="font-display text-sm truncate">{p.title}</h3>
                </Link>
                <button
                  onClick={() => del.mutate(p.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                <span className="rounded-full bg-secondary px-2 py-0.5">{p.status}</span>
                <span>{new Date(p.updated_at).toLocaleDateString()}</span>
                {p.github_issue_url ? (() => {
                  const m = p.github_issue_url.match(/\/issues\/(\d+)/);
                  return m ? <span className="rounded-full bg-violet-500/15 text-violet-200 px-2 py-0.5">#{m[1]}</span> : null;
                })() : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Link
                  to="/prds/$id"
                  params={{ id: p.id }}
                  className="rounded-lg border hairline px-2.5 py-1.5 text-[11px] inline-flex items-center gap-1.5 bg-foreground text-background hover:opacity-90"
                  title="Open the full PRD document (edit title, body, actions)"
                >
                  <FileEdit className="h-3 w-3" /> Open
                </Link>
                <button
                  onClick={() => {
                    const next = window.prompt("Rename PRD", p.title);
                    if (next && next.trim() && next !== p.title) {
                      mDispatch; // no-op to keep import — actual rename uses savePrd
                      void (async () => {
                        try {
                          const { savePrd } = await import("@/lib/discovery.functions");
                          const fn = (savePrd as unknown as (args: { data: { id: string; title: string } }) => Promise<unknown>);
                          await fn({ data: { id: p.id, title: next.trim().slice(0, 200) } });
                          inv();
                          toast.success("Renamed");
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      })();
                    }
                  }}
                  className="rounded-lg border hairline px-2.5 py-1.5 text-[11px] inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                  title="Rename PRD"
                >
                  <Pencil className="h-3 w-3" /> Rename
                </button>
                <button
                  onClick={() => promote.mutate(p.id)}
                  disabled={promote.isPending}
                  className="rounded-lg neural-gradient text-white px-2.5 py-1.5 text-[11px] inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <ListTodo className="h-3 w-3" />
                  {promote.isPending && promote.variables === p.id ? "Generating…" : "Generate tasks"}
                </button>
                {p.github_issue_url ? (
                  <>
                    <a
                      href={p.github_issue_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border hairline px-2.5 py-1.5 text-[11px] inline-flex items-center gap-1.5 text-violet-200 hover:bg-violet-500/10"
                      title={p.github_issue_url}
                    >
                      <Github className="h-3 w-3" /> Open issue
                    </a>
                    <button
                      onClick={() => sendToBuilder.mutate({ id: p.id, title: p.title })}
                      disabled={sendToBuilder.isPending}
                      className="rounded-lg border hairline px-2.5 py-1.5 text-[11px] inline-flex items-center gap-1.5 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
                    >
                      <Hammer className="h-3 w-3" />
                      {sendToBuilder.isPending && sendToBuilder.variables?.id === p.id ? "Dispatching…" : "Send to Builder"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => createIssue.mutate(p.id)}
                    disabled={createIssue.isPending}
                    className="rounded-lg border hairline px-2.5 py-1.5 text-[11px] inline-flex items-center gap-1.5 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25 disabled:opacity-50"
                    title="Create a GitHub issue from this PRD and unlock Send to Builder"
                  >
                    <Github className="h-3 w-3" />
                    {createIssue.isPending && createIssue.variables === p.id ? "Creating…" : "Create GitHub issue"}
                  </button>
                )}
                <button
                  onClick={() => setLineage({ id: p.id, title: p.title })}
                  className="rounded-lg border hairline px-2.5 py-1.5 text-[11px] inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <GitBranch className="h-3 w-3" /> Lineage
                </button>
              </div>
            </div>
          ))}
          {all.length === 0 && (
            <div className="col-span-full py-10 flex flex-col items-center justify-center">
              <FolderInteraction label="Your PRDs land here" />
              <div className="text-xs text-muted-foreground mt-2">
                No PRDs yet. Draft one above or generate from an opportunity.
              </div>
            </div>
          )}
        </div>
      </div>
      <LineageDrawer
        open={lineage !== null}
        onOpenChange={(o) => { if (!o) setLineage(null); }}
        kind="prd"
        id={lineage?.id ?? null}
        title={lineage?.title}
      />
    </AppShell>
  );
}