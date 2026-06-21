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

import {
  assessAndQuarantine,
  assessCorpusInjection,
  quarantineText,
  type InjectionVerdict,
} from "@/lib/injection-classifier";

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
 * Synthetic verdict used to label a chunk quarantined by the CROSS-CHUNK pass
 * (its own per-chunk verdict is below threshold by construction; the reason is a
 * structural payload split across a chunk boundary).
 */
const CROSS_CHUNK_VERDICT: InjectionVerdict = {
  score: 1,
  severity: "high",
  decision: "quarantine",
  signals: [{ name: "cross_chunk_structural_split", count: 1, weight: 0 }],
};

/**
 * Classify untrusted text and hard-quarantine it when the classifier is
 * confident it is a prompt-injection attempt (structural-gated). Fail-open: on
 * any internal error the original text is returned unchanged so the pipeline
 * never breaks. Used on every untrusted boundary, including the externally-
 * ingested reactor path (FND-0.7-c).
 */
export function quarantineUntrusted(text: string): UntrustedAssessment {
  try {
    return assessAndQuarantine(text);
  } catch {
    return { text, verdict: SAFE_FALLBACK, quarantined: false };
  }
}

export type CorpusUntrustedAssessment = {
  /** Per-chunk safe text + verdict + quarantined flag, in input order. */
  chunks: UntrustedAssessment[];
  /** Indices quarantined specifically by the cross-chunk (split-structural) pass. */
  crossChunkEscalated: number[];
  /** Corpus-level verdict: distributed-injection observability (never strips alone). */
  corpus: InjectionVerdict;
};

/**
 * Corpus-aware quarantine (FND-0.7-b). Runs the per-chunk hard quarantine AND
 * escalates a structural injection split across an adjacent chunk boundary that
 * no single chunk reveals. Fail-open: on any internal error every chunk passes
 * through unchanged so the pipeline never breaks. Benign chunk sets are
 * byte-identical to the per-chunk path (no quarantine, no escalation).
 */
export function quarantineUntrustedCorpus(texts: string[]): CorpusUntrustedAssessment {
  const list = Array.isArray(texts) ? texts : [];
  try {
    const result = assessCorpusInjection(list);
    const escalated = new Set(result.escalate);
    const chunks: UntrustedAssessment[] = result.perChunk.map((verdict, i) => {
      const original =
        typeof list[i] === "string" ? list[i] : list[i] == null ? "" : String(list[i]);
      if (verdict.decision === "quarantine") {
        return { text: quarantineText(verdict), verdict, quarantined: true };
      }
      if (escalated.has(i)) {
        // Per-chunk verdict is sub-threshold by construction; placeholder names
        // the cross-chunk reason, while the returned verdict stays the honest
        // per-chunk one for telemetry.
        return { text: quarantineText(CROSS_CHUNK_VERDICT), verdict, quarantined: true };
      }
      return { text: original, verdict, quarantined: false };
    });
    return { chunks, crossChunkEscalated: result.escalate, corpus: result.corpus };
  } catch {
    const chunks: UntrustedAssessment[] = list.map((t) => {
      const original = typeof t === "string" ? t : t == null ? "" : String(t);
      return { text: original, verdict: SAFE_FALLBACK, quarantined: false };
    });
    return { chunks, crossChunkEscalated: [], corpus: SAFE_FALLBACK };
  }
}
