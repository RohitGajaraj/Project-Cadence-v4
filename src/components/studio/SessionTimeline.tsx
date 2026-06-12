import { Brain, Wrench, MessageSquare, UserRound } from "lucide-react";
import type { StudioApproval, StudioRunDetail } from "@/lib/studio.functions";
import { ApprovalCard } from "./ApprovalCard";
import { StatusIcon, StatusChip } from "./studio-ui";
import { fmtCost, summarizeArgs } from "./studio-format";

type LoopStep = StudioRunDetail["steps"][number];
type Steer = { id: string; message: string; created_at: string; consumed: boolean };

function toolStepTone(status: string): string {
  if (status === "error" || status === "denied") return "text-rose-300";
  if (status === "queued") return "text-amber-300";
  return "text-emerald-300";
}

function StepLine({ step, idx }: { step: LoopStep; idx: number }) {
  if (step.kind === "thought") {
    return (
      <div className="flex items-start gap-2 text-[11px]">
        <span className="mt-0.5 w-5 shrink-0 text-right tabular-nums text-muted-foreground">
          {idx + 1}.
        </span>
        <Brain className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 italic text-muted-foreground break-words">{step.text}</p>
      </div>
    );
  }
  if (step.kind === "tool_call") {
    const tone = toolStepTone(step.status);
    return (
      <div className="flex items-start gap-2 text-[11px]">
        <span className="mt-0.5 w-5 shrink-0 text-right tabular-nums text-muted-foreground">
          {idx + 1}.
        </span>
        <Wrench className={`mt-0.5 h-3 w-3 shrink-0 ${tone}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`font-mono ${tone}`}>{step.name}</span>
            <span
              className={`inline-flex items-center rounded-full border border-current/30 px-1.5 py-px text-[10px] ${tone}`}
            >
              {step.status}
            </span>
          </div>
          <div className="text-muted-foreground line-clamp-1 break-words">
            {step.error
              ? `error: ${step.error}`
              : summarizeArgs((step.args ?? {}) as Record<string, unknown>)}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 text-[11px]">
      <span className="mt-0.5 w-5 shrink-0 text-right tabular-nums text-muted-foreground">
        {idx + 1}.
      </span>
      <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-foreground" />
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words border-l-2 border-emerald-400/40 pl-2 text-xs text-foreground">
        {step.message}
      </p>
    </div>
  );
}

function RunBlock({ run, index }: { run: StudioRunDetail; index: number }) {
  const live = run.status === "running" || run.status === "queued";
  return (
    <div className="bento p-4">
      <div className="flex items-center gap-2">
        <StatusIcon s={run.status} />
        <div className="font-display text-sm">Run {index + 1}</div>
        {run.model && (
          <span className="font-mono text-[10px] text-muted-foreground truncate">{run.model}</span>
        )}
        <StatusChip status={run.status} />
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {fmtCost(run.cost_usd)}
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        {run.steps.length === 0 ? (
          <div className="px-1 text-[11px] italic text-muted-foreground">
            {live ? "Waiting for first checkpoint…" : "No recorded steps."}
          </div>
        ) : (
          run.steps.map((s, i) => <StepLine key={i} step={s} idx={i} />)
        )}
      </div>
    </div>
  );
}

function SteerBubble({ steer }: { steer: Steer }) {
  return (
    <div className="ml-6 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-indigo-300">
        <UserRound className="h-3 w-3" /> You steered
        {!steer.consumed && <span className="normal-case tracking-normal">(queued)</span>}
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground/90">
        {steer.message}
      </p>
    </div>
  );
}

/**
 * The conversation/timeline pane of a Studio session — run step logs and
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
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        No activity yet. The session starts on the next tick.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((it) =>
        it.kind === "run" ? (
          <RunBlock key={it.run.run_id} run={it.run} index={it.index} />
        ) : (
          <SteerBubble key={it.steer.id} steer={it.steer} />
        ),
      )}
      {pending.map((a) => (
        <ApprovalCard key={a.id} approval={a} onDecided={onChanged} />
      ))}
    </div>
  );
}
