import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/evals")({
  beforeLoad: () => {
    throw redirect({ to: "/govern", search: { tab: "evals" } });
  },
});
