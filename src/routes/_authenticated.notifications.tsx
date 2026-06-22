import { createFileRoute, redirect } from "@tanstack/react-router";

// F-IA-V4: notification preferences folded into Settings → Notifications (config /
// prefs belong in Settings per the home-and-today-ia rubric; the standalone route
// was orphaned — unlinked from any nav). Keep the route file so routeTree.gen.ts
// stays in sync; redirect bookmarks to the new home.
export const Route = createFileRoute("/_authenticated/notifications")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { section: "notifications" } });
  },
});
