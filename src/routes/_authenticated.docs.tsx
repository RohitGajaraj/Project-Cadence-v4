import { createFileRoute, redirect } from "@tanstack/react-router";

// /docs folded into /knowledge → Docs tab (Phase 1d, F-IA-V4).
export const Route = createFileRoute("/_authenticated/docs")({
  beforeLoad: () => {
    throw redirect({ to: "/knowledge", search: { tab: "docs" } });
  },
});
