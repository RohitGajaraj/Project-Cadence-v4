import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/prompts")({
  beforeLoad: () => {
    throw redirect({ to: "/govern", search: { tab: "prompts" } });
  },
});
