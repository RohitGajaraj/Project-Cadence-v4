import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, ShieldCheck, ShieldX, RefreshCw } from "lucide-react";
import { toast } from "@/lib/notify";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { runCriticReview, type CriticReview } from "@/lib/discovery.functions";
import { VerdictChip, type VerdictTone } from "@/components/cadence/Primitives";

type Props = {
  review: CriticReview | null | undefined;
  target: { kind: "opportunity" | "prd"; id: string };
  /** Invalidate this query key after a manual re-run. */
  invalidateKey: readonly unknown[];
  size?: "sm" | "md";
};

// Verdict chips per the DESIGN.md inline-annotation ruling: moss = ship,
// ember = revise (the human's call), madder = kill. Icons stay in the sheet
// header only — the chip itself is the mono-caps word.
const VERDICT_STYLES: Record<
  CriticReview["verdict"],
  { label: string; tone: VerdictTone; Icon: typeof ShieldCheck }
> = {
  ship: { label: "Ship", tone: "moss", Icon: ShieldCheck },
  revise: { label: "Revise", tone: "ember", Icon: ShieldAlert },
  kill: { label: "Kill", tone: "madder", Icon: ShieldX },
};

export function CriticBadge({ review, target, invalidateKey, size = "sm" }: Props) {
  const qc = useQueryClient();
  const fRun = useServerFn(runCriticReview);
  const [open, setOpen] = useState(false);

  const run = useMutation({
    mutationFn: () => fRun({ data: { target_kind: target.kind, target_id: target.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invalidateKey });
      toast.success("Critic re-ran");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!review) {
    return (
      <button
        onClick={() => run.mutate()}
        disabled={run.isPending}
        className="mono-label inline-flex items-center gap-1 rounded-full border hairline px-2 py-0.5 text-ink-faint transition hover:text-ink-muted disabled:opacity-50"
        style={{ fontSize: 9.5 }}
        title="Run the Critic agent against this row"
      >
        <ShieldAlert className="h-3 w-3" />
        {run.isPending ? "Reviewing…" : "Run Critic"}
      </button>
    );
  }

  const v = VERDICT_STYLES[review.verdict];
  const Icon = v.Icon;
  const riskCount = review.risks.length;

  // DEF-03: a spec red-team surfaces spec-specific dimensions, so relabel the
  // sections for PRDs (the generic "Missing evidence" is wrong for a spec).
  const isSpec = target.kind === "prd";
  const labels = isSpec
    ? {
        risks: { title: "Spec risks", empty: "No risks flagged." },
        kill: { title: "Won't ship as written", empty: "Nothing blocks shipping as written." },
        gaps: {
          title: "Untestable criteria & open questions",
          empty: "Criteria are testable; no open questions.",
        },
      }
    : {
        risks: { title: "Risks", empty: "No risks flagged." },
        kill: { title: "Kill criteria", empty: "No kill criteria proposed." },
        gaps: { title: "Missing evidence", empty: "No evidence gaps called out." },
      };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hover:brightness-110"
        title="Open Critic review"
      >
        <VerdictChip tone={v.tone} style={size === "md" ? { fontSize: 10.5 } : undefined}>
          {v.label}
          {riskCount > 0 && (
            <span style={{ opacity: 0.7 }}>
              · {riskCount} risk{riskCount === 1 ? "" : "s"}
            </span>
          )}
        </VerdictChip>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {isSpec ? "Spec red-team" : "Critic verdict"}: {v.label}
            </SheetTitle>
            <SheetDescription>
              Confidence {(review.confidence * 100).toFixed(0)}% · {review.reviewer_model} ·{" "}
              {new Date(review.reviewed_at).toLocaleString()}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5 text-sm">
            <p>{review.summary || "No summary."}</p>

            <Section title={labels.risks.title} items={review.risks} empty={labels.risks.empty} />
            <Section
              title={labels.kill.title}
              items={review.kill_criteria}
              empty={labels.kill.empty}
            />
            <Section
              title={labels.gaps.title}
              items={review.missing_evidence}
              empty={labels.gaps.empty}
            />

            <button
              onClick={() => run.mutate()}
              disabled={run.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border hairline px-3 py-1.5 text-xs hover:bg-secondary/50 disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" />
              {run.isPending ? "Re-running…" : "Re-run Critic"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Section({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5 list-disc pl-4">
          {items.map((it, i) => (
            <li key={i} className="text-sm leading-snug">
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
