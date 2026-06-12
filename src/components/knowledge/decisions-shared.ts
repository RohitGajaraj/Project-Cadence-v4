// Shared decision vocabulary — single source for DecisionsPanel (list) and
// DecisionDetail (screen-6 drill-down). Non-component exports live here so
// both component files keep Vite fast-refresh (react-refresh rule: a file
// must export only components). SourceLink stays in DecisionsPanel.
import type { DecisionRow, DecisionSource } from "@/lib/decisions.functions";
import type { VerdictTone } from "@/components/cadence/Primitives";

export const SOURCE_LABEL: Record<DecisionSource, string> = {
  mission: "Mission",
  prd: "Spec",
  meeting: "Meeting",
  manual: "Manual",
};

export const STATUS_TONE: Record<DecisionRow["status"], VerdictTone> = {
  approved: "moss",
  rejected: "madder",
  pending: "ember", // awaiting the human's call
};

export function ageOf(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function hasSource(d: DecisionRow): boolean {
  return !!(d.mission_id || d.prd_id || d.meeting_id);
}
