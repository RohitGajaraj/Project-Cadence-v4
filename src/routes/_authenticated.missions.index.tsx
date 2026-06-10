import { createFileRoute, redirect } from "@tanstack/react-router";

// Missions listing page has been merged into Cockpit.
// /missions redirects to /cockpit?tab=missions.
export const Route = createFileRoute("/_authenticated/missions/")({
  beforeLoad: () => {
    throw redirect({ to: "/cockpit", search: { tab: "missions" } });
  },
});
