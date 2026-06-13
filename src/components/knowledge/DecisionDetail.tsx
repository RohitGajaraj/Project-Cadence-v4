// DecisionDetail — Knowledge → Decisions drill-down (screen 6 of the Ember
// Editorial migration), ported from design-reference/cadence/loop-detail.jsx
// (DecisionDetail) onto the production DecisionRow contract. Replaces the old
// DecisionsPanel side sheet (founder ruling: one detail surface — reference
// layout wins, production mutations kept). Drill state rides ?decision= on
// /knowledge; the detail replaces only the tab body. Shares the panel's
// ["decisions", …] query cache. The shared vocabulary comes from
// decisions-shared.ts and SourceLink from DecisionsPanel — single source.
// Reference elements omitted for lack of real data: "cited by agents N×
// since" (no citation data), the separate Context block + trace id (rationale
// is the only prose field), and the Alternatives-considered list.
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, Share2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { listDecisions, updateDecision, type DecisionSource } from "@/lib/decisions.functions";
import { getDecisionShareState, setDecisionShared } from "@/lib/decisions-share.functions";
import { DrillHeader, MonoLabel, VerdictChip } from "@/components/cadence/Primitives";
import { SourceLink } from "@/components/knowledge/DecisionsPanel";
import { ageOf, displayWho, hasSource, SOURCE_LABEL, STATUS_TONE } from "./decisions-shared";

function copyDecisionLink(slug: string) {
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/d/${slug}`;
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Public link copied"),
      () => toast.message(url),
    );
  } else {
    toast.message(url);
  }
}

/** Share / Unshare a decision + copy its public /d/<slug> link. Pre-migration
 *  tolerant: before the share columns land it shows a quiet "after sync" hint. */
function ShareDecisionButton({ id }: { id: string }) {
  const qc = useQueryClient();
  const fState = useServerFn(getDecisionShareState);
  const fSet = useServerFn(setDecisionShared);

  const state = useQuery({
    queryKey: ["decision-share", id],
    queryFn: () => fState({ data: { id } }),
  });
  const toggle = useMutation({
    mutationFn: (isPublic: boolean) => fSet({ data: { id, isPublic } }),
    onSuccess: (res) => {
      qc.setQueryData(["decision-share", id], res);
      if (res.is_public && res.share_slug) copyDecisionLink(res.share_slug);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = state.data;
  if (!s) return null;
  if (!s.available) {
    return (
      <span
        className="mono-label"
        style={{ fontSize: 9, color: "var(--ink-faint)" }}
        title="Sharing lights up after the next sync applies the share columns."
      >
        share · after sync
      </span>
    );
  }
  if (!s.is_public) {
    return (
      <button
        className="btn btn-ghost btn-sm"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(true)}
        title="Make this decision public and copy a shareable link"
      >
        <Share2 size={11} /> Share
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => s.share_slug && copyDecisionLink(s.share_slug)}
        title="Copy the public link"
      >
        <LinkIcon size={11} /> Copy link
      </button>
      <button
        className="btn btn-ghost btn-sm"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(false)}
        title="Make private again"
      >
        Unshare
      </button>
    </span>
  );
}

export function DecisionDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fList = useServerFn(listDecisions);
  const fUpdate = useServerFn(updateDecision);

  const decisions = useQuery({
    queryKey: ["decisions", "all"],
    queryFn: () => fList({ data: {} }),
  });

  const update = useMutation({
    mutationFn: (data: { id: string; status: "approved" | "rejected" | "pending" }) =>
      fUpdate({ data }),
    onSuccess: () => {
      // Prefix invalidation covers ["decisions", "all"] and every panel filter key.
      qc.invalidateQueries({ queryKey: ["decisions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onBack = () => navigate({ to: "/knowledge", search: { tab: "decisions" } });

  if (decisions.isLoading) {
    return (
      <div
        style={{
          padding: "18px 2px",
          textAlign: "center",
          fontSize: 12.5,
          color: "var(--ink-faint)",
        }}
      >
        Loading decision…
      </div>
    );
  }

  const d = decisions.data?.decisions.find((x) => x.id === id);
  if (!d) {
    return (
      <div className="bento" style={{ padding: "var(--card-pad)" }}>
        <MonoLabel style={{ marginBottom: 10 }}>
          decision not found — it may have been removed
        </MonoLabel>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          Back · all decisions
        </button>
      </div>
    );
  }

  const sourceNoun = d.mission_id ? "mission" : d.prd_id ? "spec" : d.meeting_id ? "meeting" : null;

  return (
    <div className="fade-up">
      <DrillHeader
        onBack={onBack}
        backLabel="All decisions"
        kicker={`Decision · ${ageOf(d.created_at)} · ${displayWho(d.decided_by_agent_slug)}`}
        title={d.title}
        right={
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ShareDecisionButton id={d.id} />
            {hasSource(d) && sourceNoun ? (
              <SourceLink d={d} className="btn btn-ghost btn-sm">
                <ExternalLink size={11} /> Open {sourceNoun}
              </SourceLink>
            ) : null}
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 8 }}>Why</MonoLabel>
          <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: 0, lineHeight: 1.6 }}>
            {d.rationale ?? "No rationale captured."}
          </p>
          <p className="mono-label" style={{ fontSize: 8.5, marginTop: 12 }}>
            source · {SOURCE_LABEL[(d.source_kind ?? "manual") as DecisionSource]}
            {d.source_label ? ` · ${d.source_label}` : ""}
          </p>
        </div>
        <div className="bento" style={{ padding: "var(--card-pad)" }}>
          <MonoLabel style={{ marginBottom: 10 }}>Verdict · the human's call</MonoLabel>
          <div style={{ display: "flex", gap: 6 }}>
            {(["approved", "rejected", "pending"] as const).map((s) => (
              <button key={s} onClick={() => update.mutate({ id: d.id, status: s })}>
                <VerdictChip tone={STATUS_TONE[s]} selected={d.status === s}>
                  {s}
                </VerdictChip>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 12 }}>
            Agents read this before any mission that touches the same surface — decisions are
            working memory, not minutes.
          </p>
        </div>
      </div>
    </div>
  );
}
