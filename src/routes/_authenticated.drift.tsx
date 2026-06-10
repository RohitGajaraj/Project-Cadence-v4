import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/drift")({
  beforeLoad: () => {
    throw redirect({ to: "/govern", search: { tab: "drift" } });
  },
});
