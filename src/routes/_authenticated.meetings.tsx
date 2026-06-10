import { createFileRoute, redirect } from "@tanstack/react-router";

// Meetings merged into the Knowledge surface → Calendar tab (Phase 1d).
export const Route = createFileRoute("/_authenticated/meetings")({
  beforeLoad: () => {
    throw redirect({ to: "/knowledge", search: { tab: "calendar" } });
  },
});
