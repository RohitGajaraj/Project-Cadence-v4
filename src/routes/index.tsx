// LANDING-PAGE-V11 — consumer-ready public entry point.
// Full lifecycle: Sense -> Decide -> Define -> Build -> Ship -> Learn.
// Engine-Room doctrine: name the outcome, not the mechanism.
// Animations: CSS keyframes + station cycling + scroll reveals.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CadenceMark } from "@/components/cadence/Primitives";
import { supabase } from "@/integrations/supabase/client";
import { MachineViewToggle } from "@/components/cadence/MachineViewToggle";
import { MachineViewContainer } from "@/components/machine/MachineViewContainer";

const TITLE = "Cadence: From signal to shipped outcome";
const DESC =
  "Cadence notices signals, decides what is worth doing, defines the work, builds it, ships it, and records whether the call was right. Six stations. One autonomous loop.";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
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

// -------------------------------------------------------------------------
// Data
// -------------------------------------------------------------------------

const STATIONS = [
  {
    id: "sense",
    label: "Sense",
    number: "01",
    kicker: "Signals noticed",
    body: "Cadence monitors live sources continuously. User feedback, analytics shifts, engineering alerts, market moves. It clusters what relates, surfaces what warrants attention, and never waits for you to open a tab.",
    example: "3 user complaints about the same friction point clustered. Severity: rising.",
  },
  {
    id: "decide",
    label: "Decide",
    number: "02",
    kicker: "Call made, with evidence",
    body: "Every decision is weighed against your team's own precedent. What did a similar call produce last time? What was learned? Cadence surfaces the evidence, proposes the call, and waits for your approval.",
    example: "Friction fix ranked above the new feature. Precedent: similar fix drove D+14 activation +9%.",
  },
  {
    id: "define",
    label: "Define",
    number: "03",
    kicker: "Spec locked",
    body: "The spec writes itself: the rationale, acceptance criteria, edge cases. Every clause is grounded in the signal that triggered it. Nothing is invented. The document is a receipt, not a template.",
    example: "Spec written. 4 acceptance criteria. Linked to 6 supporting signals. Approved in 2 minutes.",
  },
  {
    id: "build",
    label: "Build",
    number: "04",
    kicker: "Agents running",
    body: "Specialist agents pick up the spec and run the execution. Cadence governs: it checks, approves pull requests at the merge gate, and escalates only the calls that genuinely need a human. Everything else runs.",
    example: "Builder agent: 3 commits. CI passed. Queued for your merge approval.",
  },
  {
    id: "ship",
    label: "Ship",
    number: "05",
    kicker: "Shipped",
    body: "The change deploys. Cadence notifies the team, timestamps the deploy, and immediately begins watching for the outcome signal the decision depends on. The loop is not closed until the outcome is in.",
    example: "Shipped 14:22. Watching activation rate. Expected signal in D+7 to D+14.",
  },
  {
    id: "learn",
    label: "Learn",
    number: "06",
    kicker: "Outcome logged",
    body: "The outcome arrives. Cadence records it: what happened, whether the call was right, and what to carry forward. The ledger grows. Future decisions on similar signals are smarter because of this one.",
    example: "D+14: activation up 8%. Call validated. Memory updated. Next signal of this class gets better precedent.",
  },
];

const SIGNALS = [
  "Activation drop detected in onboarding step 2 (-4% WoW)",
  "3 support tickets: users reporting 'can't find export'",
  "Competitor shipped feature parity on integrations",
  "API error rate spiked: 0.2% to 1.8% (15 min ago)",
  "NPS responses: 7 mentions of 'too many steps'",
  "PR merged: 4 related tests failing in CI",
  "Feature usage drop: bulk edit at 12% of sessions (was 23%)",
  "Changelog comment: 'this broke our workflow'",
];

