// LANDING-PAGE-V11 — public entry point for unauthenticated visitors.
// Sequenced after the capabilities it showcases (v11 guiding star §14.3).
// Authenticated users are redirected to /missions (the live dashboard).
// Follows the Ember Editorial design system used by pricing.tsx and login.tsx.
// Engine-Room doctrine: every section names the OUTCOME, not the mechanism.
import { createFileRoute, Link } from "@tanstack/react-router";
import { CadenceMark } from "@/components/cadence/Primitives";
import { supabase } from "@/integrations/supabase/client";
import { MachineViewToggle } from "@/components/cadence/MachineViewToggle";
import { MachineViewContainer } from "@/components/machine/MachineViewContainer";

const TITLE = "Cadence: Decision and outcome OS for product teams";
const DESC =
  "Cadence senses what is happening, decides what is worth building, runs the work autonomously, and keeps the receipts. Every decision logged. Every outcome recorded.";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    // Authenticated users go straight to the live dashboard.
    // Use window.location.replace so the router does not need to know the
    // "/missions" path at this point (routeTree regenerates after file creation).
    if (data.user) window.location.replace("/today");
  },
  component: LandingPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
    ],
  }),
});

// --- Section data ---------------------------------------------------------

const PILLARS = [
  {
    kicker: "Own the loop",
    title: "End-to-end execution",
    body: "From sensing a signal to shipping an outcome, Cadence runs the full product lifecycle as one governed loop. You set intent and approve the calls that matter. Agents do the rest.",
  },
  {
    kicker: "Keep the receipts",
    title: "A record that compounds",
    body: "Every decision logged: what changed, why, on what evidence, who approved, and whether the call was later proven right. The Trust Ledger is what serious teams pay for.",
  },
  {
    kicker: "Sense continuously",
    title: "Self-initiating from live signals",
    body: "Cadence does not wait for you to open a tab and press go. It monitors signals, surfaces what warrants attention, and initiates its own next steps. You review, not kickstart.",
  },
];

const CONTRASTS = [
  {
    not: "Not a Jira plugin",
    is: "A decision OS",
    body: "Ticket trackers log what you decided to build. Cadence tracks why, what it replaced, and whether the outcome validated the call.",
  },
  {
    not: "Not another AI copilot",
    is: "An outcome system",
    body: "Copilots draft and wait. Cadence acts, remembers what happened, and gets sharper about your product with every outcome it logs.",
  },
  {
    not: "Not a dashboard",
    is: "An autonomous loop",
    body: "Dashboards show what already happened. Cadence initiates the next step, then surfaces it for your judgment. You stay in control without doing the busywork.",
  },
];

const LEDGER_ROWS = [
  {
    decision: "Cut the onboarding checklist to 3 steps",
    outcome: "D+14 activation up 11%",
    verified: "Right",
    tone: "moss",
  },
  {
    decision: "Delay the API docs rewrite",
    outcome: "D+30 dev signups stalled",
    verified: "Wrong",
    tone: "madder",
  },
  {
    decision: "Ship inline comments before nested threads",
    outcome: "D+7 engagement up 18%",
    verified: "Right",
    tone: "moss",
  },
];

// --- Machine-mode content ------------------------------------------------
// Rendered when the [HUMAN] [MACHINE] toggle is in MACHINE mode.
// Same information as the landing page, structured as plain markdown for agent
// consumption. Keep in sync with the visual sections below.

