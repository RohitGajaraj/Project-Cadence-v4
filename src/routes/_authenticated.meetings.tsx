import { createFileRoute, redirect } from "@tanstack/react-router";

// Meetings merged into the Calendar surface (list view default).
// Bookmarks and old links land on /calendar with no extra click.
export const Route = createFileRoute("/_authenticated/meetings")({
  beforeLoad: () => {
    throw redirect({ to: "/calendar" });
  },
});
