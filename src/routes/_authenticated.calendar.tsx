import { createFileRoute, redirect } from "@tanstack/react-router";

// /calendar absorbed into /knowledge?tab=calendar (v4 IA). Preserve ?meeting=.
export const Route = createFileRoute("/_authenticated/calendar")({
  validateSearch: (search: Record<string, unknown>): { meeting?: string } => ({
    meeting: typeof search.meeting === "string" ? search.meeting : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/knowledge",
      search: { tab: "calendar", meeting: search.meeting },
    });
  },
});
