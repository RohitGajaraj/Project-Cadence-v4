/**
 * BackendHealthBanner — startup drift indicator.
 *
 * Renders only when the backend is missing migrations this build depends on.
 * Cannot auto-apply (Lovable Cloud Workers have no DDL credentials); the goal
 * is to fail loud and stop users hitting cryptic Postgres errors mid-flow
 * (notably the onboarding seed). Build-time gate: scripts/check-migrations.sh.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { checkBackendHealth } from "@/lib/health.functions";

export function BackendHealthBanner() {
  const fCheck = useServerFn(checkBackendHealth);
  const { data } = useQuery({
    queryKey: ["backend-health"],
    queryFn: () => fCheck(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (!data || data.ok) return null;

  return (
    <div
      role="alert"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        background: "color-mix(in oklab, var(--ember) 14%, var(--canvas))",
        borderBottom: "1px solid color-mix(in oklab, var(--ember) 40%, transparent)",
        color: "var(--ink)",
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      <AlertTriangle size={15} style={{ color: "var(--ember)", flexShrink: 0 }} />
      <span>
        Backend update pending. Some actions (including onboarding setup) may fail until the
        operator applies the latest migrations.
      </span>
      <span className="mono-label" style={{ marginLeft: "auto", color: "var(--ink-faint)" }}>
        {data.pending.length} pending
      </span>
    </div>
  );
}