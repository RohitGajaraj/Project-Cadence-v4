/**
 * SEC-SIGNAL-INGEST-INJECTION: prompt-injection screening at untrusted INGEST boundaries.
 *
 * A generic, reusable screen for any path where EXTERNAL untrusted content enters the system
 * and is then stored as first-class context the agents read and act on: the public
 * signal-ingest webhook today, MCP/A2A results next. This is `considerations.md` #3 (P0, "the
 * product's defining risk"): one poisoned external payload entering `signals` could steer an
 * autonomous action. Screen BEFORE storing so a structural attack never lands.
 *
 * It reuses the existing structural-gate classifier (`classifyInjection`) - the same primitive
 * already guarding other surfaces - rather than a second, drift-prone detector. The structural
 * gate is why a legitimate item that merely QUOTES an injection ("user reported: 'ignore
 * previous instructions...'") is NOT dropped; only a real structural attack (fence-breakout /
 * forged-system-turn) is quarantined. PURE (the classifier is pure), so fully unit-testable.
 */

import { classifyInjection } from "@/lib/injection-classifier";

/** What to do with one untrusted ingested item at the boundary. */
export type IngestScreenDecision = "allow" | "flag" | "quarantine";

/**
 * Screen one untrusted ingested item's text for prompt injection. Returns the classifier's
 * boundary decision: `quarantine` a structural attack (caller must REJECT, never store),
 * `flag` a lexical-only override (store but tag for review), else `allow`.
 */
export function screenIngestText(text: string): IngestScreenDecision {
  return classifyInjection(text).decision;
}

/** The tag a FLAG-level ingested item carries, so a human can review it post-ingest. */
export const INGEST_REVIEW_TAG = "needs-review";
