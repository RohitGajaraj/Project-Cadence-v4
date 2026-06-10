import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/prds/")({
  beforeLoad: () => {
    throw redirect({ to: "/product", search: { tab: "specs" } });
  },
});