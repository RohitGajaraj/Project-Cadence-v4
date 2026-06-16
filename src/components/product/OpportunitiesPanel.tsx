// Opportunities tab — ported 1:1 from design-reference/cadence/loop.jsx
// (ProductScreen, tab "Opportunities"): ranked bento rows with a big serif
// rank number (ember for #1), title + status chip + rescore pill, rationale
// line, mono ICE-input labels, the big serif ICE score with its mono caption,
// "Generate PRD" primary and a lineage ghost icon. Production functionality
// kept: status updates, CriticBadge, delete, LineageDrawer, rescore evidence
// from the real outcome loop (listLearnings), navigation to the drafted PRD.
// Screen 6: each row is a click target opening the ?opp= drill
// (OpportunityDetail — full ICE breakdown, rescore history, lineage);
// interactive children stop propagation so their actions don't open it.
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { GitBranch, Lightbulb, Trash2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { EmptyState, VerdictChip } from "@/components/cadence/Primitives";
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
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => mDelete({ data: { id } }),
    onSuccess: inv,
    onError: (e: Error) => toast.error(e.message),
  });
  const prd = useMutation({
    mutationFn: (v: { id: string; title: string }) => mPrd({ data: { opportunity_id: v.id } }),
    onSuccess: (r, v) => {
      toast.success(`PRD generated for “${v.title}”. Critic reviewed it.`);
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

  if (opps.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load opportunities
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(opps.error as Error).message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => opps.refetch()}
        >
          Retry · reloads the queue
        </button>
      </div>
    );
  }

  if (opps.isLoading) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Loading opportunities…
      </div>
    );
  }

  if (all.length === 0) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="No opportunities yet"
        body="Promote a clustered theme from Signals — it lands here scored by ICE, with the Critic's read attached."
        cta="Go to Signals · capture and cluster"
        onCta={() => navigate({ to: "/product", search: { tab: "signals" } })}
      />
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {all.map((o, i) => {
          const l = latestLearning.get(o.id);
          const hasRescore = l && l.prior_ice != null && l.new_ice != null;
          const up = hasRescore && Number(l.new_ice) >= Number(l.prior_ice);
          const isPrdPending = prd.isPending && prd.variables?.id === o.id;
          const isDelPending = del.isPending && del.variables === o.id;
          return (
            <div
              key={o.id}
              className="bento lift"
              role="button"
              tabIndex={0}
              onClick={() =>
                navigate({ to: "/product", search: { tab: "opportunities", opp: o.id } })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  navigate({ to: "/product", search: { tab: "opportunities", opp: o.id } });
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 18px",
                cursor: "pointer",
              }}
            >
              <span
                className="font-display tabular-nums"
                style={{
                  fontSize: 22,
                  width: 26,
                  textAlign: "center",
                  color: i === 0 ? "var(--ember)" : "var(--ink-faint)",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 550 }}>{o.title}</span>
                  <select
                    className="mono-label"
                    value={o.status}
                    aria-label="Lane"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      upd.mutate({ id: o.id, status: e.target.value as (typeof STATUSES)[number] })
                    }
                    style={{
                      fontSize: 9,
                      background: "transparent",
                      border: "1px solid var(--hairline)",
                      borderRadius: 99,
                      padding: "1px 7px",
                      cursor: "pointer",
                      appearance: "none",
                    }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {hasRescore ? (
                    <VerdictChip
                      tone={up ? "moss" : "madder"}
                      style={{ fontSize: 8.5, padding: "0 7px" }}
                    >
                      <span
                        className="tabular-nums"
                        title={l.summary ?? "Re-scored by the outcome loop"}
                      >
                        {Number(l.prior_ice).toFixed(1)} → {Number(l.new_ice).toFixed(1)}
                      </span>
                    </VerdictChip>
                  ) : null}
                  <span onClick={(e) => e.stopPropagation()}>
                    <CriticBadge
                      review={(o as { critic_review?: CriticReview | null }).critic_review ?? null}
                      target={{ kind: "opportunity", id: o.id }}
                      invalidateKey={["opportunities"]}
                    />
                  </span>
                </div>
                {o.problem ? (
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--ink-subtle)",
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {o.problem}
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 14, flexShrink: 0, alignItems: "center" }}>
                <span className="mono-label">
                  impact <strong style={{ color: "var(--ink)" }}>{o.impact}</strong>
                </span>
                <span className="mono-label">
                  conf <strong style={{ color: "var(--ink)" }}>{o.confidence}</strong>
                </span>
                <span className="mono-label">
                  ease <strong style={{ color: "var(--ink)" }}>{o.ease}</strong>
                </span>
                <span title="ICE · impact, confidence, ease" style={{ textAlign: "right" }}>
                  <span
                    className="font-display tabular-nums"
                    style={{ fontSize: 15, display: "block" }}
                  >
                    {Number(o.ice_score).toFixed(1)}
                  </span>
                  <span className="mono-label" style={{ fontSize: 7.5 }}>
                    ICE
                  </span>
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={isPrdPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    prd.mutate({ id: o.id, title: o.title });
                  }}
                >
                  {isPrdPending ? "Generating…" : "Generate PRD"}
                </button>
                <button
                  title="Signal lineage"
                  aria-label="Signal lineage"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: "4px 7px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLineage({ id: o.id, title: o.title });
                  }}
                >
                  <GitBranch size={12} />
                </button>
                <button
                  title="Delete · removes the opportunity"
                  aria-label="Delete opportunity"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: "4px 7px", color: "var(--rose)" }}
                  disabled={isDelPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    del.mutate(o.id);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
        <p className="mono-label" style={{ fontSize: 8.5, textAlign: "center", marginTop: 4 }}>
          outcome loop re-scores after every release
        </p>
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