const FLOW_STEPS = [
  {
    time: "09:14",
    label: "Signal surfaces",
    detail: "Analytics: signup-to-active drop. 3 sessions flagged with friction at onboarding step 2.",
    accent: "rgba(194,98,46,0.85)",
  },
  {
    time: "09:14",
    label: "Cluster formed",
    detail: "4 related signals linked. Cadence surfaces the cluster as a prioritization candidate.",
    accent: "rgba(140,90,153,0.85)",
  },
  {
    time: "09:15",
    label: "Decision proposed",
    detail: "Simplify onboarding step 2. Confidence: 84%. Precedent: similar fix drove +9% activation D+14.",
    accent: "rgba(79,138,89,0.85)",
  },
  {
    time: "09:17",
    label: "Approved",
    detail: "You tapped Approve. Spec locked in 90 seconds. Agents dispatched.",
    accent: "rgba(194,98,46,0.85)",
  },
  {
    time: "09:19",
    label: "Agents running",
    detail: "Builder agent: 2 commits. CI passing. Queued for merge gate. You approve the merge.",
    accent: "rgba(140,90,153,0.85)",
  },
  {
    time: "D+14",
    label: "Outcome logged",
    detail: "Activation up 8%. Call validated. Supersession edge written. The ledger is smarter.",
    accent: "rgba(79,138,89,0.85)",
  },
];

const LEDGER_ROWS = [
  { decision: "Simplify onboarding to 3 steps", outcome: "D+14: activation +11%", verdict: "Right", tone: "moss" },
  { decision: "Delay the docs rewrite to Q3", outcome: "D+30: dev signups stalled", verdict: "Wrong", tone: "madder" },
  { decision: "Ship inline comments before nested threads", outcome: "D+7: session depth +18%", verdict: "Right", tone: "moss" },
  { decision: "Invest in the API surface over mobile", outcome: "Q2: enterprise pipeline opened", verdict: "Right", tone: "moss" },
];

const CONTRASTS = [
  {
    not: "Not a copilot",
    is: "An operating system",
    body: "Copilots draft and wait. Cadence acts. The spec is written, the build is running, the outcome is logged. You review the gates that need you, not the ones that don't.",
  },
  {
    not: "Not a ticket tracker",
    is: "The loop that closes itself",
    body: "Trackers record what you decided to build. Cadence tracks why, what evidence drove it, what it superseded, and whether the outcome validated the call. Six months of that is a moat no one can backfill.",
  },
  {
    not: "Not a dashboard",
    is: "A self-initiating engine",
    body: "Dashboards show what already happened. Cadence surfaces what deserves a decision next, proposes the call, and waits for your nod. You govern without executing.",
  },
];

const MACHINE_CONTENT = `## What Cadence is

The autonomous operating system that closes the loop from first signal to final outcome. Six stations: Sense, Decide, Define, Build, Ship, Learn. One governed engine. Zero manual handoffs between stages.

## The six stations

### 01 Sense
Cadence monitors live sources continuously. Clusters what relates, surfaces what warrants attention.

### 02 Decide
Every decision weighed against your team's own precedent. Cadence surfaces evidence, proposes the call, waits for approval.

### 03 Define
The spec writes itself: rationale, acceptance criteria, edge cases. Every clause grounded in the signal that triggered it.

### 04 Build
Specialist agents run the execution. Cadence governs: checks, approves at the merge gate, escalates what genuinely needs a human.

### 05 Ship
The change deploys. Cadence begins watching for the outcome signal the decision depends on.

### 06 Learn
The outcome records what happened, whether the call was right, what to carry forward. The ledger grows.

## The moat

Every decision logged: what changed, why, on what evidence, who approved, and whether the call was later proven right or superseded. Eighteen months of that record cannot be backfilled.

## For AI agents

All pages support ?view=machine for structured markdown output.
A2A agent card: /.well-known/agent.json
MCP server: POST /api/mcp (JSON-RPC 2.0)
Agent policy: /agents.txt | Site context: /llms.txt

## Get started

Sign in: /login | Start free: /signup | Pricing: /pricing
`;

// -------------------------------------------------------------------------
// CSS
// -------------------------------------------------------------------------

