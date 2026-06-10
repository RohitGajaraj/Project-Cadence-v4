import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/discovery")({
  beforeLoad: () => {
    throw redirect({ to: "/product", search: { tab: "signals" } });
  },
});
