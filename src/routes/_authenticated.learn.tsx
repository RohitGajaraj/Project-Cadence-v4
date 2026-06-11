import { createFileRoute, redirect } from "@tanstack/react-router";

// /learn mothballed by F-V5-MOTHBALL (v5); code preserved in git history;
// reverse by restoring from the pre-v5 commit. Learn folds into /knowledge
// (its tabs have no Knowledge equivalents, so no search params carry over).
export const Route = createFileRoute("/_authenticated/learn")({
  beforeLoad: () => {
    throw redirect({ to: "/knowledge" });
  },
});
