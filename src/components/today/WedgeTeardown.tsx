// WEDGE (Critic-teardown first-run) — the felt entry on a cold-start Today.
//
// Engine-Room: names the outcome ("see why your idea might be wrong, with
// receipts"), not the mechanism. The operator types a feature they believe in;
// the Critic red-teams it and the verdict lands inline in the same session. No
// source connection or data setup is required, which is the whole point of the
// first-run: value before any wiring.
//
// State machine lives in this component (form → result), so the teardown stays
// visible even though running it creates the workspace's first opportunity. We
// deliberately do NOT invalidate the ["cold-start"] query here — flipping isCold
// would unmount this card and throw away the verdict the operator just earned.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Link2,
  Share2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
} from "lucide-react";
import { toast } from "@/lib/notify";
import { useWorkspace } from "@/hooks/use-workspace";
import { runWedgeTeardown, type CriticReview } from "@/lib/discovery.functions";
import { classifyWedgeFailure, type WedgeFailure } from "@/lib/wedge-cold";
import { getTeardownShareState, setTeardownShared } from "@/lib/opportunities-share.functions";
import { VerdictChip, type VerdictTone } from "@/components/cadence/Primitives";

const VERDICT: Record<
  CriticReview["verdict"],
  { label: string; tone: VerdictTone; Icon: typeof ShieldCheck; line: string }
> = {
  ship: {
    label: "Ship",
    tone: "moss",
    Icon: ShieldCheck,
    line: "The bet holds up. The risks below are bounded, not blocking.",
  },
  revise: {
    label: "Revise",
    tone: "ember",
    Icon: ShieldAlert,
    line: "Worth pursuing, but not as framed. Close these gaps before you commit.",
  },
  kill: {
    label: "Kill",
    tone: "madder",
    Icon: ShieldX,
    line: "The Critic would not build this as it stands. Here is why.",
  },
};

type Result = { opportunity: { id: string; title: string }; review: CriticReview | null };

export function WedgeTeardown() {
  const { activeProductId } = useWorkspace();
  const qc = useQueryClient();
  const fRun = useServerFn(runWedgeTeardown);

  const [idea, setIdea] = useState("");
  const [problem, setProblem] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  // A hard run failure (gateway throwing, network, DB), classified into a calm
  // first-run message instead of a raw toast — the form stays intact for retry.
  const [failure, setFailure] = useState<WedgeFailure | null>(null);

  const run = useMutation({
    mutationFn: () =>
      fRun({
        data: {
          idea: idea.trim(),
          problem: problem.trim() || undefined,
          target_user: targetUser.trim() || undefined,
          project_id: activeProductId ?? undefined,
        },
      }),
    onMutate: () => setFailure(null),
    onSuccess: (r) => {
      setResult(r as Result);
      // Keep the opportunity views consistent, but NOT cold-start (see header).
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      if ((r as Result).review) toast.success("Your teardown is ready.");
      else toast.success("Idea saved. The Critic will run when the gateway is reachable.");
    },
    onError: (e: Error) => setFailure(classifyWedgeFailure(e.message)),
  });

  function reset() {
    setResult(null);
    setIdea("");
    setProblem("");
    setTargetUser("");
    setFailure(null);
  }

  if (result) {
    return <Teardown result={result} onAnother={reset} />;
  }

  const canRun = idea.trim().length >= 3 && !run.isPending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 2px" }}>
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 17,
            fontWeight: 600,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          <Sparkles size={15} strokeWidth={1.75} style={{ color: "var(--ember)" }} />
          See why your idea might be wrong.
        </div>
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-muted)",
            marginTop: 6,
            maxWidth: 580,
            lineHeight: 1.5,
          }}
        >
          Name a feature you believe in. The Critic red-teams it and hands back the real risks, the
          conditions that would kill it, and what you cannot prove yet. No setup, no sources to
          connect. Just an honest second opinion before you spend a sprint on it.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 580 }}>
        <Field label="The idea">
          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={200}
            placeholder="e.g. Add an AI summary to the top of every report"
            className="wedge-input"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canRun) run.mutate();
            }}
          />
        </Field>
        <Field label="The problem it solves" optional>
          <textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Who is hurting, and how? One or two sentences is plenty."
            style={{ ...inputStyle, resize: "vertical", minHeight: 52 }}
          />
        </Field>
        <Field label="Who it is for" optional>
          <input
            value={targetUser}
            onChange={(e) => setTargetUser(e.target.value)}
            maxLength={200}
            placeholder="The user or segment this is for"
            style={inputStyle}
          />
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
          <button
            onClick={() => run.mutate()}
            disabled={!canRun}
            className="btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              color: "white",
              background: "var(--ember)",
              opacity: canRun ? 1 : 0.55,
              cursor: canRun ? "pointer" : "default",
              transition: "opacity 120ms ease",
            }}
          >
            {run.isPending ? "Tearing it down…" : "Run the teardown"}
            {!run.isPending && <ArrowRight size={13} strokeWidth={2} />}
          </button>
          <span className="mono-label" style={{ fontSize: 9.5, color: "var(--ink-faint)" }}>
            Takes about a minute
          </span>
        </div>

        {failure && (
          <div
            role="alert"
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "var(--surface-1)",
              border: `1px solid ${failure.kind === "other" ? "var(--rose)" : "var(--hairline)"}`,
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "var(--ink-muted)",
            }}
          >
            {failure.note}
          </div>
        )}
      </div>
    </div>
  );
}

