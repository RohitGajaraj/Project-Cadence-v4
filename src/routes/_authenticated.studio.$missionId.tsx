import { createFileRoute, redirect } from "@tanstack/react-router";

// 2026-06-12 Build rename — the user-facing name and URL flipped from Studio
// to Build (/build/$missionId is canonical; the surface lives in
// _authenticated.build.$missionId.tsx). Internal studio.* identifiers are
// intentionally kept (CLAUDE.md rename-disclaimer pattern). This mirrors —
// and reverses — the earlier F-V5-MOTHBALL /build → /studio redirect.
// $missionId and ?tab= are preserved so every existing deep link keeps
// working (dispatch surfaces still navigate to /studio/$missionId).
type Tab = "changes" | "pr" | "cost";
const TABS: Tab[] = ["changes", "pr", "cost"];

export const Route = createFileRoute("/_authenticated/studio/$missionId")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const t = search.tab;
    return { tab: (TABS as string[]).includes(t as string) ? (t as Tab) : undefined };
  },
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/build/$missionId",
      params: { missionId: params.missionId },
      search,
    });
  },
});
