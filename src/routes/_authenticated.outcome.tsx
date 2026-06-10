import { createFileRoute, redirect } from "@tanstack/react-router";

// /outcome folded into /learn (Phase 1d, F-IA-V4). Releases moved to /product
// in Phase 1c; Outcomes/Support/Learnings live as Learn tabs.
export const Route = createFileRoute("/_authenticated/outcome")({
  beforeLoad: () => {
    throw redirect({ to: "/learn", search: { tab: "outcomes" } });
  },
});
