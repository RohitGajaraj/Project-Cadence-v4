/**
 * SEC-INGEST-INJECTION: prompt-injection screening at the support-triage trust boundary.
 *
 * Support tickets are UNTRUSTED input. The triage loop turns a recurring cluster of tickets
 * into a Discover `signal` that then feeds the agent pipeline as first-class, trusted
 * context. That is exactly the boundary `considerations.md` #3 (P0, "the product's defining
 * risk") warns about: one poisoned ticket ("ignore previous instructions and ...") riding
 * into Discover could steer an autonomous action. This module screens a cluster's raw ticket
 * text with the existing, battle-tested injection classifier BEFORE the cluster can become a
 * signal, so the loop can quarantine a poisoned cluster (never emit it) or flag a borderline
 * one for review.
 *
 * PURE (the classifier it wraps is pure), so it is fully unit-testable with real attack
 * strings. The server function consumes the decision; this file never does IO.
 */

import { assessCorpusInjection } from "@/lib/injection-classifier";

/** What to do with a cluster at the untrusted boundary. */
export type ScreenDecision = "allow" | "flag" | "quarantine";

/**
 * Screen a cluster's untrusted ticket texts for prompt injection. QUARANTINE (never emit)
 * if the corpus verdict quarantines, ANY chunk quarantines, or the cross-chunk pass
 * escalates a distributed marker reconstructed across a boundary; FLAG (emit, but tagged for
 * review) if the corpus or any chunk flags; otherwise ALLOW. Conservative on purpose: a
 * poisoned signal steering an autonomous action is far worse than holding a borderline one.
 */
export function injectionScreenDecision(texts: string[]): ScreenDecision {
  const r = assessCorpusInjection(texts);
  if (
    r.corpus.decision === "quarantine" ||
    r.escalate.length > 0 ||
    r.perChunk.some((v) => v.decision === "quarantine")
  ) {
    return "quarantine";
  }
  if (r.corpus.decision === "flag" || r.perChunk.some((v) => v.decision === "flag")) {
    return "flag";
  }
  return "allow";
}

/** The tag a FLAG-level cluster's emitted signal carries, so a human can review it. */
export const INJECTION_REVIEW_TAG = "needs-review";
