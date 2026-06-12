import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { recordOutcome, checkPrdShipped } from "@/lib/outcome.functions";
import { VerdictChip, type VerdictTone } from "@/components/cadence/Primitives";

type Verdict = "validated" | "mixed" | "missed";

/** Shape of the `prds.outcome` jsonb payload written by recordOutcome. */
export type PrdOutcome = {
  verdict?: Verdict;
  summary?: string;
  metric_label?: string | null;
  metric_value?: string | null;
  prior_ice?: number | null;
  new_ice?: number | null;
};

export type OutcomePrd = {
  id: string;
  status: string;
  github_issue_url?: string | null;
  shipped_at?: string | null;
  outcome?: PrdOutcome | null;
};

type Props = {
  prd: OutcomePrd;
  /** Invalidate this query key after a ship-check or outcome record. */
  invalidateKey: readonly unknown[];
};

// Verdict chips per the DESIGN.md inline-annotation ruling. Outcomes are the
// one place moss/madder live; "mixed" is ember — the result needs the human's
// read before it feeds rescoring.
const VERDICT_TONES: Record<Verdict, VerdictTone> = {
  validated: "moss",
  mixed: "ember",
  missed: "madder",
};

const VERDICT_ORDER: Verdict[] = ["validated", "mixed", "missed"];

export function OutcomeCard({ prd, invalidateKey }: Props) {
  const qc = useQueryClient();
  const fCheck = useServerFn(checkPrdShipped);
  const fRecord = useServerFn(recordOutcome);

  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [summary, setSummary] = useState("");
  const [metricLabel, setMetricLabel] = useState("");
  const [metricValue, setMetricValue] = useState("");

  const check = useMutation({
    mutationFn: () => fCheck({ data: { prdId: prd.id } }),
    onSuccess: (r) => {
      if (r.shipped) {
        toast.success(
          `Shipped — GitHub issue closed${
            r.shippedAt ? ` ${new Date(r.shippedAt).toLocaleDateString()}` : ""
          }`,
        );
        qc.invalidateQueries({ queryKey: invalidateKey });
      } else if (r.issueState === "open") {
        toast("Not shipped yet — the linked GitHub issue is still open.");
      } else {
        toast("Ship status unknown — could not read the linked GitHub issue.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const record = useMutation({
    mutationFn: () => {
      if (!verdict) throw new Error("Pick a verdict first");
      if (!summary.trim()) throw new Error("Summarize what actually happened");
      return fRecord({
        data: {
          prdId: prd.id,
          verdict,
          summary: summary.trim(),
          metricLabel: metricLabel.trim() || undefined,
          metricValue: metricValue.trim() || undefined,
        },
      });
    },
    onSuccess: (r) => {
      toast.success("Learning recorded");
      if (r.opportunity) {
        toast.success(
          `Opportunity re-scored: ${Number(r.opportunity.prior_ice).toFixed(1)} → ${Number(
            r.opportunity.new_ice,
          ).toFixed(1)}`,
        );
      }
      qc.invalidateQueries({ queryKey: invalidateKey });
      qc.invalidateQueries({ queryKey: ["learnings"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shipped = prd.status === "shipped" || !!prd.shipped_at;
  const outcome = prd.outcome ?? null;

  return (
    <div className="rounded-lg border hairline bg-card/60 p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-3 flex items-center gap-2">
        <Target className="h-3 w-3" /> Outcome
      </div>

      {outcome ? (
        <RecordedOutcome outcome={outcome} />
      ) : shipped ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {VERDICT_ORDER.map((v) => (
              <button key={v} onClick={() => setVerdict(v)} title={`Record as ${v}`}>
                <VerdictChip
                  tone={VERDICT_TONES[v]}
                  selected={verdict === v}
                  style={verdict !== null && verdict !== v ? { opacity: 0.45 } : undefined}
                >
                  {v}
                </VerdictChip>
              </button>
            ))}
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What actually happened?"
            className="w-full min-h-[80px] rounded-md border hairline bg-background px-3 py-2 text-sm outline-none focus:border-foreground resize-y"
          />
          <div className="flex flex-wrap gap-2">
            <input
              value={metricLabel}
              onChange={(e) => setMetricLabel(e.target.value)}
              placeholder="Metric label (optional)"
              className="flex-1 min-w-[160px] rounded-md border hairline bg-background px-3 py-1.5 text-xs outline-none focus:border-foreground"
            />
            <input
              value={metricValue}
              onChange={(e) => setMetricValue(e.target.value)}
              placeholder="Metric value (optional)"
              className="flex-1 min-w-[160px] rounded-md border hairline bg-background px-3 py-1.5 text-xs outline-none focus:border-foreground"
            />
          </div>
          <button
            onClick={() => record.mutate()}
            disabled={!verdict || !summary.trim() || record.isPending}
            className="btn-pill px-4 py-1.5 text-xs disabled:opacity-50"
          >
            {record.isPending ? "Recording…" : "Record outcome"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Ships when the linked GitHub issue closes.
          </p>
          {prd.github_issue_url ? (
            <button
              onClick={() => check.mutate()}
              disabled={check.isPending}
              className="btn-pill-outline px-3 py-1 text-xs disabled:opacity-50"
            >
              {check.isPending ? "Checking…" : "Check ship status"}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">Link a GitHub issue to track shipping.</p>
          )}
        </div>
      )}
    </div>
  );
}

function RecordedOutcome({ outcome }: { outcome: PrdOutcome }) {
  return (
    <div className="space-y-3">
      {outcome.verdict ? (
        <VerdictChip tone={VERDICT_TONES[outcome.verdict]}>{outcome.verdict}</VerdictChip>
      ) : (
        <span className="mono-label inline-flex rounded-full border hairline px-2 py-0.5 text-ink-faint">
          recorded
        </span>
      )}
      {outcome.summary && <p className="text-sm leading-relaxed">{outcome.summary}</p>}
      {(outcome.metric_label || outcome.metric_value) && (
        <p className="text-xs text-muted-foreground">
          {outcome.metric_label ?? "Metric"}
          {outcome.metric_value ? (
            <>
              : <span className="tabular-nums text-foreground">{outcome.metric_value}</span>
            </>
          ) : null}
        </p>
      )}
      {outcome.prior_ice != null && outcome.new_ice != null && (
        <p className="text-xs text-muted-foreground">
          Opportunity re-scored:{" "}
          <span className="tabular-nums">
            {Number(outcome.prior_ice).toFixed(1)} → {Number(outcome.new_ice).toFixed(1)}
          </span>{" "}
          <Link to="/product" search={{ tab: "opportunities" } as never} className="link-action">
            View opportunities
          </Link>
        </p>
      )}
    </div>
  );
}
