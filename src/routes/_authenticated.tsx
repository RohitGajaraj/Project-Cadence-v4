import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CommandPalette, GotoShortcuts } from "@/components/cadence/CommandPalette";
import { WorkspaceProvider } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_authenticated")({
  // Disable SSR/prerender for the entire authenticated subtree. Without a
  // browser session, server-side execution of child loaders would call
  // protected server fns and produce noisy 401s. The client-side
  // beforeLoad below handles the real auth gate.
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
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
      <Outlet />
    </WorkspaceProvider>
  );
}