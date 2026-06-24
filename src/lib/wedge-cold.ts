// CORE-UX-FELT (#11) — first-run failure hardening for the Critic-teardown wedge.
//
// The wedge is the cold-start FIRST IMPRESSION: a brand-new operator names an idea
// and gets a teardown with no setup. The happy path and the gateway-cold path (the
// Critic returns a null verdict, handled gracefully) are already solid. The remaining
// gap is a HARD failure — the AI gateway throwing instead of degrading, a network
// blip, or a DB error: today that surfaces a raw technical toast on the single most
// important first screen. This pure classifier turns the raw error into a calm,
// honest, actionable message so a first-run user never meets a stack-trace-shaped
// string.
//
// Pure + dependency-free: classification is unit-tested over plain messages.

export type WedgeFailureKind = "cold" | "transient" | "other";
export type WedgeFailure = { kind: WedgeFailureKind; note: string };

// The AI gateway is cold / unconfigured / out of credit (e.g. local dev with no key,
// per KI-06). Matched loosely on the signals the runtime + providers surface.
const COLD_SIGNALS = [
  /gateway/i,
  /\bcredit/i,
  /lovable_api_key/i,
  /gemini/i,
  /\bapi[ _-]?key\b/i,
  /not configured/i,
  /\bno key\b/i,
  /quota/i,
  /insufficient/i,
  /\b402\b/,
  /unreachable/i,
];

// A transient problem (network/timeout/5xx/rate-limit) — retrying after a moment may
// just work. Rate-limit (429) lives here, not in COLD: the gateway IS connected, it
// just needs a cooldown — so the cold "once it's connected" guidance would misdirect.
const TRANSIENT_SIGNALS = [
  /network/i,
  /time.?out/i,
  /timed.?out/i,
  /failed to fetch/i,
  /fetch failed/i,
  /\beconn/i,
  /\b5\d\d\b/,
  /\b429\b/,
  /rate.?limit/i,
  /temporarily/i,
];

function anyMatch(patterns: RegExp[], s: string): boolean {
  return patterns.some((re) => re.test(s));
}

/** True when the message indicates the AI gateway is cold / unconfigured / capped. */
export function isGatewayColdError(message: string | null | undefined): boolean {
  return anyMatch(COLD_SIGNALS, message ?? "");
}

const COLD_NOTE =
  "The Critic needs the AI gateway, which isn't reachable here right now. Your idea is safe — try again in a moment, or once the gateway is connected.";
const TRANSIENT_NOTE = "Couldn't complete that just now. Give it a moment and try again.";

/**
 * Classify a wedge-run failure into a calm, user-facing message. Cold-gateway and
 * transient errors get reassuring guidance; anything else keeps the real message (so
 * a genuine bug stays legible) but framed for a first-run, not shown as a raw toast.
 */
export function classifyWedgeFailure(message: string | null | undefined): WedgeFailure {
  const msg = (message ?? "").trim();
  if (isGatewayColdError(msg)) return { kind: "cold", note: COLD_NOTE };
  if (anyMatch(TRANSIENT_SIGNALS, msg)) return { kind: "transient", note: TRANSIENT_NOTE };
  return {
    kind: "other",
    note: msg ? `Something went wrong: ${msg}. Try again.` : "Something went wrong. Try again.",
  };
}
