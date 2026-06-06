import { createFileRoute, redirect } from "@tanstack/react-router";

// Strategic brief moved into Settings → Workspace (inline management convention).
// /briefing remains a stable URL so bookmarks and command-palette muscle memory
// land on the new location without a 404.
export const Route = createFileRoute("/_authenticated/briefing")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { section: "brief" } });
  },
});
