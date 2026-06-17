// PLG · the public, unauthenticated /pricing marketing page (the deferred
// increment named in docs/features/pricing.md). Renders the three plan tiers
// straight from `planPresentation` in entitlements.ts — the same source of
// truth the in-app Settings → Plan tab uses, so prices/features never drift.
// Leads with the decided positioning: free to start, pay to keep your memory
// (the "charge for memory persistence" course-correction). Not under
// _authenticated, so it works with no session. SSR for a real link preview.
import { createFileRoute, Link } from "@tanstack/react-router";
import { CadenceMark } from "@/components/cadence/Primitives";
import { planPresentation, type PlanTier } from "@/lib/entitlements";

const TITLE = "Pricing · Cadence";
const DESC =
  "Cadence runs your product loop for free. You pay only to keep your decision memory compounding instead of expiring.";

export const Route = createFileRoute("/pricing")({
  ssr: true,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: "Cadence · Pricing" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PricingPage,
});

const TIERS: PlanTier[] = ["free", "pro", "team"];

function PricingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--paper, #f6f2ea)",
        color: "var(--ink, #1f1b16)",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.08))",
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <CadenceMark />
          <span className="font-display" style={{ fontSize: 14 }}>
            Cadence
          </span>
        </Link>
        <a
          href="/login"
          className="mono-label"
          style={{ fontSize: 9, color: "var(--ink-subtle, #6b6457)", textDecoration: "none" }}
        >
          Sign in
        </a>
      </header>

      <main style={{ flex: 1, display: "grid", placeItems: "center", padding: "44px 18px" }}>
        <div style={{ width: "100%", maxWidth: 920 }}>
          {/* Positioning */}
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h1
              className="font-display"
              style={{ fontSize: 34, lineHeight: 1.12, margin: "0 0 12px", fontWeight: 440 }}
            >
              Free to start. Pay to keep your <em style={{ fontStyle: "italic" }}>memory</em>.
            </h1>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--ink-subtle, #6b6457)",
                margin: "0 auto",
                maxWidth: 520,
              }}
            >
              Cadence runs your product loop for free. You upgrade only when you want your decision
              memory to compound instead of expire.
            </p>
          </div>

          {/* Tier cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
              alignItems: "start",
            }}
          >
            {TIERS.map((tier) => {
              const p = planPresentation(tier);
              const isPro = tier === "pro";
              return (
                <div
                  key={tier}
                  className="bento"
                  style={{
                    padding: "22px 22px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    border: isPro
                      ? "1px solid color-mix(in oklab, var(--ember, #c2622e) 55%, transparent)"
                      : "1px solid var(--hairline, rgba(0,0,0,0.08))",
                    background: isPro
                      ? "color-mix(in oklab, var(--ember, #c2622e) 5%, var(--canvas, #faf7ef))"
                      : "var(--canvas, #faf7ef)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span className="font-display" style={{ fontSize: 19, fontWeight: 460 }}>
                      {p.name}
                    </span>
                    {isPro ? (
                      <span
                        className="mono-label"
                        style={{
                          fontSize: 8.5,
                          color: "var(--ember, #c2622e)",
                          border:
                            "1px solid color-mix(in oklab, var(--ember, #c2622e) 40%, transparent)",
                          borderRadius: 99,
                          padding: "2px 8px",
                        }}
                      >
                        Recommended
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span className="font-display" style={{ fontSize: 26, fontWeight: 480 }}>
                      {p.price}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      color: "var(--ink-subtle, #6b6457)",
                      margin: 0,
                    }}
                  >
                    {p.tagline}
                  </p>

                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "4px 0 0",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {p.highlights.map((h, i) => (
                      <li
                        key={i}
                        style={{
                          display: "flex",
                          gap: 8,
                          fontSize: 13,
                          lineHeight: 1.45,
                          color: "var(--ink, #1f1b16)",
                        }}
                      >
                        <span style={{ color: "var(--moss-success, #4f8a59)", flexShrink: 0 }}>
                          ✓
                        </span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href="/signup?from=pricing"
                    className={isPro ? "btn btn-primary" : "btn btn-ghost"}
                    style={{ marginTop: 6, justifyContent: "center", width: "100%" }}
                  >
                    Start free →
                  </a>
                </div>
              );
            })}
          </div>

          <p
            style={{
              fontSize: 11.5,
              color: "var(--ink-faint, #8a8377)",
              textAlign: "center",
              marginTop: 24,
              lineHeight: 1.5,
            }}
          >
            Every plan starts free. Upgrade from Settings once you are in; nothing is charged until
            you choose to.
          </p>
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--hairline, rgba(0,0,0,0.08))",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--ink-subtle, #6b6457)",
        }}
      >
        <span className="mono-label" style={{ fontSize: 9 }}>
          Made with Cadence
        </span>
        <a
          href="/signup?from=pricing"
          className="btn btn-ghost btn-sm"
          style={{ textDecoration: "none" }}
        >
          Start free →
        </a>
      </footer>
    </div>
  );
}
