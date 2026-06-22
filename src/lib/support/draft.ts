/**
 * M1 / LRN-01 (Support triage loop): the drafted-reply seam.
 *
 * "Tickets -> drafted replies" without touching the AI chokepoint. The reply has
 * two layers:
 *   1. A deterministic TEMPLATE draft (this file, pure) that always works with no
 *      AI: a plain, humanized acknowledgement naming the recurring theme and that
 *      the report is now tracked. Useful on day one.
 *   2. An optional AI-written draft behind the {@link DraftProvider} seam, DORMANT
 *      by default. Mirrors the BLD-04 `DelegateProvider` pattern: a pure interface +
 *      a null floor that drafts nothing until a founder enables it. When wired, the
 *      live adapter routes through the existing AI chokepoint (an existing
 *      `CallSurface`); it never adds a new surface and never calls AI from here.
 *
 * This module is PURE (no env, no I/O, no AI) so it is safe to import anywhere. The
 * env read + the (future) chokepoint call live in `./draft.server.ts`.
 */

import type { TriageCluster } from "./triage";

/** A normalized request to draft a reply for one clustered support theme. */
export interface DraftRequest {
  theme: string;
  /** How many tickets share the theme (drives the acknowledgement wording). */
  ticketCount: number;
  /** The salient shared tokens, for context (the cluster's "why"). */
  sharedTokens: string[];
  /** A representative ticket subject/body excerpt, for grounding the reply. */
  example?: string | null;
}

/** A backend's verdict on a draft attempt. */
export interface DraftVerdict {
  /** True when an AI/live backend produced the reply; false for the template floor. */
  ai: boolean;
  /** The drafted reply text (always present — the template floor never returns empty). */
  reply: string;
  /** Why this came from where it did (the live status, or "template floor"). */
  reason: string;
}

export interface DraftProvider {
  readonly id: string;
  /** Whether an AI backend is wired AND permitted (flag + chokepoint) right now. */
  readonly available: boolean;
  draft(req: DraftRequest): Promise<DraftVerdict>;
}

/** Max chars of reply we keep (bounded, predictable; the template is well under this). */
export const DRAFT_REPLY_MAX_CHARS = 2000;

/**
 * The deterministic template reply: a plain, honest acknowledgement that names the
 * recurring theme and confirms the report is now tracked as a product signal. No AI,
 * no em/en dashes, no filler, so it passes the humanized-output gate verbatim and is
 * the always-available floor whenever the AI seam is dormant.
 */
export function templateDraftReply(req: DraftRequest): string {
  const others = Math.max(0, req.ticketCount - 1);
  const company =
    others === 0
      ? "Thanks for flagging this."
      : others === 1
        ? "Thanks for flagging this. One other person has reported the same thing."
        : `Thanks for flagging this. ${others} other people have reported the same thing.`;
  const theme = req.theme ? ` about ${req.theme}` : "";
  const body = [
    company,
    `We have grouped your report${theme} into a tracked signal for the product team, so it is now part of how we decide what to fix next.`,
    "We will follow up here when there is an update.",
  ].join(" ");
  return body.slice(0, DRAFT_REPLY_MAX_CHARS);
}

/** Build the normalized draft request from a cluster (pure shaping for either layer). */
export function buildDraftRequest(cluster: TriageCluster): DraftRequest {
  const first = cluster.tickets[0];
  const example = first ? (first.subject || first.body || "").slice(0, 400) : null;
  return {
    theme: cluster.theme,
    ticketCount: cluster.tickets.length,
    sharedTokens: cluster.sharedTokens,
    example,
  };
}

/**
 * The dormant floor: returns the deterministic template draft, marked non-AI. This
 * is what the resolver returns whenever the AI draft seam is disabled, so a draft
 * attempt always yields a usable reply instead of an error or an empty string.
 */
export const templateDraftProvider: DraftProvider = {
  id: "template",
  available: false,
  async draft(req: DraftRequest): Promise<DraftVerdict> {
    return {
      ai: false,
      reply: templateDraftReply(req),
      reason: "template floor (AI draft seam disabled)",
    };
  },
};