function Teardown({ result, onAnother }: { result: Result; onAnother: () => void }) {
  const { opportunity, review } = result;

  if (!review) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 2px" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
          Saved. The Critic could not run just now.
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", maxWidth: 560, lineHeight: 1.5 }}>
          Your idea is recorded as an opportunity. The red-team needs the AI gateway, which is not
          reachable in this environment. Open the opportunity to run it again once the gateway is
          live.
        </p>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Link
            to="/product"
            search={{ tab: "opportunities" }}
            className="btn btn-sm"
            style={{ color: "var(--action-blue)", fontWeight: 600 }}
          >
            Open the opportunity
            <ArrowRight size={12} strokeWidth={2} style={{ marginLeft: 4 }} />
          </Link>
          <button
            onClick={onAnother}
            className="mono-label"
            style={{ color: "var(--ink-faint)", fontSize: 10 }}
          >
            Try another idea
          </button>
        </div>
      </div>
    );
  }

  const v = VERDICT[review.verdict];
  const Icon = v.Icon;

  return (
    <div
      className="fade-up"
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 2px" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Icon size={18} strokeWidth={1.75} style={{ color: `var(--${v.tone})` }} />
          <VerdictChip tone={v.tone} style={{ fontSize: 11 }}>
            {v.label}
          </VerdictChip>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            on "{opportunity.title}"
          </span>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--ink)", maxWidth: 620, lineHeight: 1.5 }}>
          {review.summary || v.line}
        </p>
      </div>

      <Section title="Risks" items={review.risks} empty="No material risks flagged." />
      <Section
        title="What would kill it"
        items={review.kill_criteria}
        empty="No kill criteria proposed."
      />
      <Section
        title="What you cannot prove yet"
        items={review.missing_evidence}
        empty="No evidence gaps called out."
      />

      {/* PLG Phase 4 · the viral nudge — frames why to share, right above the
          existing Share button, closing the loop back to the public /t/$slug
          page (where a viewer meets the pre-signup CTA). */}
      <div
        style={{
          marginTop: 2,
          padding: "11px 13px",
          borderRadius: 10,
          background: "var(--surface-1)",
          border: "1px solid var(--hairline)",
          fontSize: 12,
          lineHeight: 1.55,
          color: "var(--ink-muted)",
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>Worth sharing?</span> Publishing this
        teardown gives you a public link anyone can read without an account. It is the fastest way
        to put your thinking where the right people will see it.
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          paddingTop: 4,
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <span className="mono-label" style={{ fontSize: 9.5, color: "var(--ink-faint)" }}>
          Confidence {(review.confidence * 100).toFixed(0)}% · saved to your opportunities
        </span>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <ShareTeardownButton id={opportunity.id} />
          <Link
            to="/product"
            search={{ tab: "opportunities" }}
            className="btn btn-sm"
            style={{ color: "var(--action-blue)", fontWeight: 600 }}
          >
            Take it further
            <ArrowRight size={12} strokeWidth={2} style={{ marginLeft: 4 }} />
          </Link>
          <button
            onClick={onAnother}
            className="mono-label"
            style={{ color: "var(--ink-faint)", fontSize: 10 }}
          >
            Tear down another
          </button>
        </div>
      </div>
    </div>
  );
}

function copyTeardownLink(slug: string) {
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/t/${slug}`;
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Public link copied"),
      () => toast.message(url),
    );
  } else {
    toast.message(url);
  }
}

/** Share / Unshare this teardown + copy its public /t/<slug> link (F-SHARE-TEARDOWN,
 *  the viral loop). Mirrors ShareDecisionButton. Pre-migration tolerant: before the
 *  share columns land it shows a quiet "after sync" hint. */
function ShareTeardownButton({ id }: { id: string }) {
  const qc = useQueryClient();
  const fState = useServerFn(getTeardownShareState);
  const fSet = useServerFn(setTeardownShared);

  const state = useQuery({
    queryKey: ["teardown-share", id],
    queryFn: () => fState({ data: { id } }),
  });
  const toggle = useMutation({
    mutationFn: (isPublic: boolean) => fSet({ data: { id, isPublic } }),
    onSuccess: (res) => {
      qc.setQueryData(["teardown-share", id], res);
      if (res.is_public && res.share_slug) copyTeardownLink(res.share_slug);
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
        title="Make this teardown public and copy a shareable link"
      >
        <Share2 size={11} /> Share
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => s.share_slug && copyTeardownLink(s.share_slug)}
        title="Copy the public link"
      >
        <Link2 size={11} /> Copy link
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

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        className="mono-label"
        style={{ fontSize: 9.5, color: "var(--ink-faint)", letterSpacing: "0.14em" }}
      >
        {label}
        {optional && <span style={{ opacity: 0.6 }}> · optional</span>}
      </span>
      {children}
    </label>
  );
}

function Section({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <div
        className="mono-label"
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          color: "var(--ink-muted)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{empty}</p>
      ) : (
        <ul
          style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 16, margin: 0 }}
        >
          {items.map((it, i) => (
            <li key={i} style={{ fontSize: 13, lineHeight: 1.45, color: "var(--ink)" }}>
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  fontSize: 13,
  color: "var(--ink)",
  background: "var(--canvas)",
  border: "1px solid var(--hairline)",
  borderRadius: 8,
  outline: "none",
};
