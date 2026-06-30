/**
 * SF-SCOUT Phase 2 — per-kind query derivation from workspace context.
 *
 * Pure: no I/O, no async, no server imports. Returns one search query per
 * WatchKind that is derivable from the workspace's current focus, configured
 * competitor/target names, and top opportunity titles.
 *
 * The results are consumed by seed.server.ts to materialize scout_targets rows
 * for any WatchKind not yet represented in a workspace's watch list.
 */
import type { WatchKind } from "./kinds";

export interface WorkspaceCtx {
  /** workspace_briefs.current_focus (trimmed). */
  focus: string;
  /** workspace_briefs.researcher_targets split on commas / newlines (trimmed, non-empty). */
  targets: string[];
  /** Top opportunity titles from the workspace (trimmed, non-empty). */
  opps: string[];
}

/**
 * Derives one search query per WatchKind from workspace context.
 *
 * Two kinds are only derivable under specific conditions:
 *  - "hiring"            — requires a named competitor/company (targets[0]).
 *                          A focus area alone is too vague to signal hiring intent.
 *  - "tech-platform-shift" — requires a focus area or a top opportunity title.
 *
 * Any kind for which a query cannot be derived is omitted from the result,
 * so callers should check for presence before using.
 */
export function kindQueries(ctx: WorkspaceCtx): Partial<Record<WatchKind, string>> {
  const { targets, opps } = ctx;
  const focus = ctx.focus.trim();
  const primary = targets[0] || focus;
  if (!primary) return {};

  const q: Partial<Record<WatchKind, string>> = {};

  // competitor-surface: named competitor's changelog / pricing changes.
  q["competitor-surface"] = targets[0]
    ? `${targets[0]} product updates changelog pricing`
    : `${focus} competitor product updates`;

  // market-news: category and domain trends.
  q["market-news"] = `${primary} market news trends 2026`;

  // social-reviews: community sentiment across review sites and forums.
  q["social-reviews"] = `${primary} user reviews community reddit feedback`;

  // hiring: headcount as a strategic signal — only useful for named companies.
  if (targets[0]) {
    q["hiring"] = `${targets[0]} jobs hiring engineering product 2026`;
  }

  // tech-platform-shift: platform / API changes that affect the product area.
  const techBase = opps[0] || focus;
  if (techBase) {
    q["tech-platform-shift"] = `${techBase} API SDK platform changes updates 2026`;
  }

  // regulatory-compliance: policy / rules shifts in the space.
  q["regulatory-compliance"] = `${primary} regulatory compliance policy 2026`;

  return q;
}
