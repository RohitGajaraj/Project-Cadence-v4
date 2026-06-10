import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/roadmap")({
  beforeLoad: () => {
    throw redirect({ to: "/product", search: { tab: "roadmap" } });
  },
});
