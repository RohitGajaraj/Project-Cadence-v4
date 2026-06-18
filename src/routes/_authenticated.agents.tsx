import { createFileRoute, redirect } from "@tanstack/react-router";

// /agents mothballed (v5); AGENT-EXP relocated the roster to Engine Room > Team.
// The user meets agents in motion (the relay), not as a managed roster.
export const Route = createFileRoute("/_authenticated/agents")({
  beforeLoad: () => {
    throw redirect({ to: "/govern", search: { tab: "team" } });
  },
});
