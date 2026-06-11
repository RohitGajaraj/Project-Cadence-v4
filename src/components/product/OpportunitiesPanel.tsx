import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, FileText, Trash2, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { LineageDrawer } from "@/components/cadence/LineageDrawer";
import {
  listOpportunities,
  updateOpportunity,
  deleteOpportunity,
  generatePrd,
} from "@/lib/discovery.functions";
import { listLearnings } from "@/lib/outcome.functions";
import type { CriticReview } from "@/lib/discovery.functions";
import { CriticBadge } from "@/components/governance/CriticBadge";
import { useState } from "react";

const STATUSES = ["backlog", "now", "next", "later", "shipped", "dropped"] as const;

export function OpportunitiesPanel() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fOpps = useServerFn(listOpportunities);
  const mUpdate = useServerFn(updateOpportunity);
  const mDelete = useServerFn(deleteOpportunity);
  const mPrd = useServerFn(generatePrd);

  const fLearnings = useServerFn(listLearnings);

  const opps = useQuery({ queryKey: ["opportunities"], queryFn: () => fOpps() });
  const learningsQ = useQuery({ queryKey: ["learnings"], queryFn: () => fLearnings() });
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

  // opportunity_id -> latest learning (re-score evidence from the outcome loop)
  const learnings = learningsQ.data?.learnings ?? [];
  const latestLearning = new Map<string, (typeof learnings)[number]>();
  for (const l of learnings) {
    if (!l.opportunity_id) continue;
    const prev = latestLearning.get(l.opportunity_id);
    if (!prev || new Date(l.created_at) > new Date(prev.created_at)) {
      latestLearning.set(l.opportunity_id, l);
    }
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Ranked by ICE. Generate a PRD with one click when you're ready to build.
      </p>
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
                  {o.problem && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {o.problem}
                    </div>
                  )}
                  <div className="mt-1.5">
                    <CriticBadge
                      review={(o as { critic_review?: CriticReview | null }).critic_review ?? null}
                      target={{ kind: "opportunity", id: o.id }}
                      invalidateKey={["opportunities"]}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <span className="neural-text font-display text-base">
                    {Number(o.ice_score).toFixed(1)}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-2">
                    I{o.impact} C{o.confidence} E{o.ease}
                  </span>
                  {(() => {
                    const l = latestLearning.get(o.id);
                    if (!l || l.prior_ice == null || l.new_ice == null) return null;
                    const up = Number(l.new_ice) - Number(l.prior_ice) >= 0;
                    return (
                      <span
                        title={l.summary}
                        className={`ml-2 inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                          up
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-300 border-rose-500/30"
                        }`}
                      >
                        {up ? (
                          <ArrowUp className="h-2.5 w-2.5" />
                        ) : (
                          <ArrowDown className="h-2.5 w-2.5" />
                        )}
                        {Number(l.prior_ice).toFixed(1)} → {Number(l.new_ice).toFixed(1)}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={o.status}
                    onChange={(e) =>
                      upd.mutate({
                        id: o.id,
                        status: e.target.value as (typeof STATUSES)[number],
                      })
                    }
                    className="rounded-lg border hairline bg-background/60 px-2 py-1 text-xs capitalize"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  {(() => {
                    const isPrdPending = prd.isPending && prd.variables === o.id;
                    const isDelPending = del.isPending && del.variables === o.id;
                    return (
                      <>
                        <button
                          onClick={() => prd.mutate(o.id)}
                          disabled={isPrdPending}
                          className="btn-agentic rounded-lg px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5"
                        >
                          <FileText className="h-3 w-3" />{" "}
                          {isPrdPending ? "Generating…" : "Generate PRD"}
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
                          disabled={isDelPending}
                          className="ml-2 text-muted-foreground hover:text-destructive p-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    );
                  })()}
                </td>
              </tr>
            ))}
            {all.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-xs text-muted-foreground">
                  No opportunities yet. Promote a theme from the Signals tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <LineageDrawer
        open={lineage !== null}
        onOpenChange={(o) => {
          if (!o) setLineage(null);
        }}
        kind="opportunity"
        id={lineage?.id ?? null}
        title={lineage?.title}
      />
    </>
  );
}
