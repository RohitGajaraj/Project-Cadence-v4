/**
 * Server-only injection-defense seam (FND-0.7).
 *
 * The single call-site the rest of the system uses to hard-quarantine untrusted
 * content (RAG chunks, ingested signals, tool output) before it reaches a model.
 * It composes the pure learned classifier (`@/lib/injection-classifier`) and is
 * deliberately fail-open: a classifier fault must never drop or block a request,
 * so any internal error falls through to the original text. This file is a
 * wrapper only; it does not modify the existing guardrails engine
 * (`guardrails.server.ts`) or the AI chokepoint.
 *
 * Never imported by client code (`.server.ts`).
 */

import { assessAndQuarantine, type InjectionVerdict } from "@/lib/injection-classifier";

export type UntrustedAssessment = {
  /** Safe text to embed: the neutralized placeholder when quarantined, else the original. */
  text: string;
  verdict: InjectionVerdict;
  quarantined: boolean;
};

const SAFE_FALLBACK: InjectionVerdict = {
  score: 0,
  severity: "none",
  decision: "allow",
  signals: [],
};

/**
 * Classify untrusted text and hard-quarantine it when the classifier is
 * confident it is a prompt-injection attempt. Fail-open: on any internal error
 * the original text is returned unchanged so the pipeline never breaks.
 */
export function quarantineUntrusted(text: string): UntrustedAssessment {
  try {
    return assessAndQuarantine(text);
  } catch {
    return { text, verdict: SAFE_FALLBACK, quarantined: false };
  }
}
