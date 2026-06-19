import React from "react";

// P7 · CostIncidentBadge component to display customized visual tags for cost incidents.
// This is styled with appropriate colors and icons to represent budget breaches.

interface CostIncidentBadgeProps {
  amountUsd?: number;
  windowKind?: "day" | "month";
}

export function CostIncidentBadge({ amountUsd, windowKind }: CostIncidentBadgeProps) {
  return (
    <span
      className="mono-label"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 6px",
        borderRadius: 4,
        background: "rgba(220, 38, 38, 0.1)",
        color: "var(--rose, #dc2626)",
        fontSize: "11px",
        fontWeight: 600,
        marginLeft: 8,
      }}
    >
      Cost Alert
      {amountUsd !== undefined && ` ($${amountUsd}${windowKind ? `/${windowKind}` : ""})`}
    </span>
  );
}
