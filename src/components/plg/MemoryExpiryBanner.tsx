// PLG Phase 3 — the memory-retention upgrade nudge banner.
//
// Self-contained: give it the active workspace id and it fetches its own state via
// getMemoryExpiry, then renders a calm CTA ONLY when the workspace is on a fading-
// memory (free) plan AND its own memory is genuinely nearing the retention window.
// Paid plans / no-risk states render nothing, so it is safe to drop on any surface
// (Today, Brain) without cluttering the common case. Honest copy: it states the
// plan's retention as the upgrade value, never a fake deletion countdown.
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { MonoLabel } from "@/components/cadence/Primitives";
import { getMemoryExpiry } from "@/lib/today.functions";

export function MemoryExpiryBanner({ workspaceId }: { workspaceId: string | null }) {
  const fetchMemoryExpiry = useServerFn(getMemoryExpiry);
  const q = useQuery({
    queryKey: ["memory-expiry", workspaceId],
    queryFn: () => fetchMemoryExpiry({ data: { workspaceId: workspaceId! } }),
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });

  const state = q.data;
  // Degrade-silent: no data, paid plan, or nothing at risk -> render nothing.
  if (!state?.show) return null;

  const { expiringCount, soonestDays, retentionDays } = state;
  const noun = expiringCount === 1 ? "memory" : "memories";
  const whenPhrase =
    soonestDays === null || soonestDays === 0
      ? "are reaching"
      : soonestDays === 1
        ? "reach it tomorrow —"
        : `reach it in ${soonestDays} days —`;

  return (
    <section
      className="bento"
      style={{
        padding: "12px var(--card-pad)",
        marginBottom: 24,
        borderLeft: "2px solid var(--ember)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <MonoLabel icon={Clock} style={{ marginBottom: 4 }}>
          Memory · free plan
        </MonoLabel>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: 0, lineHeight: 1.5 }}>
          {expiringCount} decision {noun} {whenPhrase} your free {retentionDays}-day retention
          window. On the free plan, decision memory is kept {retentionDays} days then fades. Keep it
          and let it compound across decisions.
        </p>
      </div>
      <Link
        to="/settings"
        search={{ section: "billing" }}
        className="mono-label"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 9,
          padding: "5px 12px",
          borderRadius: 6,
          border: "1px solid color-mix(in oklab, var(--ember) 45%, transparent)",
          color: "var(--ember)",
          background: "transparent",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
        title="Upgrade so your decision memory never fades"
      >
        Keep my memory →
      </Link>
    </section>
  );
}
