/**
 * SETTINGS-SEGREGATE (v11 #13) — the pure grouping model for the Settings surface.
 *
 * Settings had 11 flat peer tabs (Accounts · Models · Staff · Workspace · Plan ·
 * Credits · Integrations · Profile · Notifications · Health · Data) — no
 * segmentation, three different places to "connect" (Accounts / Integrations /
 * `/sync`), and Models-vs-Staff read as confusing peers. This module collapses
 * the 11 sections into 5 calm groups + one recessed Advanced group WITHOUT
 * changing the `?section=` deep-link contract: every original section id is
 * preserved and still lands on the exact same content; the grouping is purely
 * how the nav is presented. The route renders the groups (tier 1) and, inside
 * the active group, that group's member sections (tier 2).
 *
 * PURE: no React / db / network. The route imports these to drive the two-tier
 * nav; the invariants (every section in exactly one group, primary-is-first,
 * legacy ids resolve, round-trip group derivation) are unit-verified.
 */

export type SectionId =
  | "connections"
  | "ai"
  | "staff"
  | "workspace"
  | "billing"
  | "credits"
  | "interop"
  | "profile"
  | "health"
  | "data"
  | "notifications";

export type GroupId = "account" | "workspace" | "connections" | "ai" | "billing" | "advanced";

export type SettingsSection = { id: SectionId; label: string };

export type SettingsGroup = {
  id: GroupId;
  label: string;
  /** One-line description shown under the active group tab. */
  desc: string;
  /** Member sections in display order. The FIRST is the group's landing section. */
  sections: SettingsSection[];
  /** Advanced is recessed — off to the side, quiet (diagnostics, not daily use). */
  recessed?: boolean;
};

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    id: "account",
    label: "Account",
    desc: "Your profile and how Cadence reaches you.",
    sections: [
      { id: "profile", label: "Profile" },
      { id: "notifications", label: "Notifications" },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    desc: "The workspace brief, voice, and the staff who work in it.",
    sections: [
      { id: "workspace", label: "Brief & voice" },
      { id: "staff", label: "Staff" },
    ],
  },
  {
    id: "connections",
    label: "Connections",
    desc: "Connect your accounts and integrations, in one place.",
    sections: [
      { id: "connections", label: "Accounts" },
      { id: "interop", label: "Integrations" },
    ],
  },
  {
    id: "ai",
    label: "AI & keys",
    desc: "Which models run your agents, and your own provider keys.",
    sections: [{ id: "ai", label: "Models & keys" }],
  },
  {
    id: "billing",
    label: "Billing",
    desc: "Your plan and credits.",
    sections: [
      { id: "billing", label: "Plan" },
      { id: "credits", label: "Credits" },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    desc: "Diagnostics and data export.",
    recessed: true,
    sections: [
      { id: "health", label: "Health" },
      { id: "data", label: "Data" },
    ],
  },
];

/** Every section id, derived from the group model (the single source of truth). */
export const ALL_SECTION_IDS: readonly SectionId[] = SETTINGS_GROUPS.flatMap((g) =>
  g.sections.map((s) => s.id),
);

/** Where a bare `/settings` (no `?section=`) lands. */
export const DEFAULT_SECTION: SectionId = "connections";

/**
 * Legacy deep links still arrive with old `?section=` values; keep them landing.
 *   brief    -> workspace   (the strategic brief lives in the Workspace section)
 *   calendar -> connections (calendar accounts live under Accounts)
 */
export const LEGACY_SECTION_MAP: Readonly<Record<string, SectionId>> = {
  brief: "workspace",
  calendar: "connections",
};

function isSectionId(raw: string): raw is SectionId {
  return (ALL_SECTION_IDS as readonly string[]).includes(raw);
}

/** Resolve a raw `?section=` value (incl. legacy aliases) to a real section id. */
export function normalizeSection(raw: string | undefined | null): SectionId {
  if (!raw) return DEFAULT_SECTION;
  const mapped = LEGACY_SECTION_MAP[raw];
  if (mapped) return mapped;
  return isSectionId(raw) ? raw : DEFAULT_SECTION;
}

const SECTION_TO_GROUP = Object.fromEntries(
  SETTINGS_GROUPS.flatMap((g) => g.sections.map((s) => [s.id, g.id] as const)),
) as Record<SectionId, GroupId>;

/** The group a section belongs to. */
export function groupForSection(section: SectionId): GroupId {
  return SECTION_TO_GROUP[section];
}

/** The group definition by id (returns undefined if unknown — never throws). */
export function findGroup(groupId: GroupId): SettingsGroup | undefined {
  return SETTINGS_GROUPS.find((g) => g.id === groupId);
}

/** The landing section for a group (its first member). */
export function primarySection(groupId: GroupId): SectionId {
  return findGroup(groupId)?.sections[0]?.id ?? DEFAULT_SECTION;
}

/** Human label for a section id (falls back to the id if somehow unknown). */
export function sectionLabel(section: SectionId): string {
  for (const g of SETTINGS_GROUPS) {
    const found = g.sections.find((s) => s.id === section);
    if (found) return found.label;
  }
  return section;
}

/** The primary (non-recessed) groups, for the main nav row. */
export const PRIMARY_GROUPS: readonly SettingsGroup[] = SETTINGS_GROUPS.filter((g) => !g.recessed);

/** The recessed groups (Advanced), shown off to the side. */
export const RECESSED_GROUPS: readonly SettingsGroup[] = SETTINGS_GROUPS.filter((g) => g.recessed);
