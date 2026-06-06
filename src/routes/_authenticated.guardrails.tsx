import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/guardrails")({
  beforeLoad: () => {
    throw redirect({ to: "/governance", search: { tab: "guardrails" } });
  },
});