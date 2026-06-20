/**
 * Admin layout. Gated by `has_role(auth.uid(),'admin')`. Non-admins see a
 * locked card with a one-time "claim admin" button that only succeeds when
 * the user_roles table has zero admins (the bootstrap path).
 */
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { SurfaceHeader, TabRow } from "@/components/cadence/Primitives";
import { amIAdmin, bootstrapSelfAdmin } from "@/lib/pricing.functions";
import { toast } from "@/lib/notify";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin · Cadence" }] }),
});

const TABS = [
  { id: "/admin", label: "Overview" },
  { id: "/admin/pricing", label: "Pricing" },
  { id: "/admin/people", label: "People" },
] as const;

function AdminLayout() {
  const fAmI = useServerFn(amIAdmin);
  const me = useQuery({ queryKey: ["am-i-admin"], queryFn: () => fAmI() });
  const loc = useLocation();
  const navigate = useNavigate();

  return (
    <AppShell>
      <TopBar crumbs={["Admin"]} />
      <div style={{ padding: "30px 44px 56px", maxWidth: 1100, margin: "0 auto" }}>
        <SurfaceHeader
          kicker="Operator"
          icon={Shield}
          title="Admin"
          sub="Manage the credits engine, pricing catalog, and admin access."
        />
        {me.isLoading ? (
          <div className="bento" style={{ padding: 18, marginTop: 18 }}>Checking access…</div>
        ) : me.data?.isAdmin ? (
          <>
            <TabRow
              tabs={TABS.map((t) => ({ id: t.id, label: t.label }))}
              active={
                loc.pathname.startsWith("/admin/people")
                  ? "/admin/people"
                  : loc.pathname === "/admin/pricing"
                    ? "/admin/pricing"
                    : "/admin"
              }
              onSet={(id) => navigate({ to: id as "/admin" | "/admin/pricing" | "/admin/people" })}
            />
            <Outlet />
          </>
        ) : (
          <NoAccessCard anyAdminExists={!!me.data?.anyAdminExists} />
        )}
      </div>
    </AppShell>
  );
}

function NoAccessCard({ anyAdminExists }: { anyAdminExists: boolean }) {
  const qc = useQueryClient();
  const fBootstrap = useServerFn(bootstrapSelfAdmin);
  const claim = useMutation({
    mutationFn: () => fBootstrap(),
    onSuccess: (res) => {
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("You are now an admin.");
      qc.invalidateQueries({ queryKey: ["am-i-admin"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed."),
  });

  return (
    <div className="bento" style={{ padding: 22, marginTop: 18, display: "grid", gap: 12 }}>
      <div className="font-display" style={{ fontSize: 20 }}>Admin access required</div>
      <p style={{ fontSize: 13, color: "var(--ink-muted, #4a4438)", margin: 0 }}>
        The admin console manages the credits engine, plan and top-up catalog, and the admin
        list itself. Ask a current admin to grant you access.
      </p>
      {!anyAdminExists ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="btn btn-primary btn-sm"
            disabled={claim.isPending}
            onClick={() => claim.mutate()}
          >
            {claim.isPending ? "Claiming…" : "Claim admin · one-time bootstrap"}
          </button>
          <span style={{ fontSize: 11, color: "var(--ink-subtle, #6b6457)" }}>
            No admin exists yet. Whoever clicks first becomes the first admin.
          </span>
        </div>
      ) : null}
    </div>
  );
}