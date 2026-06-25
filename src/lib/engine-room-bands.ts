// IA-DEPTH-V11 (v11 #23, slice) — the pure band model for the Engine Room nav.
//
// The Engine Room (/govern) presents 13 flat peer tabs (Controls · Attention ·
// Team · Approvals · Safety · Spend · Prompts · Quality checks · Analytics · Loop
// health · Activity · Trends · Incidents) — too dense to scan. This module groups
// them into 3 calm bands (Needs you / Trust & safety / Quality & insight) WITHOUT
// changing the ?tab= routing contract: every tab id is preserved and still lands
// on the exact same panel; the banding is purely how the nav is presented. The
// route renders a band selector (tier 1) + the active band's tabs (tier 2).
//
// PURE: data + derivations only, no JSX. The invariants (every tab in exactly one
// band, the default tab lands in the first band, round-trip derivation) are
// unit-verified. Labels + per-tab descriptions stay in the route (the existing
// reference copy); this module owns only the grouping.

export type EngineRoomTab =
  | "attention"
  | "controls"
  | "team"
  | "approvals"
  | "guardrails"
  | "budgets"
  | "prompts"
  | "evals"
  | "analytics"
  | "gauntlet"
  | "traces"
  | "drift"
  | "incidents"
  | "support";

export type BandId = "needs-you" | "trust-safety" | "quality-insight";

export type EngineRoomBand = {
  id: BandId;
  label: string;
  blurb: string;
  /** Member tab ids, in display order. The first is the band's landing tab. */
  tabs: EngineRoomTab[];
};

export const ENGINE_ROOM_BANDS: readonly EngineRoomBand[] = [
  {
    id: "needs-you",
    label: "Needs you",
    blurb: "What's waiting on you right now — controls, attention, and the approval queue.",
    tabs: ["controls", "attention", "approvals"],
  },
  {
    id: "trust-safety",
    label: "Trust & safety",
    blurb: "Who's trusted to act, the guardrails and spend caps, and what went wrong.",
    tabs: ["team", "guardrails", "budgets", "incidents"],
  },
  {
    id: "quality-insight",
    label: "Quality & insight",
    blurb: "Prompts, eval quality, observability of every run, and recurring support themes.",
    tabs: ["prompts", "evals", "analytics", "gauntlet", "traces", "drift", "support"],
  },
];

/** Every tab id, derived from the band model (the single source of truth). */
export const ALL_ENGINE_ROOM_TABS: readonly EngineRoomTab[] = ENGINE_ROOM_BANDS.flatMap(
  (b) => b.tabs,
);

/** Where a bare /govern (no ?tab=) lands — must sit in the first band. */
export const DEFAULT_ENGINE_ROOM_TAB: EngineRoomTab = "controls";

const TAB_TO_BAND = Object.fromEntries(
  ENGINE_ROOM_BANDS.flatMap((b) => b.tabs.map((t) => [t, b.id] as const)),
) as Record<EngineRoomTab, BandId>;

/** The band a tab belongs to. */
export function bandForTab(tab: EngineRoomTab): BandId {
  return TAB_TO_BAND[tab];
}

/** The band definition by id (undefined if unknown — never throws). */
export function findBand(bandId: BandId): EngineRoomBand | undefined {
  return ENGINE_ROOM_BANDS.find((b) => b.id === bandId);
}

/** The member tabs of a band. */
export function tabsInBand(bandId: BandId): EngineRoomTab[] {
  return findBand(bandId)?.tabs ?? [];
}

/** The landing tab for a band (its first member). */
export function primaryTabForBand(bandId: BandId): EngineRoomTab {
  return findBand(bandId)?.tabs[0] ?? DEFAULT_ENGINE_ROOM_TAB;
}
