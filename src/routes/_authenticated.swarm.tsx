import { createFileRoute, redirect } from "@tanstack/react-router";

// Swarm page has been merged into Cockpit.
// /swarm redirects to /cockpit?tab=agents.
export const Route = createFileRoute("/_authenticated/swarm")({
  beforeLoad: () => {
    throw redirect({ to: "/cockpit", search: { tab: "agents" } });
  },
});
