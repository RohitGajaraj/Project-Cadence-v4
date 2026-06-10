import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout for /prds — /prds itself redirects via prds.index.tsx;
// /prds/$id still renders through this Outlet.
export const Route = createFileRoute("/_authenticated/prds")({
  component: () => <Outlet />,
});
