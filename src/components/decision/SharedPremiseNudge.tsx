import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSharedPremisePrecedent } from "@/lib/shared-premise.functions";
import { VerdictChip, type VerdictTone } from "@/components/cadence/Primitives";

const VERDICT_TONE: Record<string, VerdictTone> = {
  validated: "moss",
  missed: "madder",
  mixed: "ember",
};

/**
 * DBR-3g: the proactive SHARED-PREMISE nudge. Distinct from `PrecedentNudge` (which surfaces
 * text-similar past decisions): this shows decisions that share a structural PREMISE with the
 * one being viewed - built on the same upstream signal/opportunity/theme - and how each
 * landed. Renders nothing until the decision graph carries derivation edges + outcomes.
 */
export function SharedPremiseNudge({
  kind,
  targetId,
  className,
}: {
  kind: "opportunity" | "prd";
  targetId: string;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const fetchItems = useServerFn(getSharedPremisePrecedent);
  const { data } = useQuery({
    queryKey: ["shared-premise-precedent", kind, targetId],
    queryFn: () => fetchItems({ data: { kind, id: targetId } }),
    // The server fn validates id as a uuid and would throw on an empty/unresolved id
    // (e.g. during hydration before the route param lands); gate the fetch on a present id.
    enabled: !!targetId,
    staleTime: 60_000,
  });
  if (dismissed || !data || data.length === 0) return null;
  return (
    <aside
      className={["bento", className].filter(Boolean).join(" ")}
      aria-label="Shared-premise precedent"
    >
      <div className="flex items-center justify-between">
        <span className="mono-label">Shared premise</span>
        <button
          type="button"
          className="text-xs text-ink-faint transition hover:text-ink-muted"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Decisions built on the same ground as this one, and how they landed.
      </p>
      <ul className="mt-2 space-y-1.5">
        {data.map((p) => (
          <li key={p.id} className="flex flex-col gap-0.5 text-sm">
            <div className="flex items-start gap-2">
              <VerdictChip tone={VERDICT_TONE[p.verdict] ?? "ember"}>{p.verdict}</VerdictChip>
              <span className="leading-snug">
                {p.title ? (
                  <strong>
                    {p.title}
                    {p.summary ? ": " : ""}
                  </strong>
                ) : null}
                {p.summary}
              </span>
            </div>
            {p.premiseTitle ? (
              <span className="pl-1 text-xs text-muted-foreground">
                Same {p.premiseKind ?? "premise"}: {p.premiseTitle}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}
