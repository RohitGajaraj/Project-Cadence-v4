import { createFileRoute, redirect } from "@tanstack/react-router";

// v6 Phase 0 / W1: the Roadmap surface (Now/Next/Later sprint planner) was
// deleted as human-PM-legacy UI. Keep the route file so routeTree.gen.ts stays
// in sync; redirect bookmarks to the Product loop (Opportunities is the live,
// ICE-ranked successor to the lane board).
export const Route = createFileRoute("/_authenticated/roadmap")({
  beforeLoad: () => {
    throw redirect({ to: "/product", search: { tab: "opportunities" } });
  },
});
