/**
 * LOOP-PROVE (v11 #5) - UI display layer for the closure proof.
 *
 * PURE. Turns a `LoopClosureReport` (the engine's diagnosis) into the calm, plain-language
 * summary a surface renders: an outcome-named headline (the moat doctrine: name the outcome,
 * not the mechanism), one honest line (the engine's own cold-stage gap when the loop is not
 * yet closed, the proof when it is), and a left-to-right trail of the loop's stages. No React,
 * no data access, unit-verifiable. It only FORMATS the report, it never re-derives the proof,
 * so the badge can never disagree with `computeLoopClosure`.
 */
import type { LoopClosureReport, LoopWarmth } from "@/lib/moat/loop-closure";

export type LoopTrailStep = { value: number; label: string };

export type LoopClosureSummary = {
  tone: LoopWarmth;
  /** Outcome-named headline. */
  label: string;
  /** One honest line: the win when warm, the engine's named cold stage otherwise. */
  detail: string;
  /** The loop's stages in order, as a quiet trail. */
  trail: LoopTrailStep[];
};

const LABEL: Record<LoopWarmth, string> = {
  warm: "Your decision loop is closing",
  warming: "Your decision loop is warming",
  cold: "Your decision loop is still cold",
};

const FALLBACK_DETAIL: Record<LoopWarmth, string> = {
  warm: "Outcomes are correcting past decisions end to end.",
  warming: "Edges are forming, but no decision has resolved forward yet.",
  cold: "No decision has been superseded by its outcome yet.",
};

/** Floor to a non-negative integer; anything non-finite or negative reads as 0. */
function count(x: unknown): number {
  return typeof x === "number" && Number.isFinite(x) && x > 0 ? Math.floor(x) : 0;
}

/**
 * PURE. Format a closure report for display. Defensive: tolerates a partial/missing report so
 * a surface can render it without its own guards.
 */
export function summarizeLoopClosure(report: LoopClosureReport): LoopClosureSummary {
  const tone: LoopWarmth =
    report?.warmth === "warm" || report?.warmth === "warming" ? report.warmth : "cold";
  const c = report?.counts;

  // Detail: when warm, lead with the proof (how many beliefs resolved forward); otherwise
  // surface the engine's OWN first gap so the cold stage is named, with a plain fallback.
  let detail: string;
  if (tone === "warm") {
    const resolved = count(c?.governingResolutions);
    detail =
      resolved > 0
        ? `${resolved} belief${resolved === 1 ? "" : "s"} resolved forward to its current replacement.`
        : FALLBACK_DETAIL.warm;
  } else {
    const firstGap = Array.isArray(report?.gaps)
      ? report.gaps.find((g) => typeof g === "string" && g.trim())
      : undefined;
    detail = firstGap?.trim() || FALLBACK_DETAIL[tone];
  }

  const trail: LoopTrailStep[] = [
    { value: count(c?.decisions), label: "decisions" },
    { value: count(c?.outcomesRecorded), label: "outcomes" },
    { value: count(c?.supersessionEdges), label: "revised" },
    { value: count(c?.governingResolutions), label: "resolved" },
  ];

  return { tone, label: LABEL[tone], detail, trail };
}
