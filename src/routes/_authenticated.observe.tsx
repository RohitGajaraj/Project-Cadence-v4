import { createFileRoute, redirect } from "@tanstack/react-router";

// /observe absorbed into /govern per F-IA-V4 Phase 1b.
// Old tabs (analytics/traces/drift) map 1:1.
type LegacyTab = "analytics" | "traces" | "drift";
const LEGACY: LegacyTab[] = ["analytics", "traces", "drift"];

export const Route = createFileRoute("/_authenticated/observe")({
  validateSearch: (search: Record<string, unknown>): { tab?: LegacyTab } => {
    const t = search.tab;
    return { tab: LEGACY.includes(t as LegacyTab) ? (t as LegacyTab) : undefined };
  },
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/govern", search: { tab: search.tab ?? "analytics" } });
  },
});