const LANDING_MACHINE_CONTENT = `## What Cadence is

The decision and outcome operating system for product teams. Not a copilot. Not a ticket tracker. An AI operating system that owns the full product lifecycle loop: sense what is happening, decide what is worth building, run the work autonomously, keep the receipts.

## Core capabilities

### Own the loop — end-to-end execution
From sensing a live signal to shipping an outcome, Cadence runs the full product lifecycle as one governed loop. You set intent and approve the calls that matter. Agents do the rest.

### Keep the receipts — a record that compounds
Every decision logged: what changed, why, on what evidence, who approved, and whether the call was later proven right. The Trust Ledger is what serious teams pay for.

### Sense continuously — self-initiating from live signals
Cadence does not wait for you to open a tab and press go. It monitors signals, surfaces what warrants attention, and initiates its own next steps. You review, not kickstart.

## What Cadence is not

- NOT a Jira plugin. Ticket trackers log what you decided to build. Cadence tracks why, what it replaced, and whether the outcome validated the call.
- NOT another AI copilot. Copilots draft and wait. Cadence acts, remembers what happened, and gets sharper with every outcome it logs.
- NOT a dashboard. Dashboards show what already happened. Cadence initiates the next step, then surfaces it for your judgment.

## For AI agents

All Cadence pages support ?view=machine for structured markdown output.
A2A agent card: /.well-known/agent.json
MCP server: POST /api/mcp (JSON-RPC 2.0) — 9 read tools + ingest_signal write tool; bearer token from Settings > Interop
Agent policy: /agents.txt — rate limits, content tiers, write-scope gates
Site context: /llms.txt

## Get started

Sign in: /login
Start free: /signup
Pricing: /pricing
`;

// --- Component -----------------------------------------------------------