const STYLES = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(22px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes connectorPulse {
    0%, 100% { opacity: 0.15; }
    50% { opacity: 0.55; }
  }
  @keyframes signalSlide {
    0% { opacity: 0; transform: translateY(6px); }
    12% { opacity: 1; transform: translateY(0); }
    88% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-6px); }
  }
  @keyframes dotOrbit {
    0% { transform: rotate(0deg) translateX(88px) rotate(0deg); }
    100% { transform: rotate(360deg) translateX(88px) rotate(-360deg); }
  }
  @keyframes ringRotate {
    to { transform: rotate(360deg); }
  }
  .station-pill {
    transition: background 0.35s cubic-bezier(0.23,1,0.32,1),
                border-color 0.35s cubic-bezier(0.23,1,0.32,1),
                color 0.35s cubic-bezier(0.23,1,0.32,1);
  }
  .station-card-lp {
    transition: transform 0.22s cubic-bezier(0.23,1,0.32,1),
                box-shadow 0.22s cubic-bezier(0.23,1,0.32,1),
                border-color 0.3s ease,
                background 0.3s ease;
  }
  .station-card-lp:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 28px rgba(0,0,0,0.09);
  }
  .contrast-card-lp {
    transition: transform 0.2s cubic-bezier(0.23,1,0.32,1),
                box-shadow 0.2s cubic-bezier(0.23,1,0.32,1);
  }
  .contrast-card-lp:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 22px rgba(0,0,0,0.07);
  }
  .lp-connector {
    animation: connectorPulse 2.4s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

// -------------------------------------------------------------------------
// Hooks
// -------------------------------------------------------------------------

function useActiveStation(count: number, ms = 2400) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % count), ms);
    return () => clearInterval(id);
  }, [count, ms]);
  return active;
}

function useSignalFeed(signals: string[], ms = 3400) {
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setShow(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % signals.length);
        setShow(true);
      }, 350);
    }, ms);
    return () => clearInterval(id);
  }, [signals.length, ms]);
  return { signal: signals[idx], show };
}

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setOn(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, on };
}

function useScrolled(px = 64) {
  const [s, setS] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fn = () => setS(window.scrollY > px);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [px]);
  return s;
}

// -------------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------------

function StationPills({ active }: { active: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 0,
        marginTop: 44,
      }}
    >
      {STATIONS.map((s, i) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
          <div
            className="station-pill mono-label"
            style={{
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "5px 13px",
              borderRadius: 99,
              border: i === active
                ? "1px solid rgba(194,98,46,0.6)"
                : "1px solid rgba(255,255,255,0.1)",
              background: i === active
                ? "rgba(194,98,46,0.16)"
                : "transparent",
              color: i === active
                ? "rgba(224,160,100,1)"
                : "rgba(255,255,255,0.28)",
              fontWeight: i === active ? 600 : 400,
            }}
          >
            {s.label}
          </div>
          {i < STATIONS.length - 1 && (
            <div
              className="lp-connector"
              style={{
                width: 16,
                height: 1,
                background: "rgba(255,255,255,0.12)",
                flexShrink: 0,
                animationDelay: `${i * 0.4}s`,
              }}
            />
          )}
        </div>
      ))}
      <div
        style={{
          marginLeft: 6,
          fontSize: 11,
          color: "rgba(224,160,100,0.4)",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        ↺
      </div>
    </div>
  );
}

function SignalFeed() {
  const { signal, show } = useSignalFeed(SIGNALS, 3400);
  return (
    <div
      style={{
        maxWidth: 500,
        margin: "32px auto 0",
        padding: "12px 18px",
        background: "rgba(0,0,0,0.28)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          className="mono-label"
          style={{
            fontSize: 8,
            color: "rgba(224,160,100,0.6)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            flexShrink: 0,
            paddingTop: 2,
          }}
        >
          Live
        </span>
        <p
          style={{
            fontSize: 12.5,
            lineHeight: 1.6,
            color: show ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0)",
            margin: 0,
            transition: "color 0.32s ease",
            fontFamily: "Schibsted Grotesk, sans-serif",
          }}
        >
          {signal}
        </p>
      </div>
    </div>
  );
}

function OrbitRing({ active }: { active: number }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 80;

  const nodes = STATIONS.map((s, i) => {
    const angle = (-90 + i * 60) * (Math.PI / 180);
    return {
      ...s,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      isActive: i === active,
    };
  });

  // active dot position
  const activeAngle = (-90 + active * 60) * (Math.PI / 180);
  const dotX = cx + r * Math.cos(activeAngle);
  const dotY = cy + r * Math.sin(activeAngle);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block", margin: "0 auto" }}
      aria-hidden="true"
    >
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth="1"
        strokeDasharray="3 5"
      />

      {/* Connecting spokes (subtle) */}
      {nodes.map((n) => (
        <line
          key={`spoke-${n.id}`}
          x1={cx}
          y1={cy}
          x2={n.x}
          y2={n.y}
          stroke={n.isActive ? "rgba(194,98,46,0.25)" : "rgba(255,255,255,0.04)"}
          strokeWidth="0.5"
          style={{ transition: "stroke 0.4s ease" }}
        />
      ))}

      {/* Node rings */}
      {nodes.map((n) => (
        <circle
          key={`ring-${n.id}`}
          cx={n.x}
          cy={n.y}
          r={n.isActive ? 12 : 0}
          fill="rgba(194,98,46,0.1)"
          style={{ transition: "r 0.4s cubic-bezier(0.23,1,0.32,1)" }}
        />
      ))}

      {/* Node dots */}
      {nodes.map((n) => (
        <circle
          key={`dot-${n.id}`}
          cx={n.x}
          cy={n.y}
          r={n.isActive ? 5.5 : 3.5}
          fill={n.isActive ? "#c2622e" : "rgba(255,255,255,0.22)"}
          style={{ transition: "r 0.4s cubic-bezier(0.23,1,0.32,1), fill 0.4s ease" }}
        />
      ))}

      {/* Glow on active */}
      <circle
        cx={dotX}
        cy={dotY}
        r={9}
        fill="rgba(194,98,46,0.18)"
        style={{ transition: "cx 0s, cy 0s" }}
      />

      {/* Center label */}
      <text
        x={cx}
        y={cy - 5}
        textAnchor="middle"
        fill="rgba(255,255,255,0.35)"
        fontSize="7"
        fontFamily="JetBrains Mono, monospace"
        letterSpacing="0.12em"
      >
        CADENCE
      </text>
      <text
        x={cx}
        y={cy + 7}
        textAnchor="middle"
        fill="rgba(255,255,255,0.18)"
        fontSize="6"
        fontFamily="JetBrains Mono, monospace"
        letterSpacing="0.1em"
      >
        LOOP
      </text>
    </svg>
  );
}

