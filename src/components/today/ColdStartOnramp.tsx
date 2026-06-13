// v6 Phase 0 / W4 — the cold-start on-ramp. A brand-new workspace lands on an
// empty Today; instead of a barren dashboard, the empty state IS the on-ramp.
// It narrates how to feed the loop and points only at WIRED mechanisms — the
// webhook ingest door (/sync), manual signal capture (/product?tab=signals),
// and source connections (/settings). Rendered only when the workspace is
// genuinely cold (getColdStart → no signals/opportunities/specs), so the seeded
// demo never sees it. Voice: the loop runs the reversible work; you make the
// calls — no overclaiming.
import { Link } from "@tanstack/react-router";
import { ArrowRight, Inbox, PenLine, Plug } from "lucide-react";

const steps = [
  {
    icon: Inbox,
    title: "Open the ingest door",
    body: "Point Zapier, a form, or a quick script at your workspace's ingest URL. Every piece of feedback that lands becomes a signal Scout reads.",
    to: "/sync" as const,
    cta: "Set up ingest",
    primary: true,
  },
  {
    icon: PenLine,
    title: "Or paste a few by hand",
    body: "Drop in your last handful of customer notes, tickets, or call takeaways. A dozen is enough for Scout to find the first themes.",
    to: "/product" as const,
    search: { tab: "signals" as const },
    cta: "Add a signal",
  },
  {
    icon: Plug,
    title: "Connect a source",
    body: "Link a tool you already live in so signals flow in on their own. One click per source — no keys to paste.",
    to: "/settings" as const,
    cta: "Connect",
  },
];

export function ColdStartOnramp() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 2px" }}>
      <div>
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          Give your agents something to read.
        </div>
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-muted)",
            marginTop: 6,
            maxWidth: 560,
            lineHeight: 1.5,
          }}
        >
          Cadence works from your real signals — customer feedback, tickets, call notes. Pipe in the
          last couple of weeks and Scout clusters them into themes, Strategist ranks the
          opportunities, and your first calls land right here. The loop runs the reversible work;
          you make the calls.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={i}
              className="fade-up"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 14px",
                border: "1px solid var(--hairline)",
                borderRadius: 8,
                background: s.primary
                  ? "color-mix(in oklab, var(--ember) 6%, transparent)"
                  : "var(--canvas)",
              }}
            >
              <Icon
                size={16}
                strokeWidth={1.75}
                style={{ color: "var(--agent)", flexShrink: 0, marginTop: 2 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{s.title}</div>
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-muted)",
                    marginTop: 2,
                    lineHeight: 1.45,
                  }}
                >
                  {s.body}
                </p>
              </div>
              <Link
                to={s.to}
                search={s.search}
                className="btn btn-sm"
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: s.primary ? "var(--ember)" : "var(--action-blue)",
                  fontWeight: 600,
                }}
              >
                {s.cta}
                <ArrowRight size={12} strokeWidth={2} />
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mono-label" style={{ fontSize: 9.5, color: "var(--ink-faint)" }}>
        Prefer to point at a goal? Use Start mission in the top bar — agents plan it and bring the
        calls back here.
      </p>
    </div>
  );
}
