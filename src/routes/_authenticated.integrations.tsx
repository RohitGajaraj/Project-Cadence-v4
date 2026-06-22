import { createFileRoute, redirect } from "@tanstack/react-router";

// F-IA-V4: the standalone /integrations page (per-client MCP desktop-config presets)
// was orphaned — unlinked from any nav — and surfaced zero-config desktop discovery
// that the canonical MCP surface deliberately does NOT promise yet (OAuth/SSE
// auto-discovery is Phase 4b; "claim never outruns wiring"). Consolidated into the
// honest home, Settings → Integrations (per-workspace MCP token issuance + the
// working curl/bearer connection contract). Keep the route file so routeTree.gen.ts
// stays in sync; redirect bookmarks to the canonical surface.
export const Route = createFileRoute("/_authenticated/integrations")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", search: { section: "interop" } });
  },
});
