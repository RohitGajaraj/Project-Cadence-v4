// The compounding-memory view - pure, side-effect-free helpers behind the
// /memory surface. Kept out of memory.functions.ts (which carries server-only
// auth middleware) so they stay client-safe AND unit-testable in isolation.
// Mirrors gauntlet-metrics.ts / outcome-memory.ts.
//
// Voice: the loop runs the reversible work; you make the calls. Nothing here
// invents a number or an author. An outcome row is distilled by the loop across
// a run (rememberOutcome writes agent_slug = null on those by design), so its
// source reads "the loop", never a fabricated agent name.

import { agentDisplayName } from "./agent-vocabulary";

/** The display shape of one agent_memory row. Deliberately omits the 1536-float
 *  embedding and the metadata blob - neither is shown, so neither is shipped. */
export type MemoryRow = {
  id: string;
  /** 'global' (applies to every agent) or a single agent's slug. */
  scope: string;
  /** 'outcome' | 'reflection' | 'note' | any future kind. */
  kind: string;
  /** The human-readable distillate the loop recalls. */
  content: string;
  /** Source agent slug, or null for loop-distilled outcomes. */
  agentSlug: string | null;
  /** 1..5 - higher survives the daily memory-decay sweep. */
  importance: number;
  /** When the loop last recalled this memory, or null if never recalled yet. */
  lastUsedAt: string | null;
  createdAt: string;
};

export type KindCount = { kind: string; count: number };

export type MemorySummary = {
  /** Rows in the current view (the recent window, not the all-time table). */
  total: number;
  /** Per-kind counts, most common first, ties broken alphabetically. */
  byKind: KindCount[];
  /** Distinct non-null source agents in the window, sorted. */
  agents: string[];
  /** Distinct scopes in the window, sorted. */
  scopes: string[];
  /** Most recent createdAt across the window, or null when empty. */
  lastLearnedAt: string | null;
};

const KIND_LABELS: Record<string, string> = {
  outcome: "Outcome",
  reflection: "Reflection",
  note: "Note",
};

/** A human label for a memory kind. Unknown kinds are title-cased, never dropped. */
export function kindLabel(kind: string): string {
  const k = kind?.trim().toLowerCase();
  if (!k) return "Memory";
  return KIND_LABELS[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
}

const KIND_BLURBS: Record<string, string> = {
  outcome: "What shipped and how it landed, kept so the loop can recall it next time.",
  reflection: "A lesson an agent drew from one of its runs.",
  note: "A fact the loop saved for later.",
};

/** One honest line on what a kind of memory is. Empty string for unknown kinds
 *  so the UI omits the line rather than showing a made-up description. */
export function kindBlurb(kind: string): string {
  return KIND_BLURBS[kind?.trim().toLowerCase()] ?? "";
}

/** Scope in plain English: a global memory applies across every agent. */
export function scopeLabel(scope: string): string {
  const s = scope?.trim().toLowerCase();
  if (!s || s === "global") return "All agents";
  return scope;
}

/** Who a memory came from. Outcome rows carry no agent (the loop distilled them
 *  across a run), so null/blank reads "the loop" rather than an invented name. */
export function agentLabel(slug: string | null | undefined): string {
  const s = slug?.trim();
  if (!s) return "the loop";
  // Delegate to the agent catalog so a memory's source reads as the agent's
  // display name (e.g. "discovery-scout" -> "Scout"), with a title-cased
  // fallback for any slug the catalog does not know.
  return agentDisplayName(s);
}

/** Roll a window of rows into counts the header shows honestly (no estimates). */
export function summarizeMemory(rows: MemoryRow[]): MemorySummary {
  const byKindMap = new Map<string, number>();
  const agentSet = new Set<string>();
  const scopeSet = new Set<string>();
  let lastLearnedAt: string | null = null;

  for (const r of rows) {
    byKindMap.set(r.kind, (byKindMap.get(r.kind) ?? 0) + 1);
    const slug = r.agentSlug?.trim();
    if (slug) agentSet.add(slug);
    const scope = r.scope?.trim();
    if (scope) scopeSet.add(scope);
    if (r.createdAt) {
      if (lastLearnedAt === null || +new Date(r.createdAt) > +new Date(lastLearnedAt)) {
        lastLearnedAt = r.createdAt;
      }
    }
  }

  const byKind = [...byKindMap.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));

  return {
    total: rows.length,
    byKind,
    agents: [...agentSet].sort((a, b) => a.localeCompare(b)),
    scopes: [...scopeSet].sort((a, b) => a.localeCompare(b)),
    lastLearnedAt,
  };
}

const MIN_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Compact relative time ("just now", "5m ago", "3h ago", "2d ago", else a
 *  short date). nowMs is injected so this stays pure and unit-testable; the
 *  caller passes Date.now(). A future timestamp reads "just now" rather than a
 *  negative age. */
export function relativeTime(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "";
  const then = +new Date(iso);
  if (Number.isNaN(then)) return "";
  const diff = nowMs - then;
  if (diff < MIN_MS) return "just now";
  if (diff < HOUR_MS) return `${Math.floor(diff / MIN_MS)}m ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h ago`;
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
