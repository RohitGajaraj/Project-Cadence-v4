import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/budgets")({
  beforeLoad: () => {
    throw redirect({ to: "/governance", search: { tab: "budgets" } });
  },
});