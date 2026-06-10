import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/traces")({
  beforeLoad: () => {
    throw redirect({ to: "/govern", search: { tab: "traces" } });
  },
});
