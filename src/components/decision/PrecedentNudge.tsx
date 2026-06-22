import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDecisionPrecedent } from "@/lib/decision-precedent.functions";
import { VerdictChip, type VerdictTone } from "@/components/cadence/Primitives";

const VERDICT_TONE: Record<string, VerdictTone> = {
  validated: "moss",
  missed: "madder",
  mixed: "ember",
};

export function PrecedentNudge({
  kind,
  targetId,
  className,
}: {
  kind: "opportunity" | "prd";
  targetId: string;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const fetchPrecedent = useServerFn(getDecisionPrecedent);
  const { data } = useQuery({
    queryKey: ["decision-precedent", kind, targetId],
    queryFn: () => fetchPrecedent({ data: { kind, id: targetId } }),
    staleTime: 60_000,
  });
  if (dismissed || !data || data.length === 0) return null;
  return (
    <aside
      className={["bento", className].filter(Boolean).join(" ")}
      aria-label="Decision precedent"
    >
      <div className="flex items-center justify-between">
        <span className="mono-label">Precedent</span>
        <button
          type="button"
          className="text-xs text-ink-faint transition hover:text-ink-muted"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        You reasoned this way before. Here is how it went.
      </p>
      <ul className="mt-2 space-y-1.5">
        {data.map((p) => (
          <li key={p.id} className="flex flex-col gap-0.5 text-sm">
            <div className="flex items-start gap-2">
              <VerdictChip tone={VERDICT_TONE[p.verdict] ?? "ember"}>{p.verdict}</VerdictChip>
              <span className="leading-snug">
                {p.title ? <strong>{p.title}: </strong> : null}
                {p.summary}
              </span>
            </div>
            {p.governing ? (
              <span className="pl-1 text-xs text-muted-foreground">
                <strong className="text-ink-muted">
                  {p.governing.superseded ? "Superseded" : "Contradicted"}:
                </strong>{" "}
                {p.governing.superseded
                  ? p.governing.governingTitle
                    ? `replaced by "${p.governing.governingTitle}"; rely on the current decision.`
                    : "a later decision replaced this; rely on the current one."
                  : "a later outcome contradicted this; no longer a safe basis."}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}