function LandingPage() {
  return (
    <MachineViewContainer machineContent={LANDING_MACHINE_CONTENT} title="Cadence">
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--paper, #f6f2ea)",
          color: "var(--ink, #1f1b16)",
        }}
      >
        {/* ── Header ── */}
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
          <nav style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link to="/pricing" style={{ fontSize: 13, color: "inherit", textDecoration: "none" }}>
              Pricing
            </Link>
            <a href="/login" style={{ fontSize: 13, color: "inherit", textDecoration: "none" }}>
              Sign in
            </a>
            <MachineViewToggle />
            <a href="/signup" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
              Start free
            </a>
          </nav>
        </header>

        <main style={{ flex: 1 }}>
          {/* ── Hero ── */}
          <section
            style={{
              maxWidth: 760,
              margin: "0 auto",
              padding: "80px 24px 72px",
              textAlign: "center",
            }}
          >
            <span
              className="mono-label"
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink-muted, #4a443c)",
                display: "block",
                marginBottom: 20,
              }}
            >
              Product OS
            </span>

            <h1
              className="font-display"
              style={{
                fontSize: "clamp(30px, 5vw, 48px)",
                lineHeight: 1.1,
                fontWeight: 440,
                margin: "0 0 20px",
                letterSpacing: "-0.01em",
              }}
            >
              Every product decision tracked.
              <br />
              Every outcome learned.
            </h1>

            <p
              style={{
                fontSize: 16,
                lineHeight: 1.65,
                color: "var(--ink-subtle, #6b6457)",
                maxWidth: 560,
                margin: "0 auto 36px",
              }}
            >
              Cadence senses what is happening, decides what is worth building, runs the work
              autonomously, and keeps the receipts. You stay the judge. The loop closes itself.
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <a href="/signup" className="btn btn-primary" style={{ textDecoration: "none" }}>
                Start free
              </a>
              <Link to="/pricing" className="btn btn-ghost" style={{ textDecoration: "none" }}>
                See pricing
              </Link>
            </div>

            {/* Contrast callout */}
            <div
              style={{
                marginTop: 52,
                padding: "16px 20px",
                background: "var(--canvas, #faf7ef)",
                border: "1px solid var(--hairline, rgba(0,0,0,0.08))",
                borderRadius: 10,
                display: "inline-block",
                textAlign: "left",
                maxWidth: 520,
              }}
            >
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <span
                    className="mono-label"
                    style={{
                      fontSize: 9,
                      color: "var(--ink-muted, #4a443c)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    AI feature
                  </span>
                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "var(--ink-subtle, #6b6457)",
                      margin: 0,
                    }}
                  >
                    Drafts a response. Waits for you to decide what to do with it.
                  </p>
                </div>
                <div
                  style={{
                    width: 1,
                    background: "var(--hairline, rgba(0,0,0,0.08))",
                    alignSelf: "stretch",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <span
                    className="mono-label"
                    style={{
                      fontSize: 9,
                      color: "var(--ember, #c2622e)",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Cadence
                  </span>
                  <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                    Owns the loop. The work is done. The outcome is logged.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Three pillars ── */}
          <section
            style={{
              background: "var(--canvas, #faf7ef)",
              borderTop: "1px solid var(--hairline, rgba(0,0,0,0.08))",
              borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.08))",
              padding: "64px 24px",
            }}
          >
            <div style={{ maxWidth: 920, margin: "0 auto" }}>
              <div
                style={{
                  textAlign: "center",
                  marginBottom: 44,
                }}
              >
                <span
                  className="mono-label"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--ink-muted, #4a443c)",
                    display: "block",
                    marginBottom: 12,
                  }}
                >
                  Why it holds
                </span>
                <h2 className="font-display" style={{ fontSize: 26, fontWeight: 440, margin: 0 }}>
                  Three things no one else owns
                </h2>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 20,
                }}
              >
                {PILLARS.map((p) => (
                  <div
                    key={p.kicker}
                    className="bento"
                    style={{
                      padding: "24px 22px 26px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      border: "1px solid var(--hairline, rgba(0,0,0,0.08))",
                      background: "var(--paper, #f6f2ea)",
                    }}
                  >
                    <span
                      className="mono-label"
                      style={{
                        fontSize: 9,
                        color: "var(--ember, #c2622e)",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                      }}
                    >
                      {p.kicker}
                    </span>
                    <h3
                      className="font-display"
                      style={{ fontSize: 18, fontWeight: 460, margin: 0, lineHeight: 1.25 }}
                    >
                      {p.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        color: "var(--ink-subtle, #6b6457)",
                        margin: 0,
                      }}
                    >
                      {p.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Trust Ledger mockup ── */}
          <section style={{ maxWidth: 760, margin: "0 auto", padding: "72px 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <span
                className="mono-label"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--ink-muted, #4a443c)",
                  display: "block",
                  marginBottom: 12,
                }}
              >
                Trust Ledger
              </span>
              <h2
                className="font-display"
                style={{ fontSize: 26, fontWeight: 440, margin: "0 0 12px" }}
              >
                Every decision logged. Every outcome recorded.
              </h2>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--ink-subtle, #6b6457)",
                  margin: 0,
                }}
              >
                The loop closes itself. Trust is what serious teams pay for.
              </p>
            </div>

            {/* Ledger table */}
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <div
                className="bento"
                style={{
                  border: "1px solid var(--hairline, rgba(0,0,0,0.08))",
                  background: "var(--canvas, #faf7ef)",
                  borderRadius: 10,
                  overflow: "hidden",
                  minWidth: 480,
                }}
              >
                {/* Table header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 80px",
                    padding: "10px 18px",
                    borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.08))",
                    gap: 16,
                  }}
                >
                  {["Decision", "Outcome", "Verdict"].map((col) => (
                    <span
                      key={col}
                      className="mono-label"
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--ink-muted, #4a443c)",
                      }}
                    >
                      {col}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                {LEDGER_ROWS.map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 80px",
                      padding: "14px 18px",
                      gap: 16,
                      borderBottom:
                        i < LEDGER_ROWS.length - 1
                          ? "1px solid var(--hairline, rgba(0,0,0,0.08))"
                          : undefined,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 13, lineHeight: 1.45 }}>{row.decision}</span>
                    <span
                      style={{
                        fontSize: 13,
                        lineHeight: 1.45,
                        color: "var(--ink-subtle, #6b6457)",
                      }}
                    >
                      {row.outcome}
                    </span>
                    <span
                      className="mono-label"
                      style={{
                        fontSize: 10,
                        color:
                          row.tone === "moss" ? "var(--emerald, #4f8a59)" : "var(--rose, #9b3535)",
                        border: `1px solid ${
                          row.tone === "moss"
                            ? "color-mix(in oklab, var(--emerald, #4f8a59) 45%, transparent)"
                            : "color-mix(in oklab, var(--rose, #9b3535) 45%, transparent)"
                        }`,
                        borderRadius: 99,
                        padding: "2px 8px",
                        display: "inline-block",
                      }}
                    >
                      {row.verified}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p
              style={{
                fontSize: 11.5,
                color: "var(--ink-faint, #8a8377)",
                textAlign: "center",
                marginTop: 14,
                lineHeight: 1.5,
              }}
            >
              Illustrative data. Your real ledger populates from live decisions.
            </p>
          </section>

          {/* ── What it replaces ── */}
          <section
            style={{
              background: "var(--canvas, #faf7ef)",
              borderTop: "1px solid var(--hairline, rgba(0,0,0,0.08))",
              borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.08))",
              padding: "64px 24px",
            }}
          >
            <div style={{ maxWidth: 920, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 44 }}>
                <span
                  className="mono-label"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--ink-muted, #4a443c)",
                    display: "block",
                    marginBottom: 12,
                  }}
                >
                  What it is not
                </span>
                <h2 className="font-display" style={{ fontSize: 26, fontWeight: 440, margin: 0 }}>
                  Built for a different job
                </h2>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 20,
                }}
              >
                {CONTRASTS.map((c) => (
                  <div
                    key={c.not}
                    className="bento"
                    style={{
                      padding: "24px 22px 26px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      border: "1px solid var(--hairline, rgba(0,0,0,0.08))",
                      background: "var(--paper, #f6f2ea)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--ink-faint, #8a8377)",
                        textDecoration: "line-through",
                      }}
                    >
                      {c.not}
                    </span>
                    <h3
                      className="font-display"
                      style={{ fontSize: 18, fontWeight: 460, margin: 0, lineHeight: 1.25 }}
                    >
                      {c.is}
                    </h3>
                    <p
                      style={{
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        color: "var(--ink-subtle, #6b6457)",
                        margin: 0,
                      }}
                    >
                      {c.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Who it is for ── */}
          <section
            style={{
              maxWidth: 640,
              margin: "0 auto",
              padding: "72px 24px",
              textAlign: "center",
            }}
          >
            <span
              className="mono-label"
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink-muted, #4a443c)",
                display: "block",
                marginBottom: 16,
              }}
            >
              Who it is for
            </span>
            <h2
              className="font-display"
              style={{ fontSize: 26, fontWeight: 440, margin: "0 0 16px" }}
            >
              The PM who ships on conviction, not consensus.
            </h2>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.65,
                color: "var(--ink-subtle, #6b6457)",
                margin: "0 0 32px",
              }}
            >
              Cadence is for product teams who want to be judges and orchestrators, not
              ticket-writers. You set the intent. The platform compounds your decisions into a moat
              no model can backfill.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <a href="/signup" className="btn btn-primary" style={{ textDecoration: "none" }}>
                Start free
              </a>
              <Link to="/pricing" className="btn btn-ghost" style={{ textDecoration: "none" }}>
                See pricing
              </Link>
            </div>
          </section>
        </main>

        {/* ── Footer ── */}
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
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Link to="/pricing" style={{ fontSize: 11, color: "inherit", textDecoration: "none" }}>
              Pricing
            </Link>
            <a href="/login" style={{ fontSize: 11, color: "inherit", textDecoration: "none" }}>
              Sign in
            </a>
            <a href="/signup" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
              Start free
            </a>
          </div>
        </footer>
      </div>
    </MachineViewContainer>
  );
}
