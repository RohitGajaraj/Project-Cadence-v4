import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { amIAdmin } from "@/lib/pricing.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const fetchAmIAdmin = useServerFn(amIAdmin);
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => fetchAmIAdmin(),
  });

  useEffect(() => {
    if (q.data && !q.data.admin) navigate({ to: "/" });
  }, [q.data, navigate]);

  if (q.isLoading) {
    return (
      <div style={{ padding: 24, fontSize: 13, color: "var(--ink-subtle, #6b6457)" }}>
        Checking access…
      </div>
    );
  }
  if (!q.data?.admin) {
    return (
      <div style={{ padding: 24, fontSize: 13 }}>This area is for workspace admins.</div>
    );
  }
  return (
    <div style={{ padding: 24, display: "grid", gap: 16, maxWidth: 1100 }}>
      <div className="mono-label" style={{ fontSize: 9, color: "var(--ink-faint, #8a8377)" }}>
        Admin
      </div>
      <nav style={{ display: "flex", gap: 12, fontSize: 13 }}>
        <Link to="/admin" activeOptions={{ exact: true }} className="btn btn-ghost btn-sm">
          Overview
        </Link>
        <Link to="/admin/pricing" className="btn btn-ghost btn-sm">
          Pricing
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}