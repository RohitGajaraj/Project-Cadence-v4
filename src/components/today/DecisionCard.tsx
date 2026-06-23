// v6 Phase 0 / W3 — the decision-first card (Appendix D), the highest-leverage
// surface on Today. It ENRICHES the existing "Needs you" calls queue
// (getNeedsYou → src/lib/today.functions.ts); it is not a greenfield list.
//
// Each call is framed as the decision a human must make, leading with the call
// itself, then the evidence + Critic challenge, then — only when wired — the
// blast radius, reversibility, cost, and model. Claim never outruns wiring:
// gates have no Critic verdict, so they show the agent's rationale; cost/model
// render only when ai_events recorded them.
//
// Shapes:
//   • gate   — a tool-call approval (Approve / Reject+reason / blast radius)
//   • prd/opp — a review call (Open + Critic verdict via CriticBadge)
import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  ShieldAlert,
  Undo2,
  X,
} from "lucide-react";
import { StepDot } from "@/components/cadence/Primitives";
import { CriticBadge } from "@/components/governance/CriticBadge";
import { agentDisplayName } from "@/lib/agent-vocabulary";
import { formatTrackRecord, type AgentTrackRecord } from "@/lib/agent-track-record";
import {
  toolConsequence,
  toolRisk,
  REVERSIBILITY_LABEL,
  RISK_LABEL,
  type Reversibility,
} from "@/lib/tool-consequences";
import type { CriticReview } from "@/lib/discovery.functions";

export type DecisionGateItem = {
  kind: "gate";
  id: string;
  agentSlug: string;
  toolName: string;
  rationale: string | null;
  traceId: string | null;
  model: string | null;
  estCostUsd: number | null;
  expiresAt: string | null;
  escalationState: string;
  /** CORE-UX-TRUST: this agent's decided-approval standing, or null when it has
   *  no history yet. Surfaced inline so trust lives at the point of decision. */
  track?: AgentTrackRecord | null;
};

export type DecisionReviewItem = {
  kind: "prd" | "opp";
  id: string;
  title: string;
  critic: CriticReview | null;
};

export type DecisionItem = DecisionGateItem | DecisionReviewItem;

type Props = {
  item: DecisionItem;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string | null) => void;
  onDefer: (id: string) => void;
  isDeciding: boolean;
};

const REVERSIBILITY_COLOR: Record<Reversibility, string> = {
  reversible: "var(--ink-faint)",
  partial: "var(--ember)",
  irreversible: "var(--rose)",
};

const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "12px 14px",
  border: "1px solid var(--hairline)",
  borderRadius: 8,
  background: "var(--canvas)",
};

