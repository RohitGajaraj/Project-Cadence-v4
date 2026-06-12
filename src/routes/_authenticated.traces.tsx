import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

// /traces was absorbed into /govern?tab=traces (v4 IA). The redirect must
// fire ONLY on the bare index — this file is also the LAYOUT route for
// /traces/$traceId (the one trace detail surface, screen-6 ruling), and an
// unconditional beforeLoad redirect here bounced every trace open since the
// absorption (latent bug surfaced by the screen-7 verify).
export const Route = createFileRoute("/_authenticated/traces")({
  beforeLoad: ({ location }) => {
    if (location.pathname.replace(/\/+$/, "") === "/traces") {
      throw redirect({ to: "/govern", search: { tab: "traces" } });
    }
  },
  component: Outlet,
});
