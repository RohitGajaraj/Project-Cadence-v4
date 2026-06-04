import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FileText, Sparkles, Trash2, GitBranch, ListTodo, Github, Hammer, Pencil, MoreHorizontal, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { LineageDrawer } from "@/components/cadence/LineageDrawer";
import { listProjects } from "@/lib/projects.functions";
import { listPrds, deletePrd, generatePrd, createGithubIssueForPrd, savePrd } from "@/lib/discovery.functions";
import { promotePrdToTasks } from "@/lib/lineage.functions";
import { dispatchBuilderMission } from "@/lib/build.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const mSave = useServerFn(savePrd);
  const rename = useMutation({
    mutationFn: (v: { id: string; title: string }) => mSave({ data: { id: v.id, title: v.title } }),
    onSuccess: () => { inv(); toast.success("Renamed"); },
    onError: (e: Error) => toast.error(e.message),
  });

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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const all = prds.data?.prds ?? [];

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const startRename = (id: string, current: string) => {
    setRenameValue(current);
    setRenamingId(id);
  };
  const commitRename = (id: string, original: string) => {
    const next = renameValue.trim().slice(0, 200);
    setRenamingId(null);
    if (next && next !== original) rename.mutate({ id, title: next });
  };

  const fmtDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 lg:px-10 py-8 max-w-[1300px] mx-auto">
        <header className="mb-8">
          <div className="mono-label">Deliver · Phase 2 · Specs</div>
          <h1 className="mt-3 font-display text-5xl tracking-tight leading-[1.02]">
            Product <em className="not-italic neural-text">requirement docs</em>
          </h1>
        </header>

        <div className="rounded-lg border hairline bg-card p-6 mb-8">
          <div className="mono-label flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Draft a PRD from a brief
          </div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe the problem, who it's for, and any constraints. The AI will produce a structured PRD."
            rows={3}
            className="mt-3 w-full rounded-md border hairline bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground resize-none"
          />
          <button
            onClick={() => { if (brief.trim()) { gen.mutate(brief.trim()); setBrief(""); } }}
            disabled={gen.isPending || !brief.trim()}
            className="mt-4 btn-pill disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> {gen.isPending ? "Drafting…" : "Generate PRD"}
          </button>
        </div>

        <div className="mono-label mb-3">All PRDs</div>
        <div className="border-t hairline">
          {all.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => { if (renamingId !== p.id) navigate({ to: "/prds/$id", params: { id: p.id } }); }}
              onKeyDown={(e) => {
                if (renamingId === p.id) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate({ to: "/prds/$id", params: { id: p.id } });
                }
              }}
              className="rule-hairline py-5 group cursor-pointer text-left hover:bg-[var(--soft-stone)] -mx-3 px-3 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  {renamingId === p.id ? (
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => commitRename(p.id, p.title)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") { e.preventDefault(); commitRename(p.id, p.title); }
                        if (e.key === "Escape") { e.preventDefault(); setRenamingId(null); }
                      }}
                      className="flex-1 min-w-0 bg-transparent font-display text-base outline-none border-b hairline focus:border-foreground"
                    />
                  ) : (
                    <h3 className="font-display text-base truncate text-foreground">{p.title}</h3>
                  )}
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="opacity-60 hover:opacity-100 text-muted-foreground hover:text-foreground rounded-md p-1 -mr-1"
                        aria-label="PRD actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onSelect={() => startRename(p.id, p.title)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => promote.mutate(p.id)}
                        disabled={promote.isPending}
                      >
                        <ListTodo className="h-3.5 w-3.5 mr-2" />
                        {promote.isPending && promote.variables === p.id ? "Generating tasks…" : "Generate tasks"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {p.github_issue_url ? (
                        <>
                          <DropdownMenuItem onSelect={() => window.open(p.github_issue_url!, "_blank", "noopener,noreferrer")}>
                            <Github className="h-3.5 w-3.5 mr-2" /> Open GitHub issue
                            <ExternalLink className="h-3 w-3 ml-auto opacity-60" />
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => sendToBuilder.mutate({ id: p.id, title: p.title })}
                            disabled={sendToBuilder.isPending}
                          >
                            <Hammer className="h-3.5 w-3.5 mr-2" />
                            {sendToBuilder.isPending && sendToBuilder.variables?.id === p.id ? "Dispatching…" : "Send to Builder"}
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem
                          onSelect={() => createIssue.mutate(p.id)}
                          disabled={createIssue.isPending}
                        >
                          <Github className="h-3.5 w-3.5 mr-2" />
                          {createIssue.isPending && createIssue.variables === p.id ? "Creating issue…" : "Create GitHub issue"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setLineage({ id: p.id, title: p.title })}>
                        <GitBranch className="h-3.5 w-3.5 mr-2" /> Lineage
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => del.mutate(p.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="mt-2 ml-7 mono-label flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{p.status}</span>
                <span aria-hidden>/</span>
                <span>Updated {fmtDateTime(p.updated_at)}</span>
                {p.github_issue_url ? (() => {
                  const m = p.github_issue_url.match(/\/issues\/(\d+)/);
                  return m ? <><span aria-hidden>/</span><span>#{m[1]}</span></> : null;
                })() : null}
              </div>
            </div>
          ))}
          {all.length === 0 && (
            <div className="py-16 flex flex-col items-center justify-center">
              <FolderInteraction label="Your PRDs land here" />
              <div className="text-sm text-muted-foreground mt-4">
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