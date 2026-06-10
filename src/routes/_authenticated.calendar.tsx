import { createFileRoute, redirect } from "@tanstack/react-router";

// /calendar folded into /knowledge → Calendar tab (Phase 1d, F-IA-V4).
// Preserves the ?meeting=<id> sheet deep-link.
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