function StationGrid({ active }: { active: number }) {
  const { ref, on } = useReveal(0.05);

  return (
    <div ref={ref} style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
          gap: 14,
        }}
      >
        {STATIONS.map((s, i) => {
          const isActive = i === active;
          return (
            <div
              key={s.id}
              className="station-card-lp"
              style={{
                padding: "24px 20px 26px",
                border: isActive
                  ? "1px solid rgba(194,98,46,0.32)"
                  : "1px solid var(--hairline, rgba(0,0,0,0.08))",
                background: isActive
                  ? "color-mix(in oklab, var(--ember, #c2622e) 4%, var(--paper, #f6f2ea))"
                  : "var(--paper, #f6f2ea)",
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                opacity: on ? 1 : 0,
                transform: on ? "translateY(0)" : "translateY(22px)",
                transition: [
                  `opacity 0.52s cubic-bezier(0.23,1,0.32,1) ${i * 0.07}s`,
                  `transform 0.52s cubic-bezier(0.23,1,0.32,1) ${i * 0.07}s`,
                  "border-color 0.32s ease",
                  "background 0.32s ease",
                ].join(", "),
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  className="mono-label"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: isActive ? "var(--ember, #c2622e)" : "var(--ink-faint, #8a8377)",
                    transition: "color 0.32s ease",
                  }}
                >
                  {s.number} / {s.label}
                </span>
                {isActive && (
                  <span
                    className="mono-label"
                    style={{
                      fontSize: 8,
                      color: "var(--ember, #c2622e)",
                      border: "1px solid rgba(194,98,46,0.28)",
                      borderRadius: 99,
                      padding: "1px 7px",
                    }}
                  >
                    active
                  </span>
                )}
              </div>

              <h3
                className="font-display"
                style={{
                  fontSize: 18,
                  fontWeight: 450,
                  margin: 0,
                  lineHeight: 1.22,
                  color: "var(--ink, #2b211a)",
                }}
              >
                {s.kicker}
              </h3>

              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: "var(--ink-subtle, #8a7c6e)",
                  margin: 0,
                }}
              >
                {s.body}
              </p>

              <div
                style={{
                  marginTop: 4,
                  padding: "8px 12px",
                  background: "var(--canvas, #faf7ef)",
                  borderRadius: 8,
                  border: "1px solid var(--hairline, rgba(0,0,0,0.06))",
                }}
              >
                <span
                  className="mono-label"
                  style={{
                    fontSize: 8,
                    color: "var(--ink-faint, #8a8377)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Example
                </span>
                <p
                  style={{
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: "var(--ink-muted, #6b5d51)",
                    margin: 0,
                  }}
                >
                  {s.example}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlowSection() {
  const { ref, on } = useReveal(0.08);
  return (
    <section
      style={{
        background: "var(--hero-bg, #45332b)",
        padding: "88px 24px",
      }}
    >
      <div ref={ref} style={{ maxWidth: 700, margin: "0 auto" }}>
        <div
          style={{
            textAlign: "center",
            marginBottom: 56,
            opacity: on ? 1 : 0,
            transform: on ? "translateY(0)" : "translateY(18px)",
            transition: "opacity 0.55s cubic-bezier(0.23,1,0.32,1), transform 0.55s cubic-bezier(0.23,1,0.32,1)",
          }}
        >
          <span
            className="mono-label"
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(224,160,100,0.5)",
              display: "block",
              marginBottom: 14,
            }}
          >
            One session, start to finish
          </span>
          <h2
            className="font-display"
            style={{
              fontSize: "clamp(22px, 3.5vw, 32px)",
              fontWeight: 440,
              color: "rgba(255,255,255,0.9)",
              margin: "0 0 14px",
              lineHeight: 1.18,
            }}
          >
            Friction spotted to shipped in under two hours.
          </h2>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.38)",
              maxWidth: 440,
              margin: "0 auto",
            }}
          >
            Here is what the loop looks like when it runs on a real signal.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {FLOW_STEPS.map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 18,
                opacity: on ? 1 : 0,
                transform: on ? "translateX(0)" : "translateX(-18px)",
                transition: `opacity 0.5s cubic-bezier(0.23,1,0.32,1) ${0.1 + i * 0.1}s, transform 0.5s cubic-bezier(0.23,1,0.32,1) ${0.1 + i * 0.1}s`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 32,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: step.accent,
                    boxShadow: `0 0 10px ${step.accent}`,
                    flexShrink: 0,
                    marginTop: 16,
                  }}
                />
                {i < FLOW_STEPS.length - 1 && (
                  <div
                    style={{
                      width: 1,
                      flex: 1,
                      minHeight: 28,
                      background: "rgba(255,255,255,0.07)",
                      margin: "4px 0",
                    }}
                  />
                )}
              </div>
              <div style={{ paddingBottom: i < FLOW_STEPS.length - 1 ? 28 : 0, paddingTop: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    marginBottom: 5,
                  }}
                >
                  <span
                    className="mono-label"
                    style={{
                      fontSize: 8,
                      color: "rgba(255,255,255,0.25)",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {step.time}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.82)",
                      fontFamily: "Schibsted Grotesk, sans-serif",
                    }}
                  >
                    {step.label}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.65,
                    color: "rgba(255,255,255,0.4)",
                    margin: 0,
                  }}
                >
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LedgerSection() {
  const { ref, on } = useReveal(0.1);
  return (
    <section ref={ref} style={{ maxWidth: 820, margin: "0 auto", padding: "96px 24px" }}>
      <div
        style={{
          textAlign: "center",
          marginBottom: 44,
          opacity: on ? 1 : 0,
          transform: on ? "translateY(0)" : "translateY(18px)",
          transition: "opacity 0.55s cubic-bezier(0.23,1,0.32,1), transform 0.55s cubic-bezier(0.23,1,0.32,1)",
        }}
      >
        <span
          className="mono-label"
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--ink-faint, #8a8377)",
            display: "block",
            marginBottom: 14,
          }}
        >
          Trust Ledger
        </span>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(22px, 3vw, 30px)",
            fontWeight: 440,
            margin: "0 0 12px",
          }}
        >
          What accumulates. What you can prove.
        </h2>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: "var(--ink-subtle, #8a7c6e)",
            maxWidth: 500,
            margin: "0 auto",
          }}
        >
          Every call logged: what changed, why, on what evidence, who approved, and whether the outcome
          validated it. Eighteen months of this is something no model can reconstruct.
        </p>
      </div>

      <div
        style={{
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          opacity: on ? 1 : 0,
          transform: on ? "translateY(0)" : "translateY(16px)",
          transition:
            "opacity 0.55s cubic-bezier(0.23,1,0.32,1) 0.14s, transform 0.55s cubic-bezier(0.23,1,0.32,1) 0.14s",
        }}
      >
        <div
          style={{
            border: "1px solid var(--hairline, rgba(0,0,0,0.08))",
            background: "var(--canvas, #faf7ef)",
            borderRadius: 12,
            overflow: "hidden",
            minWidth: 540,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 100px",
              padding: "10px 20px",
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
                  color: "var(--ink-faint, #8a8377)",
                }}
              >
                {col}
              </span>
            ))}
          </div>
          {LEDGER_ROWS.map((row, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 100px",
                padding: "16px 20px",
                gap: 16,
                borderBottom:
                  i < LEDGER_ROWS.length - 1
                    ? "1px solid var(--hairline, rgba(0,0,0,0.06))"
                    : undefined,
                alignItems: "center",
                opacity: on ? 1 : 0,
                transform: on ? "translateX(0)" : "translateX(-10px)",
                transition: `opacity 0.5s cubic-bezier(0.23,1,0.32,1) ${0.22 + i * 0.08}s, transform 0.5s cubic-bezier(0.23,1,0.32,1) ${0.22 + i * 0.08}s`,
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1.48 }}>{row.decision}</span>
              <span style={{ fontSize: 13, lineHeight: 1.48, color: "var(--ink-subtle, #8a7c6e)" }}>
                {row.outcome}
              </span>
              <span
                className="mono-label"
                style={{
                  fontSize: 10,
                  color:
                    row.tone === "moss"
                      ? "var(--moss-success, #4f8a59)"
                      : "var(--madder-alert, #b14a44)",
                  border: `1px solid ${
                    row.tone === "moss"
                      ? "color-mix(in oklab, var(--moss-success, #4f8a59) 38%, transparent)"
                      : "color-mix(in oklab, var(--madder-alert, #b14a44) 38%, transparent)"
                  }`,
                  borderRadius: 99,
                  padding: "2px 9px",
                  display: "inline-block",
                }}
              >
                {row.verdict}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p
        style={{
          fontSize: 11,
          color: "var(--ink-faint, #8a8377)",
          textAlign: "center",
          marginTop: 12,
          opacity: on ? 0.7 : 0,
          transition: "opacity 0.5s ease 0.55s",
        }}
      >
        Illustrative. Your real ledger populates from live calls and outcomes.
      </p>
    </section>
  );
}

