import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/opportunities")({
  beforeLoad: () => {
    throw redirect({ to: "/product", search: { tab: "opportunities" } });
  },
});
