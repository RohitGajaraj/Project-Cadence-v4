import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, X, Loader2, ExternalLink, Search, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { listTasks, createTask, updateTask, deleteTask } from "@/lib/tasks.functions";
import { listProjects } from "@/lib/projects.functions";
import { searchLinearIssues, importLinearIssue, listLinearTeams } from "@/lib/linear.functions";
import { LineageDrawer } from "@/components/cadence/LineageDrawer";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
  head: () => ({ meta: [{ title: "Tasks · Cadence" }] }),
});

function TasksPage() {
  const qc = useQueryClient();
  const fetchTasks = useServerFn(listTasks);
  const fetchProjects = useServerFn(listProjects);
  const mCreate = useServerFn(createTask);
  const mUpdate = useServerFn(updateTask);
  const mDelete = useServerFn(deleteTask);
  const fSearchLinear = useServerFn(searchLinearIssues);
  const fImportLinear = useServerFn(importLinearIssue);
  const fLinearTeams = useServerFn(listLinearTeams);

  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fetchProjects() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  const add = useMutation({
    mutationFn: (data: { title: string; is_deep_work: boolean }) => mCreate({ data }),
    onSuccess: () => { invalidate(); toast.success("Task added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (data: { id: string; status: "todo" | "done" }) => mUpdate({ data }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => mDelete({ data: { id } }), onSuccess: invalidate });

  const [title, setTitle] = useState("");
  const [deep, setDeep] = useState(false);
  const [linearOpen, setLinearOpen] = useState(false);
  const [linearQuery, setLinearQuery] = useState("");
  const [linearTeam, setLinearTeam] = useState<string>("");
  const [onlyMine, setOnlyMine] = useState(true);
  const [lineage, setLineage] = useState<{ id: string; title: string } | null>(null);

  const linearTeams = useQuery({
    queryKey: ["linear-teams"],
    queryFn: () => fLinearTeams(),
    enabled: linearOpen,
  });
  const linearIssues = useQuery({
    queryKey: ["linear-issues", linearQuery, linearTeam, onlyMine],
    queryFn: () => fSearchLinear({ data: { query: linearQuery, teamId: linearTeam || undefined, onlyMine } }),
    enabled: linearOpen,
  });
  const mImportLinear = useMutation({
    mutationFn: (issueId: string) => fImportLinear({ data: { issueId } }),
    onSuccess: () => { invalidate(); toast.success("Imported from Linear"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = tasks.data?.tasks ?? [];
  const groups = {
    todo: all.filter((t) => t.status === "todo"),
    doing: all.filter((t) => t.status === "doing"),
    done: all.filter((t) => t.status === "done"),
  };

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 lg:px-10 py-8 max-w-[1300px] mx-auto">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Workstream</div>
              <h1 className="mt-3 font-display text-4xl tracking-tight">All <span className="neural-text">tasks</span></h1>
            </div>
            <button
              onClick={() => setLinearOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border hairline px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              title="Import from Linear"
            >
              <span className="text-xs font-semibold tracking-wide">L</span> Import from Linear
            </button>
          </div>
        </header>

        <form
          onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; add.mutate({ title: title.trim(), is_deep_work: deep }); setTitle(""); setDeep(false); }}
          className="bento p-4 flex items-center gap-2 mb-6"
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Capture a new task…"
            className="flex-1 rounded-lg border hairline bg-background/60 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> deep work
          </label>
          <button className="rounded-xl bg-foreground text-background px-3 py-2 text-sm inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add</button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(["todo", "doing", "done"] as const).map((col) => (
            <section key={col} className="bento p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm capitalize">{col}</h3>
                <span className="text-[11px] text-muted-foreground">{groups[col].length}</span>
              </div>
              <ul className="space-y-2 min-h-[120px]">
                {groups[col].map((t) => (
                  <li key={t.id} className="rounded-xl border hairline px-3 py-2 flex items-center gap-2">
                    <input type="checkbox" checked={t.status === "done"} onChange={(e) => toggle.mutate({ id: t.id, status: e.target.checked ? "done" : "todo" })} className="h-4 w-4" />
                    <span className={`flex-1 text-sm ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                    {t.is_deep_work && <span className="text-[10px] uppercase tracking-wider rounded-full bg-violet-500/15 text-violet-200 px-2 py-0.5">deep</span>}
                    <button
                      onClick={() => setLineage({ id: t.id, title: t.title })}
                      title="Lineage"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => remove.mutate(t.id)} className="text-muted-foreground hover:text-destructive text-xs">×</button>
                  </li>
                ))}
                {groups[col].length === 0 && <li className="text-xs text-muted-foreground py-2">Nothing here.</li>}
              </ul>
            </section>
          ))}
        </div>
      </div>
      {linearOpen && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
             onClick={() => setLinearOpen(false)}>
          <div className="w-full max-w-2xl rounded-xl border hairline bg-background shadow-2xl overflow-hidden"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b hairline">
              <div className="font-display text-sm tracking-tight">Import from Linear</div>
              <button onClick={() => setLinearOpen(false)} className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-secondary/60">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-3 border-b hairline space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input autoFocus value={linearQuery} onChange={(e) => setLinearQuery(e.target.value)}
                         placeholder="Filter by title…"
                         className="w-full bg-secondary/40 rounded-md pl-7 pr-2 py-1.5 text-sm outline-none focus:bg-secondary/60" />
                </div>
                <select value={linearTeam} onChange={(e) => setLinearTeam(e.target.value)}
                        className="bg-secondary/40 rounded-md px-2 py-1.5 text-xs outline-none">
                  <option value="">All teams</option>
                  {linearTeams.data?.teams?.map((t) => (
                    <option key={t.id} value={t.id}>{t.key} · {t.name}</option>
                  ))}
                </select>
              </div>
              <label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
                Only issues assigned to me
              </label>
            </div>
            <div className="max-h-96 overflow-auto">
              {linearIssues.isLoading && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" /> Searching Linear…
                </div>
              )}
              {linearIssues.isError && (
                <div className="px-4 py-4 text-xs text-destructive">{(linearIssues.error as Error)?.message}</div>
              )}
              {linearIssues.data?.issues?.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">No issues found.</div>
              )}
              {linearIssues.data?.issues?.map((i) => (
                <button key={i.id} disabled={mImportLinear.isPending}
                        onClick={() => mImportLinear.mutate(i.id)}
                        className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-secondary/60 disabled:opacity-50 border-b hairline last:border-b-0">
                  <span className="text-[10px] font-mono mt-1 px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{i.identifier}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{i.title}</span>
                    <span className="block text-[11px] text-muted-foreground">{i.state.name}{i.assignee ? ` · ${i.assignee.name}` : ""}</span>
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground mt-1" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <LineageDrawer
        open={Boolean(lineage)}
        onOpenChange={(o) => { if (!o) setLineage(null); }}
        kind="task"
        id={lineage?.id ?? null}
        title={lineage?.title}
      />
    </AppShell>
  );
}