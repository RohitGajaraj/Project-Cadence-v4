/**
 * STAKEHOLDER-PACK (v11 #19) — PURE composer for audience-tuned persuasion artifacts.
 *
 * v11 pains research, GAP #1: Cadence already PRODUCES the evidence (a decision + its
 * receipts: what changed, why, the proof, who approved it, whether it still stands), but a
 * PM still has to hand-build the deck that wins each room. This module turns one decision +
 * its receipts into the artifact each audience actually needs — the same facts, re-framed:
 *   - exec:  bottom-line first (the call, what it stands on, the ask), minimal mechanism.
 *   - eng:   the rationale, constraints, and provenance — the "why" engineers will challenge.
 *   - board: the strategic framing + governance + standing — trust, not implementation.
 *
 * It reuses the Trust Ledger's receipt fields (no new data) and the humanized-output voice.
 * PURE: no db, no network, no AI; the composition + rendering are unit-verifiable. The server
 * adapter passes a normalized brief in. NO migration, NO chokepoint.
 */

export type PackAudience = "exec" | "eng" | "board";

export const PACK_AUDIENCES: readonly PackAudience[] = ["exec", "eng", "board"];

const AUDIENCE_LABEL: Record<PackAudience, string> = {
  exec: "Executive",
  eng: "Engineering",
  board: "Board",
};

/** The receipt fields a pack is composed from — a subset of the Trust Ledger's TrustReceipt. */
export type DecisionBrief = {
  title: string;
  rationale: string | null;
  /** decision status (pending|approved|rejected|shipped|...). */
  status: string;
  /** the agent slug that proposed/made the call, or null for a human-led call. */
  actor: string | null;
  /** true when a human pressed approve/reject. */
  humanDecided: boolean;
  /** ISO timestamp the decision was made. */
  occurredAt: string;
  /** originating artifact label (mission / prd / meeting), when known. */
  sourceLabel: string | null;
  /** count of lineage edges touching this decision (provenance richness). */
  evidenceCount: number;
  /** bitemporal standing: still current, or replaced by a later decision. */
  outcome: "standing" | "superseded";
  /** recorded outcome verdict, when an outcome was logged against the decision. */
  verdict?: string | null;
  metricLabel?: string | null;
  metricValue?: string | null;
};

export type PackSection = { heading: string; body: string };

export type StakeholderPack = {
  audience: PackAudience;
  title: string;
  sections: PackSection[];
  footer: string;
};

const POSITIVE = new Set(["validated", "confirmed", "win"]);
const NEGATIVE = new Set(["missed", "invalidated", "refuted", "loss"]);

/** Plain-language standing line, shared across audiences. */
function standingLine(brief: DecisionBrief): string {
  if (brief.outcome === "superseded") {
    return "This decision has since been revised by a later call (kept for the record, not current).";
  }
  return "This is the current standing decision.";
}

/** Plain-language outcome line from a recorded verdict, or null when none. */
function outcomeLine(brief: DecisionBrief): string | null {
  const v = typeof brief.verdict === "string" ? brief.verdict.trim().toLowerCase() : "";
  if (!v) return null;
  const metric =
    brief.metricLabel && brief.metricValue ? ` (${brief.metricLabel}: ${brief.metricValue})` : "";
  if (POSITIVE.has(v)) return `Recorded outcome: validated${metric}.`;
  if (NEGATIVE.has(v)) return `Recorded outcome: it missed${metric} — and that is on the record too.`;
  return `Recorded outcome: mixed${metric}.`;
}

/** Who-and-how the call was made, framed for trust. */
function provenanceLine(brief: DecisionBrief): string {
  const who = brief.humanDecided
    ? "A person reviewed and approved it"
    : brief.actor
      ? `Proposed by the ${brief.actor} agent`
      : "Recorded in the decision log";
  const evidence =
    brief.evidenceCount > 0
      ? `, backed by ${brief.evidenceCount} linked piece${brief.evidenceCount === 1 ? "" : "s"} of evidence`
      : "";
  const src = brief.sourceLabel ? `, originating from ${brief.sourceLabel}` : "";
  return `${who}${evidence}${src}.`;
}

function whyBody(brief: DecisionBrief): string {
  return brief.rationale?.trim() ? brief.rationale.trim() : "No rationale was recorded for this decision.";
}

/**
 * PURE. Compose one audience-tuned pack from a decision brief. Same facts, different lead and
 * emphasis per audience; always honest (sparse fields degrade to plain statements).
 */
export function composeStakeholderPack(brief: DecisionBrief, audience: PackAudience): StakeholderPack {
  const sections: PackSection[] = [];
  const outcome = outcomeLine(brief);

  if (audience === "exec") {
    sections.push({ heading: "The decision", body: brief.title });
    sections.push({
      heading: "Where it stands",
      body: [standingLine(brief), outcome].filter(Boolean).join(" "),
    });
    sections.push({ heading: "Why it matters", body: whyBody(brief) });
    sections.push({ heading: "How confident we are", body: provenanceLine(brief) });
  } else if (audience === "eng") {
    sections.push({ heading: "What changed", body: brief.title });
    sections.push({ heading: "Rationale and constraints", body: whyBody(brief) });
    sections.push({ heading: "Provenance", body: provenanceLine(brief) });
    sections.push({
      heading: "Status",
      body: [`Decision status: ${brief.status}.`, standingLine(brief), outcome]
        .filter(Boolean)
        .join(" "),
    });
  } else {
    // board
    sections.push({ heading: "Strategic decision", body: brief.title });
    sections.push({ heading: "The case", body: whyBody(brief) });
    sections.push({
      heading: "Evidence and governance",
      body: provenanceLine(brief),
    });
    sections.push({
      heading: "Standing and outcome",
      body: [standingLine(brief), outcome].filter(Boolean).join(" "),
    });
  }

  return {
    audience,
    title: `${AUDIENCE_LABEL[audience]} brief: ${brief.title}`,
    sections,
    footer: "Generated by Cadence from this decision and its receipts.",
  };
}

/** PURE. All three audience packs from one brief. */
export function composeAllPacks(brief: DecisionBrief): Record<PackAudience, StakeholderPack> {
  return {
    exec: composeStakeholderPack(brief, "exec"),
    eng: composeStakeholderPack(brief, "eng"),
    board: composeStakeholderPack(brief, "board"),
  };
}

/** PURE. Render a pack as a clean, copy-anywhere Markdown artifact in Cadence's voice. */
export function renderPackMarkdown(pack: StakeholderPack, opts: { asOf?: string | null } = {}): string {
  const lines: string[] = [`# ${pack.title}`];
  if (opts.asOf?.trim()) lines.push(`As of ${opts.asOf.trim()}`);
  lines.push("");
  for (const s of pack.sections) {
    lines.push(`## ${s.heading}`);
    lines.push(s.body || "—");
    lines.push("");
  }
  lines.push(`_${pack.footer}_`);
  return lines.join("\n");
}
