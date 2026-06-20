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
}: {
  kind: "opportunity" | "prd";
  targetId: string;
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
    <aside className="bento" aria-label="Decision precedent">
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
          <li key={p.id} className="flex items-start gap-2 text-sm">
            <VerdictChip tone={VERDICT_TONE[p.verdict] ?? "ember"}>{p.verdict}</VerdictChip>
            <span className="leading-snug">
              {p.title ? <strong>{p.title}: </strong> : null}
              {p.summary}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
