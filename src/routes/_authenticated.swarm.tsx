import { createFileRoute, redirect } from "@tanstack/react-router";

// /swarm absorbed into /missions per F-IA-V4; AGENT-EXP moved the roster to
// Engine Room > Team, so this lands there.
export const Route = createFileRoute("/_authenticated/swarm")({
  beforeLoad: () => {
    throw redirect({ to: "/govern", search: { tab: "team" } });
  },
});
