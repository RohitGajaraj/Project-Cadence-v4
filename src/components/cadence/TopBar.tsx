// TopBar — ported from design-reference/cadence/shell.jsx: breadcrumbs left,
// date + ambient weather right (54px, hairline bottom, canvas). Production
// addition: an `actions` slot so page-level controls (Start mission, …)
// keep a home — the reference topbar itself carries no actions.
import { useEffect, useState, type ReactNode } from "react";
import { Calendar, ChevronRight } from "lucide-react";
import { AmbientChip } from "./AmbientChip";

export function TopBar({ crumbs, actions }: { crumbs: string[]; actions?: ReactNode }) {
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    );
  }, []);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 28px",
        height: 54,
        flexShrink: 0,
        borderBottom: "1px solid var(--hairline)",
        background: "var(--canvas)",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12.5,
          color: "var(--ink-subtle)",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {i > 0 && (
              <ChevronRight size={11} strokeWidth={1.75} style={{ color: "var(--ink-faint)" }} />
            )}
            <span
              style={{
                color: i === crumbs.length - 1 ? "var(--ink)" : undefined,
                fontWeight: i === crumbs.length - 1 ? 500 : 400,
              }}
            >
              {c}
            </span>
          </span>
        ))}
      </div>
      <span style={{ flex: 1 }} />
      {actions}
      <span
        className="mono-label"
        style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
      >
        <Calendar size={11} strokeWidth={1.75} />
        {today}
      </span>
      <AmbientChip inline />
    </header>
  );
}
