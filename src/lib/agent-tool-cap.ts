/**
 * FND-0.5 per-agent blast-radius cap.
 *
 * Applies an agent's `max_tool_risk` ceiling to its enabled tool rows: drops any tool whose static
 * blast-radius tier (reversibility x scope, see tool-consequences.ts) exceeds the cap, so a scoped
 * agent literally cannot call (or see in its prompt) a tool beyond its remit. This is stricter than
 * the global min-confirm floor — the floor gates a high-blast tool behind human confirmation; this
 * removes over-cap tools from the agent entirely.
 *
 * Pure + total. A null/absent/invalid cap returns the rows unchanged (unrestricted = today's
 * behavior), so the loop's call site is byte-identical until an agent is given a cap.
 */
import { filterToolsByRisk, type ToolRisk } from "@/lib/tool-consequences";

function isToolRisk(cap: string | null | undefined): cap is ToolRisk {
  return cap === "low" || cap === "medium" || cap === "high";
}

/**
 * Filter `rows` to those within the agent's permitted blast radius. Generic over the row shape
 * (anything carrying a `tool_name`) so the loop can pass its `{tool_name, mode, enabled}` rows and
 * get the same row objects back, order preserved.
 */
export function capToolsByRisk<T extends { tool_name: string }>(
  rows: T[],
  cap: string | null | undefined,
): T[] {
  if (!isToolRisk(cap)) return rows;
  const allowed = new Set(
    filterToolsByRisk(
      rows.map((r) => r.tool_name),
      cap,
    ).allowed,
  );
  return rows.filter((r) => allowed.has(r.tool_name));
}
