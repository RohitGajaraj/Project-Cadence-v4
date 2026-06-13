/**
 * Outcome → memory distillation (v6 Phase 2 — close the compounding loop).
 *
 * When an outcome is recorded, the re-score already moves the opportunity's ICE
 * and writes a `learnings` audit row — but that audit row never reaches the
 * `agent_memory` store the loop actually recalls. So an agent re-encountering the
 * same opportunity could NOT recall "we shipped this and it was validated/missed."
 * This module turns an outcome into a durable, searchable memory string so the
 * loop genuinely compounds (v6 §3 Pillar 2 — the Decision System moat).
 *
 * Pure + DB-free so it is unit-testable (`bun test`); the embed + write lives in
 * `memory.server.ts → rememberOutcome`.
 */
export const OUTCOME_MEMORY_KIND = "outcome";

export type OutcomeVerdict = "validated" | "missed" | "mixed";

export type OutcomeMemoryInput = {
  prdTitle: string;
  oppTitle?: string | null;
  verdict: OutcomeVerdict;
  summary: string;
  priorIce?: number | null;
  newIce?: number | null;
};

/** agent_memory.content has no hard cap, but mirror memory.remember's 1000. */
const MAX_LEN = 1000;

/**
 * Importance for the daily decay sweep (memory-tick prunes importance <= 2 when
 * unused > 30d). Decisive verdicts are higher-signal than an ambiguous one, and
 * all outcomes stay above the prune floor — institutional memory shouldn't rot.
 */
export function outcomeImportance(verdict: OutcomeVerdict): number {
  return verdict === "mixed" ? 3 : 4;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** A recall-friendly sentence a future agent run will surface via semantic match. */
export function buildOutcomeMemory(input: OutcomeMemoryInput): string {
  const title = input.prdTitle?.trim() || "an untitled spec";
  const opp = input.oppTitle?.trim();
  const verdict = input.verdict.toUpperCase();
  const parts: string[] = [
    `Outcome on the spec "${title}"${opp ? ` (opportunity: "${opp}")` : ""}: ${verdict}.`,
  ];
  const summary = input.summary?.trim();
  if (summary) parts.push(summary);
  // Compare the ROUNDED values so a sub-0.1 drift (e.g. a clamped confidence
  // leaving the DB-stored ICE and the recomputed float a hair apart) never
  // renders a misleading "8.3→8.3" no-move.
  if (
    typeof input.priorIce === "number" &&
    typeof input.newIce === "number" &&
    round1(input.priorIce) !== round1(input.newIce)
  ) {
    parts.push(`Opportunity ICE moved ${round1(input.priorIce)}→${round1(input.newIce)}.`);
  }
  return parts.join(" ").slice(0, MAX_LEN);
}
