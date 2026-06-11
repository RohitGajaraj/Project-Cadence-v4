import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert, ShieldCheck, ShieldX, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { runCriticReview, type CriticReview } from "@/lib/discovery.functions";

type Props = {
  review: CriticReview | null | undefined;
  target: { kind: "opportunity" | "prd"; id: string };
  /** Invalidate this query key after a manual re-run. */
  invalidateKey: readonly unknown[];
  size?: "sm" | "md";
};

const VERDICT_STYLES = {
  ship: {
    label: "Ship",
    cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    Icon: ShieldCheck,
  },
  revise: {
    label: "Revise",
    cls: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    Icon: ShieldAlert,
  },
  kill: {
    label: "Kill",
    cls: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    Icon: ShieldX,
  },
} as const;

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
        className="inline-flex items-center gap-1 rounded-md border hairline px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
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
  const px = size === "md" ? "px-2.5 py-1" : "px-2 py-0.5";
  const txt = size === "md" ? "text-xs" : "text-[10px]";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded-md border ${px} ${txt} font-medium ${v.cls} hover:brightness-110`}
        title="Open Critic review"
      >
        <Icon className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
        {v.label}
        {riskCount > 0 && (
          <span className="opacity-70">
            · {riskCount} risk{riskCount === 1 ? "" : "s"}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              Critic verdict: {v.label}
            </SheetTitle>
            <SheetDescription>
              Confidence {(review.confidence * 100).toFixed(0)}% · {review.reviewer_model} ·{" "}
              {new Date(review.reviewed_at).toLocaleString()}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5 text-sm">
            <p>{review.summary || "No summary."}</p>

            <Section title="Risks" items={review.risks} empty="No risks flagged." />
            <Section
              title="Kill criteria"
              items={review.kill_criteria}
              empty="No kill criteria proposed."
            />
            <Section
              title="Missing evidence"
              items={review.missing_evidence}
              empty="No evidence gaps called out."
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