import { createFileRoute, redirect } from "@tanstack/react-router";

// /cockpit absorbed into /missions per F-IA-V4 (7-surface IA collapse).
// Old ?tab=missions|agents maps 1:1.
export const Route = createFileRoute("/_authenticated/cockpit")({
  validateSearch: (search: Record<string, unknown>): { tab?: "agents" | "missions" } => {
    const t = search.tab;
    return { tab: t === "agents" || t === "missions" ? t : undefined };
  },
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/missions", search: { tab: search.tab ?? "missions" } });
  },
});