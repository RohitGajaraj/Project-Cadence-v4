import { createFileRoute, redirect } from "@tanstack/react-router";

// /governance absorbed into /govern per F-IA-V4 Phase 1b.
// Old tabs (controls/approvals/guardrails/budgets) map 1:1.
type LegacyTab = "controls" | "approvals" | "guardrails" | "budgets";
const LEGACY: LegacyTab[] = ["controls", "approvals", "guardrails", "budgets"];

export const Route = createFileRoute("/_authenticated/governance")({
  validateSearch: (search: Record<string, unknown>): { tab?: LegacyTab } => {
    const t = search.tab;
    return { tab: LEGACY.includes(t as LegacyTab) ? (t as LegacyTab) : undefined };
  },
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/govern", search: { tab: search.tab ?? "controls" } });
  },
});