function ContrastsSection() {
  const { ref, on } = useReveal(0.08);
  return (
    <section
      ref={ref}
      style={{
        background: "var(--canvas, #faf7ef)",
        borderTop: "1px solid var(--hairline, rgba(0,0,0,0.06))",
        borderBottom: "1px solid var(--hairline, rgba(0,0,0,0.06))",
        padding: "88px 24px",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div
          style={{
            textAlign: "center",
            marginBottom: 52,
            opacity: on ? 1 : 0,
            transform: on ? "translateY(0)" : "translateY(18px)",
            transition:
              "opacity 0.55s cubic-bezier(0.23,1,0.32,1), transform 0.55s cubic-bezier(0.23,1,0.32,1)",
          }}
        >
          <span
            className="mono-label"
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-faint, #8a8377)",
              display: "block",
              marginBottom: 14,
            }}
          >
            Built for a different job
          </span>
          <h2
            className="font-display"
            style={{
              fontSize: "clamp(22px, 3vw, 30px)",
              fontWeight: 440,
              margin: 0,
            }}
          >
            Not a feature. Not a copilot. Not a dashboard.
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {CONTRASTS.map((c, i) => (
            <div
              key={c.not}
              className="contrast-card-lp bento"
              style={{
                padding: "26px 22px 28px",
                border: "1px solid var(--hairline, rgba(0,0,0,0.08))",
                background: "var(--paper, #f6f2ea)",
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                opacity: on ? 1 : 0,
                transform: on ? "translateY(0)" : "translateY(22px)",
                transition: `opacity 0.52s cubic-bezier(0.23,1,0.32,1) ${i * 0.1}s, transform 0.52s cubic-bezier(0.23,1,0.32,1) ${i * 0.1}s`,
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
                style={{ fontSize: 19, fontWeight: 455, margin: 0, lineHeight: 1.22 }}
              >
                {c.is}
              </h3>
              <p
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.65,
                  color: "var(--ink-subtle, #8a7c6e)",
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
  );
}

function WhoSection() {
  const { ref, on } = useReveal(0.12);
  return (
    <section
      ref={ref}
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "88px 24px",
        textAlign: "center",
        opacity: on ? 1 : 0,
        transform: on ? "translateY(0)" : "translateY(18px)",
        transition:
          "opacity 0.55s cubic-bezier(0.23,1,0.32,1), transform 0.55s cubic-bezier(0.23,1,0.32,1)",
      }}
    >
      <span
        className="mono-label"
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink-faint, #8a8377)",
          display: "block",
          marginBottom: 16,
        }}
      >
        Who it is for
      </span>
      <h2
        className="font-display"
        style={{ fontSize: "clamp(22px, 3.5vw, 30px)", fontWeight: 440, margin: "0 0 16px" }}
      >
        Teams who want the loop closed, not just a smarter draft.
      </h2>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--ink-subtle, #8a7c6e)",
          margin: "0 0 36px",
        }}
      >
        If you want to govern the calls that matter and let the rest run, Cadence is the engine. You
        set intent. The six stations do the rest. The ledger compounds.
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
  );
}

