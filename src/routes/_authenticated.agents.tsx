import { createFileRoute, redirect } from "@tanstack/react-router";

// /agents mothballed by F-V5-MOTHBALL (v5); code preserved in git history;
// reverse by restoring from the pre-v5 commit. The roster now lives at
// /missions?tab=agents.
export const Route = createFileRoute("/_authenticated/agents")({
  beforeLoad: () => {
    throw redirect({ to: "/missions", search: { tab: "agents" } });
  },
});
