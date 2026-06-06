import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CommandPalette, GotoShortcuts } from "@/components/cadence/CommandPalette";
import { WorkspaceProvider } from "@/hooks/use-workspace";
import { AmbientChip } from "@/components/cadence/AmbientChip";

export const Route = createFileRoute("/_authenticated")({
  // Disable SSR/prerender for the entire authenticated subtree. Without a
  // browser session, server-side execution of child loaders would call
  // protected server fns and produce noisy 401s. The client-side
  // beforeLoad below handles the real auth gate.
  ssr: false,
  beforeLoad: async () => {
    // Use getSession() — reads from localStorage (instant, no network roundtrip).
    // getUser() hits /auth/v1/user on every navigation and, combined with
    // TanStack Router's hover-preload, makes the UI feel frozen.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <WorkspaceProvider>
      <CommandPalette />
      <GotoShortcuts />
      <AmbientChip />
      <Outlet />
    </WorkspaceProvider>
  );
}