function CtaSection() {
  const { ref, on } = useReveal(0.12);
  return (
    <section
      style={{
        background: "var(--hero-bg, #45332b)",
        padding: "96px 24px",
        textAlign: "center",
      }}
    >
      <div
        ref={ref}
        style={{
          maxWidth: 560,
          margin: "0 auto",
          opacity: on ? 1 : 0,
          transform: on ? "translateY(0)" : "translateY(22px)",
          transition:
            "opacity 0.6s cubic-bezier(0.23,1,0.32,1), transform 0.6s cubic-bezier(0.23,1,0.32,1)",
        }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(26px, 4.5vw, 40px)",
            fontWeight: 440,
            color: "rgba(255,255,255,0.9)",
            margin: "0 0 16px",
            lineHeight: 1.12,
          }}
        >
          The loop is wired.
          <br />
          Put your signal in.
        </h2>
        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.42)",
            margin: "0 0 38px",
          }}
        >
          Start free. Bring your own signal source or use the webhook. The ledger starts from the
          first call you make.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/signup" className="btn btn-primary" style={{ textDecoration: "none" }}>
            Start free
          </a>
          <Link
            to="/pricing"
            className="btn btn-ghost"
            style={{
              textDecoration: "none",
              color: "rgba(255,255,255,0.52)",
              borderColor: "rgba(255,255,255,0.14)",
            }}
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

