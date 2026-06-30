import type { CSSProperties } from "react";
import type { StudioApproval, StudioRunDetail } from "@/lib/studio.functions";
import { ApprovalCard } from "./ApprovalCard";
import { StatusIcon, StatusChip } from "./studio-ui";
import { fmtCost, summarizeArgs } from "./studio-format";

type LoopStep = StudioRunDetail["steps"][number];
type Steer = { id: string; message: string; created_at: string; consumed: boolean };

/* The missions TraceHop rail — step lines hang off a hairline left rail. */
const rail: CSSProperties = {
  paddingLeft: 22,
  borderLeft: "1px solid var(--hairline)",
  marginLeft: 5,
};
const stepLine: CSSProperties = {
  ...rail,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  lineHeight: 1.8,
  display: "flex",
  gap: 8,
};
const stepNum: CSSProperties = {
  width: 18,
  textAlign: "right",
  flexShrink: 0,
  color: "var(--ink-faint)",
};

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function StepLine({ step, idx }: { step: LoopStep; idx: number }) {
  if (step.kind === "thought") {
    return (
      <div style={stepLine}>
        <span className="tabular-nums" style={stepNum}>
          {idx + 1}.
        </span>
        <span
          style={{
            minWidth: 0,
            color: "var(--ink-faint)",
            fontStyle: "italic",
            wordBreak: "break-word",
          }}
        >
          thought · {step.text}
        </span>
      </div>
    );
  }
  if (step.kind === "tool_call") {
    // madder only on real failure outcomes (error / denied); orchid only on
    // the tool identifier — the agent-action law.
    const failed = step.status === "error" || step.status === "denied";
    return (
      <div style={stepLine}>
        <span className="tabular-nums" style={stepNum}>
          {idx + 1}.
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{ color: "var(--agent)", fontWeight: 600 }}>{step.name}</span>
          {step.status !== "executed" ? (
            <span style={{ color: failed ? "var(--rose)" : "var(--ink-muted)" }}>
              {" "}
              · {step.status}
            </span>
          ) : null}
          <div
            className="line-clamp-1 break-words"
            style={{ color: step.error ? "var(--rose)" : "var(--ink-muted)" }}
          >
            {step.error
              ? `error: ${step.error}`
              : summarizeArgs((step.args ?? {}) as Record<string, unknown>)}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...rail, display: "flex", gap: 8 }}>
      <span className="mono-label tabular-nums" style={{ ...stepNum, marginTop: 3 }}>
        {idx + 1}.
      </span>
      <p
        style={{
          minWidth: 0,
          flex: 1,
          margin: 0,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: "var(--ink-muted)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {step.message}
      </p>
    </div>
  );
}

function RunBlock({ run, index }: { run: StudioRunDetail; index: number }) {
  const live = run.status === "running" || run.status === "queued";
  const footer = [run.model, `${run.tokens.toLocaleString()} tok`, fmtCost(run.cost_usd)]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="bento" style={{ padding: "var(--card-pad)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <StatusIcon s={run.status} />
        <span className="mono-label" style={{ color: "var(--ink)", fontWeight: 600 }}>
          Run {index + 1}
        </span>
        <StatusChip status={run.status} />
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
        {run.steps.length === 0 && !live && (
          <div
            style={{
              ...rail,
              fontSize: 12.5,
              lineHeight: 1.8,
              color: "var(--ink-faint)",
              fontStyle: "italic",
            }}
          >
            no recorded steps
          </div>
        )}
        {run.steps.map((s, i) => <StepLine key={i} step={s} idx={i} />)}
        {live && (
          <div style={stepLine}>
            <span className="tabular-nums" style={stepNum}>
              {run.steps.length + 1}.
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontStyle: "italic",
                color: "var(--ink-faint)",
              }}
            >
              <span className="dot dot-running" style={{ width: 5, height: 5 }} />
              {run.step_index != null
                ? `step ${run.step_index + 1} · reasoning`
                : "starting up"}
            </span>
          </div>
        )}
      </div>
      {/* Only the fields a Build run really carries — no judge score exists here. */}
      <div
        className="tabular-nums"
        style={{
          marginTop: 12,
          paddingTop: 9,
          borderTop: "1px solid var(--hairline)",
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          letterSpacing: "0.05em",
          color: "var(--ink-faint)",
        }}
      >
        {footer}
      </div>
    </div>
  );
}

/* A steer is a USER utterance — the chat authorship law: ember-ringed
   initials chip leads the row. Consumed steers dim with a mono "read" stamp;
   unconsumed keep their "queued" semantics. */
function SteerRow({ steer }: { steer: Steer }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "2px 4px",
        opacity: steer.consumed ? 0.55 : 1,
      }}
    >
      <span
        aria-hidden="true"
        title="You"
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          marginTop: 1,
          borderRadius: 99,
          border: "1px solid color-mix(in oklab, var(--ember) 55%, transparent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: "var(--ember)",
        }}
      >
        Y
      </span>
      <p
        style={{
          flex: 1,
          minWidth: 0,
          margin: 0,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: "var(--ink-muted)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {steer.message}
      </p>
      <span
        className="mono-label tabular-nums"
        style={{ fontSize: 9, flexShrink: 0, marginTop: 3, color: "var(--ink-faint)" }}
      >
        {fmtClock(steer.created_at)} · {steer.consumed ? "read" : "queued"}
      </span>
    </div>
  );
}

/**
 * The conversation/timeline pane of a Build session — run step logs and
 * operator steers interleaved chronologically, with pending governance gates
 * rendered inline at the point of blockage.
 */
export function SessionTimeline({
  runs,
  steers,
  approvals,
  onChanged,
}: {
  runs: StudioRunDetail[];
  steers: Steer[];
  approvals: StudioApproval[];
  onChanged: () => void;
}) {
  type Item =
    | { kind: "run"; at: string; run: StudioRunDetail; index: number }
    | { kind: "steer"; at: string; steer: Steer };
  const items: Item[] = [
    ...runs.map((run, index) => ({ kind: "run" as const, at: run.created_at, run, index })),
    ...steers.map((steer) => ({ kind: "steer" as const, at: steer.created_at, steer })),
  ].sort((a, b) => (a.at < b.at ? -1 : 1));

  const pending = approvals.filter((a) => a.status === "pending");

  if (items.length === 0 && pending.length === 0) {
    return (
      <div
        style={{
          border: "1px dashed var(--hairline)",
          borderRadius: 12,
          padding: "48px 0",
          textAlign: "center",
          fontSize: 12.5,
          color: "var(--ink-faint)",
        }}
      >
        No activity yet. The build starts in a moment.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((it) =>
        it.kind === "run" ? (
          <RunBlock key={it.run.run_id} run={it.run} index={it.index} />
        ) : (
          <SteerRow key={it.steer.id} steer={it.steer} />
        ),
      )}
      {pending.map((a) => (
        <ApprovalCard key={a.id} approval={a} onDecided={onChanged} />
      ))}
    </div>
  );
}
