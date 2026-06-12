import { createFileRoute, redirect } from "@tanstack/react-router";

// /build mothballed by F-V5-MOTHBALL (v5); code preserved in git history;
// reverse by restoring from the pre-v5 commit. Studio (/studio, F-STUDIO)
// supersedes /build as the development-engine surface.
export const Route = createFileRoute("/_authenticated/build")({
  beforeLoad: () => {
    throw redirect({ to: "/studio" });
  },
});
