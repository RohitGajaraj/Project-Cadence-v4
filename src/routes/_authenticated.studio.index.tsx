import { createFileRoute, redirect } from "@tanstack/react-router";

// 2026-06-12 Build rename — the user-facing name and URL flipped from Studio
// to Build (/build is canonical; the surface lives in
// _authenticated.build.index.tsx). Internal studio.* identifiers are
// intentionally kept (CLAUDE.md rename-disclaimer pattern). This mirrors —
// and reverses — the earlier F-V5-MOTHBALL /build → /studio redirect.
export const Route = createFileRoute("/_authenticated/studio/")({
  beforeLoad: () => {
    throw redirect({ to: "/build" });
  },
});