function LandingPage() {
  const active = useActiveStation(6, 2400);
  const scrolled = useScrolled(56);
  const { ref: loopHeadRef, on: loopHeadOn } = useReveal(0.05);

  return (
    <MachineViewContainer machineContent={MACHINE_CONTENT} title="Cadence">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--paper, #f6f2ea)",
          color: "var(--ink, #2b211a)",
        }}
      >
        {/* Sticky nav */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: scrolled
              ? "rgba(52,38,33,0.95)"
              : "var(--hero-bg, #45332b)",
            backdropFilter: scrolled ? "blur(14px)" : "none",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            transition:
              "background 0.3s ease, backdrop-filter 0.3s ease",
          }}
        >
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
            }}
          >
            <CadenceMark />
            <span
              className="font-display"
              style={{ fontSize: 14, color: "rgba(255,255,255,0.82)" }}
            >
              Cadence
            </span>
          </Link>
          <nav style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link
              to="/pricing"
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.5)",
                textDecoration: "none",
              }}
            >
              Pricing
            </Link>
            <a
              href="/login"
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.5)",
                textDecoration: "none",
              }}
            >
              Sign in
            </a>
            <MachineViewToggle />
            <a href="/signup" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
              Start free
            </a>
          </nav>
        </header>

        <main style={{ flex: 1 }}>
          {/* Hero */}
          <section
            style={{
              background: "var(--hero-bg, #45332b)",
              padding: "84px 24px 80px",
              textAlign: "center",
            }}
          >
            <div style={{ maxWidth: 780, margin: "0 auto" }}>
              <span
                className="mono-label"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(224,160,100,0.55)",
                  display: "block",
                  marginBottom: 28,
                  animation: "fadeIn 0.8s ease both",
                }}
              >
                Autonomous loop
              </span>

              {/* Orbit diagram */}
              <div
                style={{
                  margin: "0 auto 32px",
                  animation: "fadeIn 0.9s ease 0.1s both",
                }}
              >
                <OrbitRing active={active} />
              </div>

              <h1
                className="font-display"
                style={{
                  fontSize: "clamp(32px, 5.5vw, 54px)",
                  lineHeight: 1.08,
                  fontWeight: 440,
                  margin: "0 0 6px",
                  letterSpacing: "-0.02em",
                  color: "rgba(255,255,255,0.92)",
                  animation: "fadeInUp 0.7s cubic-bezier(0.23,1,0.32,1) 0.15s both",
                }}
              >
                Notice. Decide. Define.
              </h1>
              <h1
                className="font-display"
                style={{
                  fontSize: "clamp(32px, 5.5vw, 54px)",
                  lineHeight: 1.08,
                  fontWeight: 440,
                  margin: "0 0 30px",
                  letterSpacing: "-0.02em",
                  color: "rgba(255,255,255,0.5)",
                  animation: "fadeInUp 0.7s cubic-bezier(0.23,1,0.32,1) 0.22s both",
                }}
              >
                Build. Ship. Learn.
              </h1>

              <p
                style={{
                  fontSize: "clamp(14px, 1.8vw, 16px)",
                  lineHeight: 1.72,
                  color: "rgba(255,255,255,0.44)",
                  maxWidth: 520,
                  margin: "0 auto 36px",
                  animation: "fadeInUp 0.7s cubic-bezier(0.23,1,0.32,1) 0.3s both",
                }}
              >
                Cadence runs the whole loop. From the first signal to the final outcome, every step
                is owned by the engine. You govern the calls that matter. Agents handle everything else.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  flexWrap: "wrap",
                  animation: "fadeInUp 0.7s cubic-bezier(0.23,1,0.32,1) 0.38s both",
                }}
              >
                <a href="/signup" className="btn btn-primary" style={{ textDecoration: "none" }}>
                  Start free
                </a>
                <Link
                  to="/pricing"
                  className="btn btn-ghost"
                  style={{
                    textDecoration: "none",
                    color: "rgba(255,255,255,0.52)",
                    borderColor: "rgba(255,255,255,0.14)",
                  }}
                >
                  See pricing
                </Link>
              </div>

              <div
                style={{ animation: "fadeInUp 0.7s cubic-bezier(0.23,1,0.32,1) 0.46s both" }}
              >
                <StationPills active={active} />
              </div>

              <div
                style={{ animation: "fadeInUp 0.7s cubic-bezier(0.23,1,0.32,1) 0.54s both" }}
              >
                <SignalFeed />
              </div>
            </div>
          </section>

          {/* Six stations */}
          <section style={{ padding: "96px 24px" }}>
            <div ref={loopHeadRef} style={{ maxWidth: 1000, margin: "0 auto" }}>
              <div
                style={{
                  textAlign: "center",
                  marginBottom: 56,
                  opacity: loopHeadOn ? 1 : 0,
                  transform: loopHeadOn ? "translateY(0)" : "translateY(18px)",
                  transition:
                    "opacity 0.55s cubic-bezier(0.23,1,0.32,1), transform 0.55s cubic-bezier(0.23,1,0.32,1)",
                }}
              >
                <span
                  className="mono-label"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--ink-faint, #8a8377)",
                    display: "block",
                    marginBottom: 14,
                  }}
                >
                  Six stations. One loop.
                </span>
                <h2
                  className="font-display"
                  style={{
                    fontSize: "clamp(22px, 3vw, 30px)",
                    fontWeight: 440,
                    margin: "0 0 12px",
                  }}
                >
                  Every station, owned.
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: "var(--ink-subtle, #8a7c6e)",
                    maxWidth: 480,
                    margin: "0 auto",
                  }}
                >
                  Most tools own one station. Copilots draft specs. Trackers log tasks. Build tools
                  ship code. Cadence owns all six, in sequence, as one governed engine.
                </p>
              </div>

              <StationGrid active={active} />
            </div>
          </section>

          {/* Flow story */}
          <FlowSection />

          {/* Trust Ledger */}
          <LedgerSection />

          {/* Contrasts */}
          <ContrastsSection />

          {/* Who it's for */}
          <WhoSection />

          {/* CTA */}
          <CtaSection />
        </main>

        <footer
          style={{
            background: "var(--hero-bg, #45332b)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            className="mono-label"
            style={{ fontSize: 9, color: "rgba(255,255,255,0.22)" }}
          >
            Made with Cadence
          </span>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link
              to="/pricing"
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.38)",
                textDecoration: "none",
              }}
            >
              Pricing
            </Link>
            <a
              href="/login"
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.38)",
                textDecoration: "none",
              }}
            >
              Sign in
            </a>
            <a
              href="/signup"
              className="btn btn-primary btn-sm"
              style={{ textDecoration: "none" }}
            >
              Start free
            </a>
          </div>
        </footer>
      </div>
    </MachineViewContainer>
  );
}
