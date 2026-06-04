import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Trash2, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { LineageDrawer } from "@/components/cadence/LineageDrawer";
import { listProjects } from "@/lib/projects.functions";
import { listOpportunities, updateOpportunity, deleteOpportunity, generatePrd } from "@/lib/discovery.functions";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/opportunities")({
  component: OppsPage,
  head: () => ({ meta: [{ title: "Opportunities · Cadence" }] }),
});

const STATUSES = ["backlog", "now", "next", "later", "shipped", "dropped"] as const;

function OppsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fProjects = useServerFn(listProjects);
  const fOpps = useServerFn(listOpportunities);
  const mUpdate = useServerFn(updateOpportunity);
  const mDelete = useServerFn(deleteOpportunity);
  const mPrd = useServerFn(generatePrd);

  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });
  const opps = useQuery({ queryKey: ["opportunities"], queryFn: () => fOpps() });
  const inv = () => qc.invalidateQueries({ queryKey: ["opportunities"] });

  const upd = useMutation({
    mutationFn: (d: { id: string; status: (typeof STATUSES)[number] }) => mUpdate({ data: d }),
    onSuccess: inv,
  });
  const del = useMutation({
    mutationFn: (id: string) => mDelete({ data: { id } }),
    onSuccess: inv,
  });
  const prd = useMutation({
    mutationFn: (opportunity_id: string) => mPrd({ data: { opportunity_id } }),
    onSuccess: (r) => {
      toast.success("PRD generated");
      qc.invalidateQueries({ queryKey: ["prds"] });
      if (r.prd?.id) navigate({ to: "/prds/$id", params: { id: r.prd.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = opps.data?.opportunities ?? [];
  const [lineage, setLineage] = useState<{ id: string; title: string } | null>(null);

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Phase 2 · Reasoning engine</div>
          <h1 className="mt-3 font-display text-4xl tracking-tight">
            <span className="neural-text">Opportunities</span> backlog
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Ranked by ICE. Generate a PRD with one click when you're ready to build.
          </p>
        </header>

        <div className="bento overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr className="border-b hairline">
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3 w-24">ICE</th>
                <th className="text-left px-4 py-3 w-36">Status</th>
                <th className="text-right px-4 py-3 w-52">Actions</th>
              </tr>
            </thead>
            <tbody>
              {all.map((o) => (
                <tr key={o.id} className="border-b hairline/40 hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.title}</div>
                    {o.problem && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{o.problem}</div>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <span className="neural-text font-display text-base">{Number(o.ice_score).toFixed(1)}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">I{o.impact} C{o.confidence} E{o.ease}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      onChange={(e) => upd.mutate({ id: o.id, status: e.target.value as (typeof STATUSES)[number] })}
                      className="rounded-lg border hairline bg-background/60 px-2 py-1 text-xs capitalize"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => prd.mutate(o.id)}
                      disabled={prd.isPending}
                      className="btn-agentic rounded-lg px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <FileText className="h-3 w-3" /> {prd.isPending ? "Generating…" : "Generate PRD"}
                    </button>
                    <button
                      onClick={() => setLineage({ id: o.id, title: o.title })}
                      className="ml-2 text-muted-foreground hover:text-foreground p-1.5"
                      aria-label="Lineage"
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => del.mutate(o.id)}
                      className="ml-2 text-muted-foreground hover:text-destructive p-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {all.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-xs text-muted-foreground">
                  No opportunities yet. Promote a theme from <a href="/discovery" className="underline">Discovery</a>.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <LineageDrawer
        open={lineage !== null}
        onOpenChange={(o) => { if (!o) setLineage(null); }}
        kind="opportunity"
        id={lineage?.id ?? null}
        title={lineage?.title}
      />
    </AppShell>
  );
}