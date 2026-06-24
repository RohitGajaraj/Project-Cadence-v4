// DEF-04 (#27): the design-readiness panel on a PRD. Reads the spec and shows, calmly,
// how design-ready it is (states / edge cases / a11y / responsive / copy / permissions
// / data / flow) plus the specific gaps to close before design. Deterministic, no AI;
// the AI mockup + live sandbox preview are the named gated remainder.

import { Palette, Check, ArrowRight } from "lucide-react";
import { analyzeDesignReadiness, readinessGaps, type ReadinessLevel } from "@/lib/design-readiness";

const LEVEL: Record<ReadinessLevel, { label: string; color: string }> = {
  ready: { label: "Design-ready", color: "var(--emerald)" },
  developing: { label: "Developing", color: "var(--ember)" },
  early: { label: "Early", color: "var(--ink-subtle)" },
};

export function DesignReadinessPanel({ body }: { body: string }) {
  const r = analyzeDesignReadiness(body);
  // Nothing to assess on a blank spec — stay quiet until there is content.
  if (r.empty) return null;

  const gaps = readinessGaps(r);
  const lvl = LEVEL[r.level];

  return (
    <div className="mb-6 rounded-lg border hairline bg-card p-4">
      <div className="flex items-center gap-2.5">
        <Palette className="h-3.5 w-3.5" style={{ color: lvl.color }} strokeWidth={1.9} />
        <span className="text-[13px] font-medium text-foreground">Design readiness</span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {r.score}/{r.total}
        </span>
        <span
          className="font-mono text-[10px] uppercase tracking-wide"
          style={{ color: lvl.color }}
        >
          {lvl.label}
        </span>
        <span className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-foreground/[0.06]">
          <span
            className="block h-full rounded-full transition-[width]"
            style={{ width: `${r.pct}%`, background: lvl.color }}
          />
        </span>
      </div>

      {gaps.length === 0 ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3 w-3" style={{ color: "var(--emerald)" }} strokeWidth={2.2} />
          This spec names every design dimension. It is ready to hand to design.
        </p>
      ) : (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            Add before design ({gaps.length})
          </p>
          <ul className="flex flex-col gap-1.5">
            {gaps.map((c) => (
              <li key={c.key} className="flex items-start gap-2 text-xs leading-relaxed">
                <ArrowRight
                  className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground"
                  strokeWidth={1.9}
                />
                <span>
                  <span className="text-foreground">{c.label}.</span>{" "}
                  <span className="text-muted-foreground">{c.hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 border-t hairline pt-2 text-[11px] text-muted-foreground">
        Checks the spec is ready to design. A generated mockup and live preview come from
        Build (a later add-on).
      </p>
    </div>
  );
}
