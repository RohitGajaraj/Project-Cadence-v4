import { createFileRoute, redirect } from "@tanstack/react-router";

// /memory folded into the Brain surface as its "Memory" tab (founder ruling
// 2026-06-16: Knowledge→Brain, and the compounding agent-recall moat is part of
// the brain). Keep the route file so routeTree.gen.ts stays in sync; redirect
// bookmarks to /knowledge?tab=memory, which now renders the same <MemoryList />.
export const Route = createFileRoute("/_authenticated/memory")({
  beforeLoad: () => {
    throw redirect({ to: "/knowledge", search: { tab: "memory" } });
  },
});
