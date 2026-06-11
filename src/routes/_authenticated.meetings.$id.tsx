import { createFileRoute, redirect } from "@tanstack/react-router";

// /meetings/$id lands on /knowledge?tab=calendar&meeting=<id> (Phase 1d).
export const Route = createFileRoute("/_authenticated/meetings/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/calendar", search: { meeting: params.id } });
  },
});
