import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDecisionCurrency } from "@/lib/decision-currency.functions";
import { VerdictChip } from "@/components/cadence/Primitives";

/**
 * DBR-3d: warn when the decision being VIEWED has itself been superseded or contradicted by
 * a later outcome, so the user does not act on a belief the workspace moved on from. This is
 * distinct from PrecedentNudge (which surfaces SIMILAR past decisions): it is about the
 * current entity's OWN currency. Renders nothing until the decision graph marks it stale, so
 * it is byte-identical until edges accrue post-publish. Fail-safe: a null result hides it.
 */
export function DecisionCurrencyBanner({
  kind,
  targetId,
  className,
}: {
  kind: "opportunity" | "prd";
  targetId: string;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const fetchCurrency = useServerFn(getDecisionCurrency);
  const { data } = useQuery({
    queryKey: ["decision-currency", kind, targetId],
    queryFn: () => fetchCurrency({ data: { kind, id: targetId } }),
    staleTime: 60_000,
  });
  if (dismissed || !data) return null;
  const superseded = data.superseded;
  const replacement = data.governingTitle ? `by "${data.governingTitle}"` : "by a later decision";
  return (
    <aside
      className={["bento", className].filter(Boolean).join(" ")}
      aria-label="Decision currency"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <VerdictChip tone="madder">{superseded ? "superseded" : "contradicted"}</VerdictChip>
          <span className="mono-label">Decision currency</span>
        </div>
        <button
          type="button"
          className="text-xs text-ink-faint transition hover:text-ink-muted"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {superseded
          ? `This decision was superseded ${replacement}. Act on the current one, not this.`
          : "A later outcome contradicted this decision; treat it with caution."}
      </p>
    </aside>
  );
}
