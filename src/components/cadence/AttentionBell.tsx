import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { getNotifications, type AppNotification } from "@/lib/notifications.functions";

// R3 · the global Attention bell. The Attention feed (NotificationsPanel) only
// shows what needs you once you are inside the Engine Room; this is its doorway
// from every screen. It carries the live count of what needs you right now
// (approvals waiting, spend nearing a cap, a stalled loop), tinted by the most
// urgent item, and links straight to the feed. Quiet (no badge) when all clear.
// Engine-Room: names the outcome (a thing needs you), not the mechanism.
//
// It shares the ["notifications"] query key with the Attention panel, so when
// both are mounted there is one fetch, not two: the same cache-sharing the
// Approvals badge uses. A failed fetch degrades to "all clear" so the bell can
// never break the top bar it sits in.

const SEVERITY_COLOR: Record<AppNotification["severity"], string> = {
  action: "var(--amber, #d97706)",
  warning: "var(--rose, #dc2626)",
  info: "var(--ink-muted)",
};

const SEVERITY_RANK: Record<AppNotification["severity"], number> = {
  action: 0,
  warning: 1,
  info: 2,
};

export function AttentionBell() {
  const fGet = useServerFn(getNotifications);
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fGet(),
    refetchInterval: 60_000,
  });

  const items = q.data?.notifications ?? [];
  const count = items.length;
  // The most urgent item drives the badge tint (action > warning > info).
  const topSeverity = items.reduce<AppNotification["severity"] | null>((top, n) => {
    if (top === null) return n.severity;
    return SEVERITY_RANK[n.severity] < SEVERITY_RANK[top] ? n.severity : top;
  }, null);
  const accent = topSeverity ? SEVERITY_COLOR[topSeverity] : "var(--ink-faint)";

  const label =
    count === 0
      ? "Attention: all clear"
      : `Attention: ${count} thing${count === 1 ? "" : "s"} need you`;

  return (
    <a
      href="/govern?tab=attention"
      title={label}
      aria-label={label}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 8,
        color: count > 0 ? "var(--ink)" : "var(--ink-faint)",
        textDecoration: "none",
        flexShrink: 0,
      }}
    >
      <Bell size={15} strokeWidth={1.75} />
      {count > 0 && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 1,
            right: 1,
            minWidth: 14,
            height: 14,
            padding: "0 3px",
            borderRadius: 999,
            background: accent,
            color: "#fff",
            fontSize: 9,
            fontWeight: 600,
            lineHeight: "14px",
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
            boxShadow: "0 0 0 2px var(--canvas)",
          }}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </a>
  );
}
