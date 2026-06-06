import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/traces")({
  beforeLoad: () => {
    throw redirect({ to: "/observe", search: { tab: "traces" } });
  },
});