function fmtCost(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function fmtExpiry(iso: string, expired: boolean): string {
  if (expired) return "expired";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** A quiet mono chip used for reversibility / cost·model meta. */
function MetaChip({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <span
      className="mono-label"
      style={{
        fontSize: 9.5,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        color: color ?? "var(--ink-faint)",
      }}
    >
      {children}
    </span>
  );
}

export function DecisionCard({ item, onApprove, onReject, onDefer, isDeciding }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  if (item.kind === "gate") {
    const c = toolConsequence(item.toolName);
    const agent = agentDisplayName(item.agentSlug);
    const expired = item.escalationState === "expired";
    const trackLabel = formatTrackRecord(item.track);
    return (
      <div className="fade-up lift" style={cardStyle}>
        {/* Header: who + the call */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <StepDot status="gate" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono-label" style={{ color: "var(--agent)", fontSize: 10 }}>
              {agent}
              {trackLabel && (
                <span
                  style={{ color: "var(--ink-faint)" }}
                  title="This agent's decided-approval record across your past gates"
                >
                  {" "}
                  · {trackLabel}
                </span>
              )}{" "}
              · needs your approval · {item.toolName}
            </div>
            <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 600, marginTop: 2 }}>
              {c.effect}
            </div>
          </div>
          {item.expiresAt && (
            <MetaChip color={expired ? "var(--rose)" : undefined}>
              <Clock size={10} strokeWidth={1.75} />
              {fmtExpiry(item.expiresAt, expired)}
            </MetaChip>
          )}
        </div>

        {/* Meta row: reversibility · cost · model · evidence toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            paddingLeft: 22,
          }}
        >
          <MetaChip color={REVERSIBILITY_COLOR[c.reversible]}>
            <Undo2 size={10} strokeWidth={1.75} />
            {REVERSIBILITY_LABEL[c.reversible]}
          </MetaChip>
          {toolRisk(item.toolName) === "high" && (
            <MetaChip color="var(--rose)">
              <ShieldAlert size={10} strokeWidth={1.75} />
              {RISK_LABEL.high}
            </MetaChip>
          )}
          {item.estCostUsd != null && <MetaChip>{fmtCost(item.estCostUsd)}</MetaChip>}
          {item.model && <MetaChip>{item.model}</MetaChip>}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mono-label"
            style={{
              fontSize: 9.5,
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              color: "var(--action-blue)",
              background: "transparent",
            }}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {expanded ? "Less" : "Why · what happens"}
          </button>
        </div>

        {/* Expanded: evidence + blast radius + undo */}
        {expanded && (
          <div
            className="fade-up"
            style={{
              marginLeft: 22,
              padding: "8px 12px",
              borderRadius: 6,
              background: "var(--surface-2)",
              fontSize: 12,
              color: "var(--ink-muted)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {item.rationale && (
              <div>
                <span className="mono-label" style={{ fontSize: 9 }}>
                  Evidence ·{" "}
                </span>
                {item.rationale}
              </div>
            )}
            <div>
              <span className="mono-label" style={{ fontSize: 9 }}>
                If you approve ·{" "}
              </span>
              {c.effect}
            </div>
            <div>
              <span className="mono-label" style={{ fontSize: 9 }}>
                Undo ·{" "}
              </span>
              {c.undo}
            </div>
          </div>
        )}

        {/* Actions */}
        {rejecting ? (
          <div style={{ marginLeft: 22, display: "flex", flexDirection: "column", gap: 6 }}>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you rejecting? (optional — the agent learns from it)"
              rows={2}
              className="scrollbar-thin"
              style={{
                width: "100%",
                resize: "vertical",
                fontSize: 12.5,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid var(--hairline)",
                background: "var(--canvas)",
                color: "var(--ink)",
              }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn btn-reject btn-sm disabled:opacity-60"
                disabled={isDeciding}
                onClick={() => onReject(item.id, reason.trim() || null)}
              >
                <X size={11} strokeWidth={1.75} />
                Reject · nothing runs
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setRejecting(false);
                  setReason("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginLeft: 22, display: "flex", gap: 6, alignItems: "center" }}>
            <button
              className="btn btn-approve btn-sm disabled:opacity-60"
              disabled={isDeciding}
              onClick={() => onApprove(item.id)}
            >
              <Check size={11} strokeWidth={1.75} />
              Approve · run {item.toolName}
            </button>
            <button
              className="btn btn-reject btn-sm disabled:opacity-60"
              disabled={isDeciding}
              onClick={() => setRejecting(true)}
            >
              <X size={11} strokeWidth={1.75} />
              Reject
            </button>
            <button
              className="mono-label"
              style={{
                fontSize: 9.5,
                color: "var(--ink-faint)",
                marginLeft: "auto",
                background: "transparent",
              }}
              onClick={() => onDefer(item.id)}
              title="Not now — clears the call from today's queue"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    );
  }

  // Review call (prd / opp) — the call is to review; Critic verdict is the lever.
  const isPrd = item.kind === "prd";
  const question = isPrd ? `Ship the spec: ${item.title}?` : `Keep or kill: ${item.title}?`;
  const openTo = isPrd ? "/prds/$id" : "/product";
  return (
    <div className="fade-up lift" style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <StepDot status="gate" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono-label" style={{ color: "var(--agent)", fontSize: 10 }}>
            {isPrd ? "Spec · needs your call" : "Opportunity · Critic challenged"}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 600, marginTop: 2 }}>
            {question}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 22 }}>
        <CriticBadge
          review={item.critic}
          target={{ kind: isPrd ? "prd" : "opportunity", id: item.id }}
          invalidateKey={["needs-you"]}
        />
        {isPrd ? (
          <Link
            to={openTo}
            params={{ id: item.id }}
            className="btn btn-sm"
            style={{ color: "var(--action-blue)" }}
          >
            <ExternalLink size={12} strokeWidth={1.75} /> Open spec
          </Link>
        ) : (
          <Link
            to={openTo}
            search={{ tab: "opportunities" }}
            className="btn btn-sm"
            style={{ color: "var(--action-blue)" }}
          >
            <ExternalLink size={12} strokeWidth={1.75} /> Open
          </Link>
        )}
        <button
          className="mono-label"
          style={{
            fontSize: 9.5,
            color: "var(--ink-faint)",
            marginLeft: "auto",
            background: "transparent",
          }}
          onClick={() => onDefer(item.id)}
          title="Not now — clears the call from today's queue"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
