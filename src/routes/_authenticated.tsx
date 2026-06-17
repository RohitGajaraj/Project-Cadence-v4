import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CommandPalette, GotoShortcuts } from "@/components/cadence/CommandPalette";
import { WorkspaceProvider } from "@/hooks/use-workspace";
import { FlowModeProvider } from "@/hooks/use-flow-mode";
import { needsOnboarding } from "@/lib/onboarding-gate";
import { BackendHealthBanner } from "@/components/system/BackendHealthBanner";

export const Route = createFileRoute("/_authenticated")({
  // Disable SSR/prerender for the entire authenticated subtree. Without a
  // browser session, server-side execution of child loaders would call
  // protected server fns and produce noisy 401s. The client-side
  // beforeLoad below handles the real auth gate.
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Use getSession() — reads from localStorage (instant, no network roundtrip).
    // getUser() hits /auth/v1/user on every navigation and, combined with
    // TanStack Router's hover-preload, makes the UI feel frozen.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login" });
    }
    // First-run gate: accounts with profiles.onboarded === false land on
    // /onboarding until they finish. Cached (one read per page load) —
    // see onboarding-gate.ts for the never-trap rules.
    if (
      !location.pathname.startsWith("/onboarding") &&
      (await needsOnboarding(data.session.user.id))
    ) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <WorkspaceProvider>
      <FlowModeProvider>
        {/* Ambient time/weather moved into the per-page TopBar (shell port). */}
        <BackendHealthBanner />
        <CommandPalette />
        <GotoShortcuts />
        <Outlet />
      </FlowModeProvider>
    </WorkspaceProvider>
  );
}
