import { createFileRoute, redirect } from "@tanstack/react-router";

// /swarm absorbed into /missions per F-IA-V4 (7-surface IA collapse).
export const Route = createFileRoute("/_authenticated/swarm")({
  beforeLoad: () => {
    throw redirect({ to: "/missions", search: { tab: "agents" } });
  },
});
