// LANDING-PAGE-V11 - full redesign. Electric violet on near-black.
// Voice: Cadence IS the actor. OS-level, not just an agent. Six stations plus what lies beyond.
// Design: one dark canvas, glassmorphism, sequential dot flow, labeled orbit ring centered.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MachineViewToggle } from "@/components/cadence/MachineViewToggle";
import { MachineViewContainer } from "@/components/machine/MachineViewContainer";
import { CadenceMark } from "@/components/cadence/Primitives";

const TITLE = "Cadence: The product OS that runs your entire product lifecycle";
const DESC =
  "Cadence is the product operating system that owns your full product lifecycle, from first signal to final outcome. Six stations. One loop. You govern the calls that matter. Everything else runs.";

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

// Design tokens
const C = {
  bg: "#07070f",
  bgCard: "rgba(255,255,255,0.034)",
  bgCardHot: "rgba(139,92,246,0.1)",
  border: "rgba(255,255,255,0.07)",
  borderHot: "rgba(167,139,250,0.38)",
  violet: "#8b5cf6",
  violetBright: "#a78bfa",
  violetGlow: "rgba(167,139,250,0.3)",
  violetDim: "rgba(139,92,246,0.15)",
  cyan: "#67e8f9",
  cyanDim: "rgba(103,232,249,0.15)",
  green: "#4ade80",
  greenGlow: "rgba(74,222,128,0.35)",
  greenDim: "rgba(74,222,128,0.15)",
  rose: "#f87171",
  roseGlow: "rgba(248,113,113,0.35)",
  amber: "#fbbf24",
  amberGlow: "rgba(251,191,36,0.35)",
  // Ember orange - the Cadence brand signature (tuned to the reference #fb7100).
  // Used for the product itself: wordmark, hero, CTAs, and the memory/brain core.
  ember: "#fb7100",
  emberBright: "#ff9542",
  emberGlow: "rgba(251,113,0,0.4)",
  emberDim: "rgba(251,113,0,0.12)",
  emberBorder: "rgba(251,113,0,0.42)",
  text: "#f8fafc",
  muted: "#94a3b8",
  faint: "#475569",
  divider: "rgba(255,255,255,0.06)",
};

// Station data
const STATIONS = [
  {
    id: "sense",
    num: "01",
    label: "Sense",
    icon: "◎",
    kicker: "The signal arrives",
    orbitKicker: "any source, live",
    body: "Cadence watches live sources: usage drops, support spikes, CI failures, market moves. It clusters what relates and surfaces what warrants a decision.",
    live: "3 onboarding complaints clustered. Severity: rising. D+7 activation at risk.",
    color: C.cyan,
    glow: C.cyanDim,
  },
  {
    id: "decide",
    num: "02",
    label: "Decide",
    icon: "◈",
    kicker: "The call is made",
    orbitKicker: "memory-backed",
    body: "Every decision runs against your team's own precedent. What did a similar call produce? Was it right? Cadence proposes the call and waits for your approval.",
    live: "Friction fix ranked #1. Precedent: similar call drove D+14 activation +9%. Confidence 84%.",
    color: C.violetBright,
    glow: C.violetDim,
  },
  {
    id: "define",
    num: "03",
    label: "Define",
    icon: "◧",
    kicker: "The spec writes itself",
    orbitKicker: "evidence-linked",
    body: "The spec is grounded in the signal that triggered it: rationale, acceptance criteria, edge cases. Every clause has a source. Nothing is invented.",
    live: "Spec: 4 acceptance criteria. Linked to 6 signals. Approved in 90 seconds.",
    color: C.violetBright,
    glow: C.violetDim,
  },
  {
    id: "build",
    num: "04",
    label: "Build",
    icon: "◱",
    kicker: "Agents run the execution",
    orbitKicker: "CI-governed",
    body: "Specialist agents pick up the spec. Cadence governs: checks their work, approves at the merge gate, escalates what genuinely needs a human.",
    live: "3 commits. CI passing. Queued for your merge approval. ETA to ship: 8 min.",
    color: C.amber,
    glow: "rgba(251,191,36,0.12)",
  },
  {
    id: "ship",
    num: "05",
    label: "Ship",
    icon: "◮",
    kicker: "Deployed and watching",
    orbitKicker: "outcome-tracked",
    body: "The change deploys. Cadence notifies the team, timestamps the deploy, and immediately begins tracking the outcome signal the decision depends on.",
    live: "Shipped 14:22. Watching activation rate. Signal expected D+7 to D+14.",
    color: C.green,
    glow: C.greenDim,
  },
  {
    id: "learn",
    num: "06",
    label: "Learn",
    icon: "◉",
    kicker: "The outcome lands",
    orbitKicker: "brain updated",
    body: "D+14 arrives. Cadence records what happened, whether the call was right, and writes a supersession edge so the next similar signal gets smarter precedent.",
    live: "D+14: activation +8%. Call validated. Supersession written. Brain updated.",
    color: C.green,
    glow: C.greenDim,
  },
];

// What each station writes into the memory core - varies the live status line.
const MEM_WRITES: Record<string, string> = {
  sense: "the signal, remembered",
  decide: "the rationale, recorded",
  define: "the spec, linked to evidence",
  build: "the change, captured",
  ship: "the release, timestamped",
  learn: "the outcome, written back",
};

type LogEntry = { ts: string; tag: string; msg: string; col: string; brand?: boolean };

const SUCCESS_LOG: LogEntry[] = [
  { ts: "09:14:03", tag: "SENSE", col: C.cyan, msg: "Activation drop -4% WoW flagged" },
  {
    ts: "09:14:03",
    tag: "CLUSTER",
    col: C.muted,
    msg: "3 signals linked: onboarding friction pattern",
  },
  {
    ts: "09:14:04",
    tag: "CADENCE",
    col: C.violetBright,
    msg: "Decision proposed: simplify onboarding step 2",
    brand: true,
  },
  {
    ts: "09:14:05",
    tag: "EVIDENCE",
    col: C.muted,
    msg: "Confidence 84% | similar call: D+14 activation +9%",
  },
  { ts: "09:15:22", tag: "APPROVE", col: C.faint, msg: "You approved (2 seconds)" },
  {
    ts: "09:15:23",
    tag: "DEFINE",
    col: C.violetBright,
    msg: "Spec locked: 4 criteria, 6 linked signals",
    brand: true,
  },
  { ts: "09:15:45", tag: "BUILD", col: C.amber, msg: "Agent dispatched: 3 commits" },
  { ts: "09:16:12", tag: "CI", col: C.green, msg: "All 14 tests passing" },
  { ts: "09:17:01", tag: "SHIP", col: C.green, msg: "Deployed to production 14:22" },
  { ts: "09:17:01", tag: "WATCH", col: C.faint, msg: "Monitoring for D+14 outcome signal..." },
  {
    ts: "D+14",
    tag: "LEARN",
    col: C.green,
    msg: "Activation +8%. Call validated. Memory updated.",
    brand: true,
  },
];

const FAIL_LOG: LogEntry[] = [
  { ts: "11:43:17", tag: "BUILD", col: C.amber, msg: "Agent dispatched" },
  {
    ts: "11:43:22",
    tag: "CI",
    col: C.rose,
    msg: "FAILED: 3 tests red, API contract mismatch in step 3",
  },
  { ts: "11:43:22", tag: "CADENCE", col: C.violetBright, msg: "Diagnosing failure", brand: true },
  {
    ts: "11:43:23",
    tag: "ROOT CAUSE",
    col: C.muted,
    msg: "Response schema changed: field 'user_id' to 'uid'",
  },
  {
    ts: "11:43:24",
    tag: "CADENCE",
    col: C.violetBright,
    msg: "Spec revised automatically",
    brand: true,
  },
  { ts: "11:43:31", tag: "BUILD", col: C.amber, msg: "Rebuild: 1 corrected commit" },
  { ts: "11:43:44", tag: "CI", col: C.green, msg: "All 17 tests passing" },
  {
    ts: "11:43:45",
    tag: "SHIP",
    col: C.green,
    msg: "Deployed. Cadence never stopped.",
    brand: true,
  },
];

const LEDGER_ROWS = [
  {
    decision: "Simplify onboarding to 3 steps",
    outcome: "D+14: activation +11%",
    verdict: "Right",
    col: C.green,
  },
  {
    decision: "Delay docs rewrite to Q3",
    outcome: "D+30: dev signups stalled",
    verdict: "Wrong",
    col: C.rose,
  },
  {
    decision: "Inline comments before nested threads",
    outcome: "D+7: session depth +18%",
    verdict: "Right",
    col: C.green,
  },
  {
    decision: "API surface over mobile app",
    outcome: "Q2: enterprise pipeline",
    verdict: "Right",
    col: C.green,
  },
];

const MOAT_PILLARS = [
  {
    icon: "◈",
    title: "Decision layer",
    body: "Every call runs against two things: your product's history of decisions and outcomes, and the judgment, taste, and standards your team has established over time. Generic AI trains on the internet. Cadence trains on your product and your craft.",
    col: C.ember,
  },
  {
    icon: "◉",
    title: "Outcome memory",
    body: "Every signal that came in, every spec that got written, every feature that shipped, every user who reacted. The full product journey writes into every future call. No human has to remember. The system does.",
    col: C.amber,
  },
  {
    icon: "◱",
    title: "Compounding edge",
    body: "It compounds from the first call. Every outcome makes the next decision sharper. Day one, it closes the loop. The longer it runs, the more of your product's institutional intelligence it holds. There is no backfill. There is no shortcut.",
    col: C.emberBright,
  },
];

const STATS = [
  { n: "6", label: "stations, one loop" },
  { n: "0", label: "handoffs between steps" },
  { n: "D+14", label: "outcome signal, always" },
  { n: "100%", label: "auditable, every call" },
];

const MACHINE_CONTENT = `## Cadence - The product OS for the full product lifecycle

Cadence is the product operating system that owns your entire product lifecycle end to end.
Six stations: Sense, Decide, Define, Build, Ship, Learn.
One governed engine. Zero manual handoffs.

When something breaks, Cadence diagnoses, revises the spec, and recovers autonomously.

## Agent interfaces
- A2A agent card: /.well-known/agent.json
- MCP server: POST /api/mcp (JSON-RPC 2.0)
- Machine-readable site: /llms.txt

## Get started
Sign in: /login | Start free: /signup | Pricing: /pricing
`;

// Styles
const STYLES = `
  @keyframes fadeIn   { from{opacity:0}               to{opacity:1} }
  @keyframes fadeUp   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeLeft { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
  @keyframes termBlink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes gradShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes connPulse { 0%,100%{opacity:0.1} 50%{opacity:0.5} }
  @keyframes bgFloat   { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-12px) scale(1.03)} }
  @keyframes cursorBlink { 0%,100%{opacity:1} 49%{opacity:1} 50%{opacity:0} 99%{opacity:0} }
  @keyframes scanLine  { from{transform:translateY(-100%)} to{transform:translateY(400%)} }
  @keyframes activeRingPulse { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.8);opacity:0} }
  @keyframes orbitNodePulse  { 0%{r:7} 50%{r:9} 100%{r:7} }

  .lp-card {
    transition: border-color 0.22s ease, background 0.22s ease,
                transform 0.24s cubic-bezier(0.23,1,0.32,1), box-shadow 0.24s ease;
  }
  .lp-card:hover {
    transform: translateY(-4px);
    border-color: var(--accent, rgba(255,255,255,0.26)) !important;
    box-shadow: 0 22px 56px rgba(0,0,0,0.55), 0 0 30px var(--accent-soft, rgba(255,255,255,0.05)), inset 0 1px 0 rgba(255,255,255,0.08);
  }
  .lp-card:hover .lp-card-icon { transform: translateY(-2px) scale(1.06); }
  .lp-card-icon { transition: transform 0.24s cubic-bezier(0.23,1,0.32,1); }
  .lp-conn { animation: connPulse 2.8s ease-in-out infinite; }
  .bg-float { animation: bgFloat 7s ease-in-out infinite; }

  /* Interactive chrome: ghost buttons, nav links, ledger rows */
  .lp-ghost { transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease, transform 0.2s ease; }
  .lp-ghost:hover { color:#fff !important; border-color: rgba(251,113,0,0.5) !important; background: rgba(251,113,0,0.07); transform: translateY(-1px); }
  .lp-nav { transition: color 0.18s ease; }
  .lp-nav:hover { color:#fff !important; }
  .lp-ledger-row { transition: background 0.25s ease, border-left-color 0.4s ease; }
  .lp-ledger-row:hover { background: rgba(255,255,255,0.04) !important; }

  /* Glowing orange "writing to memory" text - highlight drifts left to right */
  @keyframes memShimmer { 0% { background-position: 210% 0 } 100% { background-position: -70% 0 } }
  .lp-memwrite {
    background: linear-gradient(90deg, rgba(251,113,0,0.5) 0%, #ffb870 42%, #fff1de 50%, #ffb870 58%, rgba(251,113,0,0.5) 100%);
    background-size: 220% 100%;
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
    animation: memShimmer 2.6s linear infinite;
  }
  /* Hero headline sheen - a bright band sweeps across "Agents do." */
  @keyframes headSheen { 0% { background-position: 120% 50% } 100% { background-position: -80% 50% } }
  .lp-agentsdo {
    background: linear-gradient(110deg, #fb7100 0%, #ff9542 24%, #ffd9a0 42%, #fff4e3 50%, #ffd9a0 58%, #ff9542 76%, #fb7100 100%);
    background-size: 230% 100%;
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
    animation: headSheen 5s linear infinite;
    filter: drop-shadow(0 0 26px rgba(251,113,0,0.26));
  }
  /* Space backdrop - slow nebula drift */
  @keyframes auroraDrift { 0%,100% { transform: translate3d(0,0,0) scale(1); opacity:0.55 } 50% { transform: translate3d(0,-18px,0) scale(1.06); opacity:0.8 } }
  .lp-aurora { animation: auroraDrift 14s ease-in-out infinite; will-change: transform, opacity; }

  @media (prefers-reduced-motion: reduce) {
    *,*::before,*::after { animation-duration:0.01ms!important; animation-iteration-count:1!important; transition-duration:0.01ms!important; }
  }
  @media (max-width:720px) { .lp-hero-grid { grid-template-columns:1fr!important; } }
  @media (max-width:720px) { .lp-manifesto-grid { grid-template-columns:1fr!important; gap:18px!important; } }
  @media (max-width:640px) { .lp-stats-grid { grid-template-columns:repeat(2,1fr)!important; } }
`;

// Hooks

function useActiveStation(total: number, ms = 2500) {
  const [a, setA] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setA((p) => (p + 1) % total), ms);
    return () => clearInterval(id);
  }, [total, ms]);
  return a;
}

function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setOn(true);
      },
      { threshold },
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

// Scroll progress 0..1 across the whole page (drives the top progress bar).
function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fn = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setP(h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0);
    };
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    window.addEventListener("resize", fn);
    return () => {
      window.removeEventListener("scroll", fn);
      window.removeEventListener("resize", fn);
    };
  }, []);
  return p;
}

function useTerminalLog(entries: LogEntry[], revealed: boolean, msPerEntry = 320) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!revealed || count >= entries.length) return;
    const id = setTimeout(() => setCount((c) => c + 1), count === 0 ? 100 : msPerEntry);
    return () => clearTimeout(id);
  }, [revealed, count, entries.length, msPerEntry]);
  return entries.slice(0, count);
}

// Sequential flow: each dot pulses in turn, "blow off" effect step by step
function useSequentialFlow(total: number, revealed: boolean, stepMs = 1100) {
  const [shown, setShown] = useState(0);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (!revealed) {
      setShown(0);
      setActive(-1);
      return;
    }
    const t = setTimeout(() => {
      setShown(1);
      setActive(0);
    }, 350);
    return () => clearTimeout(t);
  }, [revealed]);

  useEffect(() => {
    if (active < 0 || active >= total) return;
    const t = setTimeout(() => {
      if (active + 1 < total) {
        setShown(active + 2);
        setActive(active + 1);
      } else {
        setActive(-1);
      }
    }, stepMs);
    return () => clearTimeout(t);
  }, [active, total, stepMs]);

  return { shown, active };
}

// Atomic components

function Brand() {
  return (
    <span
      style={{
        color: C.emberBright,
        textShadow: `0 0 18px ${C.emberGlow}`,
        borderBottom: `1px solid ${C.emberBorder}`,
        paddingBottom: 1,
      }}
    >
      Cadence
    </span>
  );
}

function NavMark() {
  return (
    <span style={{ color: "rgba(255,255,255,0.9)", display: "inline-flex" }}>
      <CadenceMark size={22} tile={false} />
    </span>
  );
}

function Tag({ children, col }: { children: React.ReactNode; col: string }) {
  return (
    <span
      style={{
        fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
        fontSize: 9,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: col,
        display: "block",
        marginBottom: 12,
      }}
    >
      {children}
    </span>
  );
}

// Orbit ring -- the six stations orbiting one glowing brain core (the memory layer).
// Warm core = Cadence's compounding memory; cool nodes = the machinery of the loop.
function OrbitRingLabeled({ active }: { active: number }) {
  const W = 384,
    H = 336,
    cx = 192,
    cy = 168,
    r = 112,
    coreR = 30;

  const nodes = STATIONS.map((s, i) => {
    const a = (-90 + i * 60) * (Math.PI / 180);
    const lR = 146; // label radius from center
    const lx = cx + lR * Math.cos(a);
    const ly = cy + lR * Math.sin(a);
    const anchor: "end" | "start" | "middle" =
      lx < cx - 10 ? "end" : lx > cx + 10 ? "start" : "middle";
    return {
      ...s,
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
      ex: cx + (coreR + 5) * Math.cos(a), // spoke endpoint at the core edge
      ey: cy + (coreR + 5) * Math.sin(a),
      lx,
      ly,
      anchor,
      isActive: i === active,
    };
  });
  const act = nodes[active] ?? nodes[0];

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", maxWidth: "100%" }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="cadBrain" cx="42%" cy="38%" r="68%">
          <stop offset="0%" stopColor="#ffc488" />
          <stop offset="48%" stopColor={C.ember} />
          <stop offset="100%" stopColor="#bf4a00" />
        </radialGradient>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(251,113,0,0.34)" />
          <stop offset="45%" stopColor="rgba(251,113,0,0.12)" />
          <stop offset="100%" stopColor="rgba(251,113,0,0)" />
        </radialGradient>
      </defs>

      {/* Outer orbit ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={C.border}
        strokeWidth="1"
        strokeDasharray="3 6"
      />

      {/* Memory stratum - faint orange ring wrapping the core */}
      <circle
        cx={cx}
        cy={cy}
        r={coreR + 18}
        fill="none"
        stroke={C.emberBorder}
        strokeWidth="1"
        strokeDasharray="2 5"
        opacity="0.4"
      />

      {/* Spokes feeding the core */}
      {nodes.map((n) => (
        <line
          key={`sp-${n.id}`}
          x1={n.x}
          y1={n.y}
          x2={n.ex}
          y2={n.ey}
          stroke={n.isActive ? C.ember : "rgba(255,255,255,0.045)"}
          strokeWidth={n.isActive ? 1.4 : 0.7}
          style={{ transition: "stroke 0.5s, stroke-width 0.5s" }}
        />
      ))}

      {/* Write-pulse traveling the active spoke into the brain (data → memory) */}
      <circle key={`wp-${active}`} r="2.6" fill={C.emberBright} opacity="0">
        <animate attributeName="cx" values={`${act.x};${act.ex}`} dur="1s" repeatCount="indefinite" />
        <animate attributeName="cy" values={`${act.y};${act.ey}`} dur="1s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;0" dur="1s" repeatCount="indefinite" />
      </circle>

      {/* Station nodes */}
      {nodes.map((n) => (
        <circle
          key={`dot-${n.id}`}
          cx={n.x}
          cy={n.y}
          r={n.isActive ? 7 : 4}
          fill={n.isActive ? C.violetBright : "rgba(255,255,255,0.18)"}
          style={{
            transition: "r 0.45s cubic-bezier(0.23,1,0.32,1), fill 0.45s",
            filter: n.isActive ? `drop-shadow(0 0 8px ${C.violetGlow})` : "none",
          }}
        />
      ))}

      {/* Station labels */}
      {nodes.map((n) => (
        <g key={`lb-${n.id}`}>
          <text
            x={n.lx}
            y={n.ly - 5}
            textAnchor={n.anchor}
            fill={n.isActive ? C.violetBright : "rgba(255,255,255,0.4)"}
            fontSize="8.5"
            fontFamily='"IBM Plex Mono", "JetBrains Mono", monospace'
            letterSpacing="0.1em"
            style={{ transition: "fill 0.4s" }}
          >
            {n.label.toUpperCase()}
          </text>
          <text
            x={n.lx}
            y={n.ly + 8}
            textAnchor={n.anchor}
            fill={n.isActive ? "rgba(103,232,249,0.85)" : "rgba(255,255,255,0.24)"}
            fontSize="7"
            fontFamily='"IBM Plex Mono", "JetBrains Mono", monospace'
            style={{ transition: "fill 0.4s" }}
          >
            {n.orbitKicker}
          </text>
        </g>
      ))}

      {/* Soft spotlight glow behind the core */}
      <circle cx={cx} cy={cy} r={coreR + 44} fill="url(#coreGlow)">
        <animate attributeName="opacity" values="0.7;1;0.7" dur="3.4s" repeatCount="indefinite" />
      </circle>

      {/* Two staggered pulsing halos - a spotlight radiating from the core */}
      <circle cx={cx} cy={cy} r={coreR + 4} fill="none" stroke={C.ember} strokeWidth="1.2">
        <animate
          attributeName="r"
          values={`${coreR + 2};${coreR + 28}`}
          dur="2.8s"
          repeatCount="indefinite"
        />
        <animate attributeName="opacity" values="0.6;0" dur="2.8s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={coreR + 4} fill="none" stroke={C.emberBright} strokeWidth="1">
        <animate
          attributeName="r"
          values={`${coreR + 2};${coreR + 28}`}
          dur="2.8s"
          begin="1.4s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.5;0"
          dur="2.8s"
          begin="1.4s"
          repeatCount="indefinite"
        />
      </circle>

      {/* The Cadence core - the whole product at the heart of the loop */}
      <circle
        cx={cx}
        cy={cy}
        r={coreR}
        fill="url(#cadBrain)"
        style={{
          filter: `drop-shadow(0 0 26px ${C.emberGlow}) drop-shadow(0 0 48px rgba(251,113,0,0.32))`,
        }}
      />
      <circle cx={cx} cy={cy} r={coreR} fill="none" stroke="rgba(255,222,184,0.5)" strokeWidth="0.75" />
      <text
        x={cx}
        y={cy + 3}
        textAnchor="middle"
        fill="#2a1300"
        fontSize="9.5"
        fontFamily='"IBM Plex Mono", "JetBrains Mono", monospace'
        fontWeight="700"
        letterSpacing="0.12em"
      >
        CADENCE
      </text>
    </svg>
  );
}

// Terminal card
function TerminalCard({
  title,
  entries,
  revealed,
}: {
  title: string;
  entries: LogEntry[];
  revealed: boolean;
}) {
  const visible = useTerminalLog(entries, revealed, 300);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visible.length]);

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.6)",
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "10px 16px",
          borderBottom: `1px solid ${C.border}`,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {(["#f87171", "#fbbf24", "#4ade80"] as const).map((c) => (
          <span
            key={c}
            style={{ width: 8, height: 8, borderRadius: "50%", background: c, opacity: 0.65 }}
          />
        ))}
        <span
          style={{
            fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
            fontSize: 10,
            color: C.muted,
            letterSpacing: "0.1em",
            marginLeft: 6,
          }}
        >
          {title}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 8,
            fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
            color: C.green,
            opacity: 0.7,
          }}
        >
          LIVE
        </span>
      </div>
      <div
        style={{
          padding: "14px 16px",
          minHeight: 220,
          maxHeight: 310,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 5,
          fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
          fontSize: 11,
          scrollbarWidth: "none",
        }}
      >
        {visible.map((e, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "baseline",
              animation: "fadeUp 0.28s ease both",
            }}
          >
            <span style={{ color: C.faint, flexShrink: 0, fontSize: 9.5 }}>{e.ts}</span>
            <span
              style={{
                color: e.col,
                flexShrink: 0,
                minWidth: 88,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textShadow: e.brand ? `0 0 12px ${e.col}` : "none",
              }}
            >
              {e.tag}
            </span>
            <span
              style={{
                color: e.brand ? e.col : C.muted,
                lineHeight: 1.5,
                textShadow: e.brand ? `0 0 8px ${e.col}` : "none",
              }}
            >
              {e.msg}
            </span>
          </div>
        ))}
        {visible.length < entries.length && (
          <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}>
            <span style={{ color: C.faint, fontSize: 9 }}>...</span>
            <span
              style={{
                display: "inline-block",
                width: 5,
                height: 13,
                background: C.violetBright,
                animation: "cursorBlink 0.9s step-end infinite",
              }}
            />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// Mock animated decision card
function MockDecisionCard({ revealed }: { revealed: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!revealed) return;
    const id = setInterval(() => setStep((s) => (s + 1) % 4), 2200);
    return () => clearInterval(id);
  }, [revealed]);

  const labels = ["Signal detected", "Decision proposed", "You approved", "Agents dispatched"];
  const icons = [C.cyan, C.violetBright, C.green, C.amber];

  return (
    <div
      style={{
        background: "rgba(10,10,22,0.85)",
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "16px",
        backdropFilter: "blur(8px)",
        boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
          paddingBottom: 12,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <span
          style={{ color: C.violetBright, fontSize: 10, fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace' }}
        >
          ◎
        </span>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace' }}>
          cadence / today
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 8,
            fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
            color: C.violetBright,
            border: `1px solid rgba(167,139,250,0.3)`,
            borderRadius: 4,
            padding: "1px 6px",
          }}
        >
          {step === 0 ? "Sensing" : step === 1 ? "Proposing" : step === 2 ? "Approved" : "Building"}
        </span>
      </div>
      <div
        style={{
          background: step >= 2 ? "rgba(74,222,128,0.06)" : "rgba(139,92,246,0.07)",
          border: `1px solid ${step >= 2 ? "rgba(74,222,128,0.18)" : "rgba(167,139,250,0.2)"}`,
          borderRadius: 8,
          padding: "12px",
          transition: "all 0.4s ease",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: icons[step],
              boxShadow: `0 0 8px ${icons[step]}`,
              flexShrink: 0,
              marginTop: 4,
              transition: "all 0.4s ease",
            }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 9,
                fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                color: icons[step],
                letterSpacing: "0.1em",
                marginBottom: 5,
                transition: "color 0.4s ease",
              }}
            >
              {labels[step]}
            </div>
            <p style={{ fontSize: 12, color: C.text, margin: "0 0 8px", lineHeight: 1.4 }}>
              Simplify onboarding step 2
            </p>
            <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.5 }}>
              {step === 0 && "3 signals clustered: friction at step 2 rising."}
              {step === 1 && "Precedent: similar fix, D+14 activation +9%."}
              {step === 2 && "Spec locked. Agents dispatched. ETA: 8 min."}
              {step === 3 && "3 commits. CI passing. Merge queued."}
            </p>
          </div>
          {step === 1 && (
            <button
              style={{
                padding: "4px 10px",
                fontSize: 10,
                borderRadius: 6,
                border: `1px solid rgba(167,139,250,0.4)`,
                background: C.violetDim,
                color: C.violetBright,
                cursor: "default",
                fontFamily: "Schibsted Grotesk, sans-serif",
                flexShrink: 0,
              }}
            >
              Approve
            </button>
          )}
          {step >= 2 && (
            <span
              style={{
                fontSize: 12,
                color: C.green,
                textShadow: `0 0 8px ${C.greenGlow}`,
                flexShrink: 0,
              }}
            >
              ✓
            </span>
          )}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ height: 2, background: C.border, borderRadius: 1, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              borderRadius: 1,
              background: `linear-gradient(90deg, ${C.violet}, ${C.violetBright})`,
              width: `${(step + 1) * 25}%`,
              transition: "width 0.5s cubic-bezier(0.23,1,0.32,1)",
              boxShadow: `0 0 8px ${C.violetGlow}`,
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          {STATIONS.slice(0, 4).map((s, i) => (
            <span
              key={s.id}
              style={{
                fontSize: 8,
                fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                color: i <= step ? C.violetBright : C.faint,
                transition: "color 0.4s",
              }}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockTrustLedger({ revealed }: { revealed: boolean }) {
  const [highlight, setHighlight] = useState(0);
  useEffect(() => {
    if (!revealed) return;
    const id = setInterval(() => setHighlight((h) => (h + 1) % LEDGER_ROWS.length), 1800);
    return () => clearInterval(id);
  }, [revealed]);

  return (
    <div
      style={{
        background: "rgba(10,10,22,0.85)",
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "16px",
        backdropFilter: "blur(8px)",
        boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: C.muted,
          fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        Trust Ledger / 48 calls recorded
      </div>
      {LEDGER_ROWS.map((row, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 0",
            borderBottom: i < LEDGER_ROWS.length - 1 ? `1px solid ${C.divider}` : undefined,
            opacity: highlight === i ? 1 : 0.5,
            transform: highlight === i ? "translateX(2px)" : "translateX(0)",
            transition: "all 0.4s ease",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: row.col,
              flexShrink: 0,
              boxShadow: highlight === i ? `0 0 8px ${row.col}` : "none",
              transition: "box-shadow 0.4s",
            }}
          />
          <span style={{ fontSize: 11, color: C.text, flex: 1, lineHeight: 1.3 }}>
            {row.decision}
          </span>
          <span
            style={{
              fontSize: 9,
              fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
              color: row.col,
              border: `1px solid ${row.col}44`,
              borderRadius: 4,
              padding: "1px 6px",
              flexShrink: 0,
            }}
          >
            {row.verdict}
          </span>
        </div>
      ))}
    </div>
  );
}

// Sequential flow list with "blow off" dot progression
function FlowList({ entries, revealed }: { entries: LogEntry[]; revealed: boolean }) {
  const { shown, active } = useSequentialFlow(entries.length, revealed, 1000);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {entries.slice(0, shown).map((e, i) => {
        const isActive = i === active;
        const isDone = active < 0 || i < active;
        return (
          <div
            key={`${i}-${e.ts}`}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "stretch",
              animation: "fadeLeft 0.3s ease both",
            }}
          >
            {/* Spine + dot */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 18,
                flexShrink: 0,
              }}
            >
              <div style={{ marginTop: 14, position: "relative" }}>
                {isActive ? (
                  <div style={{ position: "relative", width: 14, height: 14 }}>
                    <div
                      style={{
                        position: "absolute",
                        top: -3,
                        left: -3,
                        right: -3,
                        bottom: -3,
                        borderRadius: "50%",
                        border: `1.5px solid ${e.col}`,
                        animation: "activeRingPulse 1.3s ease-out infinite",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 3,
                        left: 3,
                        right: 3,
                        bottom: 3,
                        borderRadius: "50%",
                        background: e.col,
                        boxShadow: `0 0 10px ${e.col}99`,
                      }}
                    />
                  </div>
                ) : isDone ? (
                  <div
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: e.col,
                      opacity: 0.65,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.09)",
                    }}
                  />
                )}
              </div>
              {i < entries.length - 1 && (
                <div
                  style={{
                    width: 1,
                    flex: 1,
                    minHeight: 16,
                    background: isDone
                      ? `linear-gradient(to bottom, ${e.col}55, rgba(255,255,255,0.05))`
                      : "rgba(255,255,255,0.05)",
                    transition: "background 0.6s ease",
                  }}
                />
              )}
            </div>
            {/* Content */}
            <div style={{ paddingBottom: i < entries.length - 1 ? 14 : 0, paddingTop: 9 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                <span
                  style={{ fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace', fontSize: 9, color: C.faint }}
                >
                  {e.ts}
                </span>
                <span
                  style={{
                    fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                    fontSize: 9.5,
                    fontWeight: 600,
                    color: e.col,
                    letterSpacing: "0.05em",
                    textShadow: isActive && e.brand ? `0 0 12px ${e.col}` : "none",
                  }}
                >
                  {e.tag}
                </span>
              </div>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: e.brand ? C.violetBright : C.muted,
                  margin: 0,
                  textShadow: isActive && e.brand ? `0 0 12px rgba(167,139,250,0.28)` : "none",
                }}
              >
                {e.msg}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Sections

// Premium space backdrop - drifting aurora glows + a masked dot-grid for depth.
function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}
    >
      <div
        className="lp-aurora"
        style={{
          position: "absolute",
          top: "-32%",
          left: "-8%",
          width: 640,
          height: 640,
          background: `radial-gradient(circle at center, rgba(251,113,0,0.16) 0%, rgba(251,113,0,0.05) 36%, transparent 70%)`,
          filter: "blur(30px)",
        }}
      />
      <div
        className="lp-aurora"
        style={{
          position: "absolute",
          top: "6%",
          right: "-14%",
          width: 580,
          height: 580,
          background: `radial-gradient(circle at center, rgba(139,92,246,0.13) 0%, rgba(103,232,249,0.05) 42%, transparent 70%)`,
          filter: "blur(34px)",
          animationDelay: "-7s",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)`,
          backgroundSize: "26px 26px",
          WebkitMaskImage: "radial-gradient(ellipse 78% 62% at 50% 28%, #000 28%, transparent 76%)",
          maskImage: "radial-gradient(ellipse 78% 62% at 50% 28%, #000 28%, transparent 76%)",
        }}
      />
    </div>
  );
}

function HeroSection() {
  const { ref, on } = useReveal(0.01);
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "80px 24px 72px",
        borderBottom: `1px solid ${C.divider}`,
      }}
    >
      <HeroBackdrop />
      <div ref={ref} style={{ position: "relative", maxWidth: 1120, margin: "0 auto" }}>
        <div
          className="lp-hero-grid"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "center" }}
        >
          {/* Left: manifesto */}
          <div
            style={{
              opacity: on ? 1 : 0,
              animation: on ? "fadeLeft 0.7s cubic-bezier(0.23,1,0.32,1) 0.05s both" : "none",
            }}
          >
            <div
              style={{
                fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                fontSize: 9,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: C.emberBright,
                marginBottom: 22,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: C.ember,
                  boxShadow: `0 0 8px ${C.emberGlow}`,
                  display: "inline-block",
                }}
              />
              Agent-native product OS
            </div>

            <h1
              style={{
                fontSize: "clamp(32px, 4.5vw, 52px)",
                lineHeight: 1.06,
                fontWeight: 750,
                margin: "0 0 6px",
                color: C.text,
                letterSpacing: "-0.03em",
              }}
            >
              Product teams
              <br />
              don't build anymore.
            </h1>
            <h1
              className="lp-agentsdo"
              style={{
                fontSize: "clamp(32px, 4.5vw, 52px)",
                lineHeight: 1.06,
                fontWeight: 750,
                margin: "0 0 28px",
                letterSpacing: "-0.03em",
              }}
            >
              Agents do.
            </h1>

            <p
              style={{
                fontSize: 15,
                lineHeight: 1.72,
                color: C.muted,
                margin: "0 0 36px",
                maxWidth: 440,
              }}
            >
              <Brand /> is the agent-native operating system for your entire product. It runs the
              full lifecycle end to end: sensing what matters, making the call, writing the spec,
              building, shipping, and learning from every outcome. Your product moves on its own.
              Your team stays on the decisions that need real judgment. Everything else runs
              autonomously.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="/signup" className="btn btn-primary" style={{ textDecoration: "none" }}>
                Start free
              </a>
              <Link
                to="/pricing"
                className="lp-ghost"
                style={{
                  textDecoration: "none",
                  padding: "10px 18px",
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  color: C.muted,
                  fontSize: 13,
                }}
              >
                See pricing
              </Link>
            </div>
          </div>

          {/* Right: terminal */}
          <div
            style={{
              opacity: on ? 1 : 0,
              animation: on ? "fadeUp 0.7s cubic-bezier(0.23,1,0.32,1) 0.18s both" : "none",
            }}
          >
            <TerminalCard title="cadence, live run" entries={SUCCESS_LOG} revealed={on} />
          </div>
        </div>
      </div>
    </section>
  );
}

// Orbit section: the loop with the brain at its center.
function OrbitSection({ active }: { active: number }) {
  const { ref, on } = useReveal(0.08);
  const s = STATIONS[active] ?? STATIONS[0];
  return (
    <section
      ref={ref}
      style={{
        padding: "60px 24px 56px",
        borderBottom: `1px solid ${C.divider}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
      }}
    >
      <div
        style={{
          opacity: on ? 1 : 0,
          transform: on ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
          textAlign: "center",
          maxWidth: 540,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
            color: C.emberBright,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            margin: "0 0 8px",
          }}
        >
          The loop, with Cadence at its center
        </p>
        <p style={{ fontSize: 14.5, color: C.muted, margin: 0, lineHeight: 1.65 }}>
          Six stations run the work. Cadence sits at the center, holding the memory of every signal,
          decision, and outcome your product has produced. Each loop writes to it. Every call reads
          from it.
        </p>
      </div>

      <div
        style={{
          opacity: on ? 1 : 0,
          transform: on ? "scale(1)" : "scale(0.94)",
          transition: "opacity 0.65s ease 0.12s, transform 0.65s ease 0.12s",
        }}
      >
        <OrbitRingLabeled active={active} />
      </div>

      {/* Live status - one line tied to the active station, gives the motion a purpose */}
      <div
        style={{
          opacity: on ? 1 : 0,
          transition: "opacity 0.55s ease 0.24s",
          display: "flex",
          alignItems: "center",
          gap: 9,
          flexWrap: "wrap",
          justifyContent: "center",
          fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
          fontSize: 11.5,
          minHeight: 18,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: s.color,
            boxShadow: `0 0 8px ${s.color}`,
            flexShrink: 0,
            transition: "background 0.4s, box-shadow 0.4s",
          }}
        />
        <span
          style={{
            color: C.text,
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          {s.label}
        </span>
        <span style={{ color: C.faint }}>·</span>
        <span style={{ color: C.muted }}>{s.kicker.toLowerCase()}</span>
        <span style={{ color: C.faint, marginLeft: 2 }}>→</span>
        <span key={s.id} className="lp-memwrite" style={{ fontWeight: 600 }}>
          {MEM_WRITES[s.id]}
        </span>
      </div>
    </section>
  );
}

function StatsStrip() {
  const { ref, on } = useReveal(0.15);
  return (
    <section ref={ref} style={{ padding: "28px 24px", borderBottom: `1px solid ${C.divider}` }}>
      <div
        className="lp-stats-grid"
        style={{
          maxWidth: 860,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 24,
        }}
      >
        {STATS.map((s, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
              opacity: on ? 0.85 : 0,
              transform: on ? "translateY(0)" : "translateY(12px)",
              transition: `opacity 0.45s ease ${i * 0.07}s, transform 0.45s ease ${i * 0.07}s`,
            }}
          >
            <div
              style={{
                fontSize: "clamp(22px,3vw,30px)",
                fontWeight: 700,
                color: C.emberBright,
                fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                textShadow: `0 0 20px ${C.emberGlow}`,
                lineHeight: 1.1,
              }}
            >
              {s.n}
            </div>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ManifestoStrip() {
  const { ref, on } = useReveal(0.12);
  return (
    <section ref={ref} style={{ padding: "84px 24px", borderBottom: `1px solid ${C.divider}` }}>
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          textAlign: "center",
          opacity: on ? 1 : 0,
          transform: on ? "translateY(0)" : "translateY(18px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <div
          style={{
            fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: C.emberBright,
            marginBottom: 22,
          }}
        >
          Why Cadence exists
        </div>
        <h2
          style={{
            fontSize: "clamp(27px,4vw,44px)",
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            color: C.text,
            margin: "0 0 24px",
          }}
        >
          Your stack runs the work.
          <br />
          <span style={{ color: C.emberBright }}>It forgets the thinking.</span>
        </h2>
        <p
          style={{
            fontSize: "clamp(15px,1.8vw,18px)",
            lineHeight: 1.66,
            color: C.muted,
            maxWidth: 560,
            margin: "0 auto",
          }}
        >
          Every signal, decision, and outcome scatters across a dozen tools, then walks out the door
          with the people who made it. <Brand /> keeps the whole thread, from first signal to shipped
          outcome, and feeds it back into the next call.
        </p>
      </div>
    </section>
  );
}

function StationsSection({ active }: { active: number }) {
  const { ref, on } = useReveal(0.04);
  return (
    <section ref={ref} style={{ padding: "80px 24px", borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div
          style={{
            marginBottom: 44,
            opacity: on ? 1 : 0,
            transform: on ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <Tag col={C.emberBright}>Six stations</Tag>
          <h2
            style={{
              fontSize: "clamp(22px,3vw,30px)",
              fontWeight: 600,
              margin: "0 0 10px",
              color: C.text,
            }}
          >
            Every station. Owned.
          </h2>
          <p style={{ fontSize: 14, color: C.muted, maxWidth: 460, margin: 0, lineHeight: 1.65 }}>
            The loop closes end to end. No handoffs. No gaps. No tool-switching.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))",
            gap: 12,
          }}
        >
          {on &&
            STATIONS.map((s, i) => (
              <div
                key={s.id}
                className="lp-card"
                style={
                  {
                    padding: "22px 20px 24px",
                    background: i === active ? C.bgCardHot : C.bgCard,
                    border: `1px solid ${i === active ? C.borderHot : C.border}`,
                    borderRadius: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    animation: `fadeUp 0.5s cubic-bezier(0.23,1,0.32,1) ${i * 0.06}s both`,
                    boxShadow: i === active ? `0 0 28px rgba(139,92,246,0.12)` : "none",
                    "--accent": `${s.color}66`,
                    "--accent-soft": `${s.color}1f`,
                  } as CSSProperties
                }
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span
                    style={{ fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace', fontSize: 9, color: C.faint }}
                  >
                    {s.num}
                  </span>
                  <span
                    style={{
                      fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                      fontSize: 14,
                      color: i === active ? s.color : C.faint,
                      textShadow: i === active ? `0 0 14px ${s.glow}` : "none",
                      transition: "all 0.35s",
                    }}
                  >
                    {s.icon}
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                      color: i === active ? s.color : C.faint,
                      marginBottom: 6,
                      transition: "color 0.35s",
                    }}
                  >
                    {s.label}
                  </div>
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 550,
                      margin: 0,
                      lineHeight: 1.22,
                      color: C.text,
                    }}
                  >
                    {s.kicker}
                  </h3>
                </div>
                <p style={{ fontSize: 12.5, lineHeight: 1.65, color: C.muted, margin: 0 }}>
                  {s.body}
                </p>
                <div
                  style={{
                    marginTop: 4,
                    padding: "8px 10px",
                    background: "rgba(0,0,0,0.3)",
                    border: `1px solid rgba(255,255,255,0.05)`,
                    borderRadius: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                      fontSize: 8,
                      color: C.faint,
                      display: "block",
                      marginBottom: 3,
                    }}
                  >
                    Live
                  </span>
                  <p
                    style={{
                      fontSize: 11.5,
                      color: "rgba(255,255,255,0.42)",
                      margin: 0,
                      lineHeight: 1.55,
                    }}
                  >
                    {s.live}
                  </p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}

function AgentInActionSection() {
  const { ref, on } = useReveal(0.06);
  const [tab, setTab] = useState<"success" | "fail">("success");

  return (
    <section ref={ref} style={{ padding: "80px 24px", borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div
          style={{
            marginBottom: 36,
            opacity: on ? 1 : 0,
            transform: on ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <Tag col={C.emberBright}>The engine in motion</Tag>
          <h2
            style={{
              fontSize: "clamp(22px,3vw,30px)",
              fontWeight: 600,
              margin: "0 0 10px",
              color: C.text,
            }}
          >
            Signal to shipped. Watch it happen.
          </h2>
          <p style={{ fontSize: 14, color: C.muted, maxWidth: 560, margin: 0, lineHeight: 1.65 }}>
            See what <Brand /> does when a signal lands. Then see what it does when something
            breaks. The second part is the real differentiator.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 32,
            opacity: on ? 1 : 0,
            transition: "opacity 0.5s ease 0.1s",
          }}
          className="lp-hero-grid"
        >
          {/* Left: tab + sequential flow */}
          <div>
            <div
              style={{
                display: "inline-flex",
                gap: 4,
                marginBottom: 24,
                padding: "4px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
              }}
            >
              {(["success", "fail"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 7,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11.5,
                    fontWeight: 500,
                    background:
                      tab === t
                        ? t === "success"
                          ? "rgba(74,222,128,0.14)"
                          : "rgba(248,113,113,0.14)"
                        : "transparent",
                    color: tab === t ? (t === "success" ? C.green : C.rose) : C.faint,
                    transition: "all 0.2s",
                  }}
                >
                  {t === "success" ? "Happy path" : "Failure + recovery"}
                </button>
              ))}
            </div>

            <FlowList
              entries={tab === "success" ? SUCCESS_LOG : FAIL_LOG}
              revealed={on}
              key={tab}
            />

            {tab === "fail" && on && (
              <p
                style={{
                  marginTop: 18,
                  fontSize: 12.5,
                  lineHeight: 1.65,
                  color: C.muted,
                  padding: "12px 14px",
                  background: "rgba(248,113,113,0.06)",
                  border: `1px solid rgba(248,113,113,0.14)`,
                  borderRadius: 10,
                  animation: "fadeUp 0.35s ease both",
                }}
              >
                <Brand /> never waits for you to diagnose a broken build. It reads CI output, finds
                the root cause, revises the spec, and rebuilds. The agent that recovers is worth
                more than one that only succeeds.
              </p>
            )}
          </div>

          {/* Right: mock UI screens */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <MockDecisionCard revealed={on} />
            <MockTrustLedger revealed={on} />
          </div>
        </div>
      </div>
    </section>
  );
}

function LedgerSection() {
  const { ref, on } = useReveal(0.08);
  const REUSE = [4, 2, 3, 5];
  // Trust-and-outcome oriented: the record is what makes the next call defensible.
  const INSIGHTS = [
    "logged with its evidence, a default the team can stand behind.",
    "the miss owned on the record, so developer work ranks higher now.",
    "proven, not argued: the simpler call wins on evidence next time.",
    "attributed to the decision, a bet anyone can audit later.",
  ];
  const [hot, setHot] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setHot((h) => (h + 1) % LEDGER_ROWS.length), 3800);
    return () => clearInterval(id);
  }, [on]);

  return (
    <section ref={ref} style={{ padding: "80px 24px", borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div
          style={{
            marginBottom: 36,
            opacity: on ? 1 : 0,
            transform: on ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <Tag col={C.emberBright}>Trust Ledger</Tag>
          <h2
            style={{
              fontSize: "clamp(22px,3vw,32px)",
              fontWeight: 600,
              margin: "0 0 12px",
              color: C.text,
              letterSpacing: "-0.02em",
            }}
          >
            Every call, graded by its outcome.
          </h2>
          <p style={{ fontSize: 14.5, color: C.muted, maxWidth: 600, margin: 0, lineHeight: 1.66 }}>
            This is the Trust Ledger. Every decision Cadence makes is recorded with the evidence
            behind it, then graded once the outcome lands. Right or wrong, each call becomes
            precedent the next one reads from. It cannot be backfilled or bought. It exists only
            because Cadence was in the loop when the call was made.
          </p>
        </div>

        <div
          style={{
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            maxWidth: 900,
            opacity: on ? 1 : 0,
            transform: on ? "translateY(0)" : "translateY(14px)",
            transition: "opacity 0.5s ease 0.14s, transform 0.5s ease 0.14s",
          }}
        >
          <div
            style={{
              border: `1px solid ${C.border}`,
              background: C.bgCard,
              borderRadius: 14,
              overflow: "hidden",
              minWidth: 580,
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 1.1fr 84px 78px",
                padding: "10px 20px",
                gap: 16,
                borderBottom: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.025)",
              }}
            >
              {["Decision", "Outcome", "Verdict", "Reused"].map((h) => (
                <span
                  key={h}
                  style={{
                    fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                    fontSize: 9,
                    color: C.faint,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
            {LEDGER_ROWS.map((row, i) => {
              const isHot = hot === i;
              return (
                <div
                  key={i}
                  className="lp-ledger-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1.1fr 84px 78px",
                    padding: "14px 20px",
                    gap: 16,
                    alignItems: "center",
                    borderBottom: i < LEDGER_ROWS.length - 1 ? `1px solid ${C.divider}` : undefined,
                    borderLeft: `2px solid ${isHot ? C.ember : "transparent"}`,
                    background: isHot ? "rgba(251,113,0,0.05)" : "transparent",
                    opacity: on ? 1 : 0,
                    transform: on ? "translateX(0)" : "translateX(-10px)",
                    transition: `opacity 0.45s ease ${0.22 + i * 0.08}s, transform 0.45s ease ${0.22 + i * 0.08}s, background 0.4s ease, border-left-color 0.4s ease`,
                  }}
                >
                  <span style={{ fontSize: 13, lineHeight: 1.48, color: C.text }}>
                    {row.decision}
                  </span>
                  <span style={{ fontSize: 13, color: C.muted }}>{row.outcome}</span>
                  <span
                    style={{
                      fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                      fontSize: 9.5,
                      color: row.col,
                      border: `1px solid ${row.col}44`,
                      borderRadius: 99,
                      padding: "2px 9px",
                      display: "inline-block",
                      boxShadow: `0 0 8px ${row.col}22`,
                    }}
                  >
                    {row.verdict}
                  </span>
                  <span
                    style={{
                      fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                      fontSize: 11,
                      fontWeight: 600,
                      color: isHot ? C.emberBright : C.faint,
                      transition: "color 0.4s",
                    }}
                  >
                    {"x" + REUSE[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* What the highlighted call taught the system: outcome-oriented, reads slowly */}
        <div
          style={{
            marginTop: 16,
            minHeight: 24,
            opacity: on ? 1 : 0,
            transition: "opacity 0.45s ease 0.4s",
            fontSize: 13,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "baseline",
          }}
        >
          <span
            style={{
              fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
              fontSize: 9.5,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: C.faint,
              flexShrink: 0,
            }}
          >
            On the record
          </span>
          <span key={hot} style={{ animation: "fadeIn 0.6s ease" }}>
            <span style={{ color: C.muted }}>{LEDGER_ROWS[hot].outcome}</span>
            <span style={{ color: C.faint }}>{"  ·  "}</span>
            <span className="lp-memwrite" style={{ fontWeight: 600 }}>
              {INSIGHTS[hot]}
            </span>
          </span>
        </div>

        {/* Why it matters, in three numbers */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            flexWrap: "wrap",
            gap: 30,
            opacity: on ? 1 : 0,
            transition: "opacity 0.5s ease 0.5s",
          }}
        >
          {[
            ["48", "calls recorded"],
            ["92%", "later validated"],
            ["100%", "reusable as precedent"],
          ].map(([n, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                  fontSize: 18,
                  fontWeight: 700,
                  color: C.emberBright,
                }}
              >
                {n}
              </span>
              <span style={{ fontSize: 12, color: C.muted }}>{l}</span>
            </div>
          ))}
        </div>

        <p
          style={{
            fontSize: 11,
            color: C.faint,
            marginTop: 22,
            opacity: on ? 0.7 : 0,
            transition: "opacity 0.45s ease 0.55s",
          }}
        >
          Illustrative. Your real ledger populates from live calls and outcomes.
        </p>
      </div>
    </section>
  );
}

// Memory moat section: the layer beyond the six stations
function MoatSection() {
  const { ref, on } = useReveal(0.08);
  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "104px 24px",
        borderBottom: `1px solid ${C.divider}`,
      }}
    >
      {/* Spotlight glow behind the moat: this is the differentiator, lit accordingly */}
      <div
        aria-hidden="true"
        className="lp-aurora"
        style={{
          position: "absolute",
          top: "-6%",
          left: "50%",
          marginLeft: -470,
          width: 940,
          height: 640,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, rgba(251,113,0,0.1) 0%, rgba(251,113,0,0.035) 40%, transparent 72%)",
          filter: "blur(48px)",
        }}
      />
      {/* Elevated slab: lifts the entire moat section off the flat page */}
      <div
        style={{
          position: "relative",
          maxWidth: 1120,
          margin: "0 auto",
          padding: "52px clamp(20px,4vw,52px) 56px",
          borderRadius: 28,
          border: "1px solid rgba(251,113,0,0.14)",
          background:
            "linear-gradient(180deg, rgba(251,113,0,0.03) 0%, rgba(255,255,255,0.012) 42%, rgba(0,0,0,0) 100%)",
          boxShadow: "0 0 70px rgba(251,113,0,0.045), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div
          style={{
            marginBottom: 40,
            opacity: on ? 1 : 0,
            transform: on ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <Tag col={C.emberBright}>The moat</Tag>
          <h2
            className="font-display"
            style={{
              fontSize: "clamp(28px,3.8vw,42px)",
              fontWeight: 600,
              margin: "0 0 14px",
              color: C.text,
              letterSpacing: "-0.02em",
              lineHeight: 1.08,
            }}
          >
            The brain that{" "}
            <span style={{ color: C.emberBright, textShadow: `0 0 30px ${C.emberGlow}` }}>
              compounds
            </span>
            .
          </h2>
          <p
            style={{
              fontSize: 14,
              color: C.muted,
              maxWidth: 540,
              margin: "0 0 10px",
              lineHeight: 1.65,
            }}
          >
            The six stations are the loop. What lives beneath is what compounds: a decision layer
            trained on your team's own taste, standards, and outcomes. It starts shaping calls from
            day one. The longer it runs, the more irreplaceable it becomes.
          </p>
        </div>

        {/* Moat proof bar */}
        <div
          style={{
            marginBottom: 32,
            padding: "14px 20px",
            background: "rgba(251,113,0,0.07)",
            border: `1px solid rgba(251,113,0,0.22)`,
            borderRadius: 10,
            opacity: on ? 1 : 0,
            transition: "opacity 0.5s ease 0.1s",
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,165,90,0.82)",
              margin: 0,
              lineHeight: 1.6,
              fontStyle: "italic",
            }}
          >
            "Generic AI trains on the internet. Cadence trains on your product and your taste. That
            distinction is the moat."
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 16,
            opacity: on ? 1 : 0,
            transform: on ? "translateY(0)" : "translateY(14px)",
            transition: "opacity 0.55s ease 0.14s, transform 0.55s ease 0.14s",
          }}
        >
          {MOAT_PILLARS.map((p, i) => (
            <div
              key={i}
              className="lp-card"
              style={
                {
                  position: "relative",
                  padding: "28px 24px",
                  background: "rgba(255,255,255,0.022)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  animation: `fadeUp 0.5s cubic-bezier(0.23,1,0.32,1) ${i * 0.1}s both`,
                  boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
                  "--accent": `${p.col}66`,
                  "--accent-soft": `${p.col}1f`,
                } as CSSProperties
              }
            >
              <div
                className="lp-card-icon"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: `${p.col}16`,
                  border: `1px solid ${p.col}38`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                  fontSize: 16,
                  color: p.col,
                  textShadow: `0 0 12px ${p.col}55`,
                  boxShadow: `0 0 18px ${p.col}12`,
                }}
              >
                {p.icon}
              </div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 620,
                  margin: "0 0 10px",
                  color: C.text,
                  letterSpacing: "-0.01em",
                }}
              >
                {p.title}
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: C.muted, margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GuerrillaSection() {
  const { ref, on } = useReveal(0.12);
  return (
    <section
      ref={ref}
      style={{ padding: "92px 24px 60px", borderBottom: `1px solid ${C.divider}` }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            opacity: on ? 1 : 0,
            transform: on ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.65s ease, transform 0.65s ease",
            marginBottom: 22,
          }}
        >
          <div
            style={{
              fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: C.emberBright,
              marginBottom: 18,
            }}
          >
            The shift
          </div>
          <h2
            style={{
              fontSize: "clamp(28px,4.4vw,46px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: C.text,
              margin: 0,
            }}
          >
            Building used to be the hard part.
            <br />
            Now it&apos;s the{" "}
            <span style={{ color: C.emberBright, textShadow: `0 0 26px ${C.emberGlow}` }}>
              easy
            </span>{" "}
            part.
          </h2>
        </div>

        <p
          style={{
            fontSize: "clamp(15px,1.9vw,19px)",
            lineHeight: 1.6,
            color: C.muted,
            margin: "0 auto",
            maxWidth: 560,
            opacity: on ? 1 : 0,
            transition: "opacity 0.6s ease 0.12s",
            fontWeight: 420,
          }}
        >
          Anyone can ship in a weekend now. The hard part moved: knowing what to build next, and
          being able to say why the last thing shipped the way it did.
        </p>

        <div
          style={{
            maxWidth: 600,
            margin: "44px auto 0",
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          <div
            style={{
              padding: "30px 0",
              borderTop: `1px solid ${C.divider}`,
              opacity: on ? 1 : 0,
              transform: on ? "translateY(0)" : "translateY(14px)",
              transition: "opacity 0.55s ease 0.2s, transform 0.55s ease 0.2s",
            }}
          >
            <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                  letterSpacing: "0.16em",
                  color: C.emberBright,
                  paddingTop: 5,
                  flexShrink: 0,
                  width: 24,
                }}
              >
                01
              </div>
              <p
                style={{
                  fontSize: "clamp(16px,2.1vw,22px)",
                  lineHeight: 1.52,
                  color: "rgba(255,255,255,0.78)",
                  margin: 0,
                  fontWeight: 430,
                }}
              >
                Decisions that used to take three days of alignment take seconds. Cadence has already
                pulled the precedent, weighed how similar calls played out, and surfaced what your
                team would most likely choose.
              </p>
            </div>
          </div>

          <div
            style={{
              padding: "30px 0",
              borderTop: `1px solid ${C.divider}`,
              opacity: on ? 1 : 0,
              transform: on ? "translateY(0)" : "translateY(14px)",
              transition: "opacity 0.55s ease 0.32s, transform 0.55s ease 0.32s",
            }}
          >
            <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace',
                  letterSpacing: "0.16em",
                  color: C.emberBright,
                  paddingTop: 5,
                  flexShrink: 0,
                  width: 24,
                }}
              >
                02
              </div>
              <p
                style={{
                  fontSize: "clamp(16px,2.1vw,22px)",
                  lineHeight: 1.52,
                  color: "rgba(255,255,255,0.78)",
                  margin: 0,
                  fontWeight: 430,
                }}
              >
                The result of your last sprint is not waiting in a retro nobody opens. It is already
                scored and folded into the next decision, automatically, every time.
              </p>
            </div>
          </div>

        </div>

        {/* Close: clean centered statement, no marker, ends on the compounding edge */}
        <div
          style={{
            marginTop: 60,
            opacity: on ? 1 : 0,
            transform: on ? "translateY(0)" : "translateY(14px)",
            transition: "opacity 0.55s ease 0.46s, transform 0.55s ease 0.46s",
          }}
        >
          <p
            style={{
              fontSize: "clamp(21px,3.1vw,33px)",
              fontWeight: 680,
              lineHeight: 1.2,
              letterSpacing: "-0.025em",
              color: C.text,
              margin: "0 auto",
              maxWidth: 620,
            }}
          >
            The best product teams aren&apos;t working harder. They run a system that remembers every
            decision and sharpens with every outcome.
          </p>
          <p
            style={{
              fontSize: "clamp(20px,2.8vw,30px)",
              fontWeight: 780,
              letterSpacing: "-0.02em",
              color: C.emberBright,
              textShadow: `0 0 26px ${C.emberGlow}`,
              margin: "14px 0 0",
            }}
          >
            That edge compounds.
          </p>
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  const { ref, on } = useReveal(0.12);
  return (
    <section ref={ref} style={{ position: "relative", overflow: "hidden", padding: "76px 24px 96px", textAlign: "center" }}>
      <div
        aria-hidden="true"
        className="lp-aurora"
        style={{
          position: "absolute",
          bottom: "-30%",
          left: "50%",
          marginLeft: -360,
          width: 720,
          height: 560,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, rgba(251,113,0,0.12) 0%, rgba(251,113,0,0.04) 40%, transparent 72%)",
          filter: "blur(50px)",
        }}
      />
      <div
        style={{
          position: "relative",
          maxWidth: 540,
          margin: "0 auto",
          opacity: on ? 1 : 0,
          transform: on ? "translateY(0)" : "translateY(22px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: C.emberDim,
            border: `1px solid ${C.emberBorder}`,
            boxShadow: `0 0 24px ${C.emberGlow}`,
            margin: "0 auto 26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: C.emberBright, fontSize: 18, textShadow: `0 0 12px ${C.emberGlow}` }}>
            ↺
          </span>
        </div>
        <h2
          style={{
            fontSize: "clamp(24px,4vw,38px)",
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            color: C.text,
            margin: "0 0 14px",
          }}
        >
          Decisions made the way
          <br />
          your team would make them.
        </h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: C.muted, margin: "0 0 34px" }}>
          Cadence learns how your team thinks, then makes each call with the evidence and the memory
          of every call before it. Not workflows on autopilot. Judgment, applied at the speed of your
          product. You weigh in only when the call is genuinely yours to make.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/signup" className="btn btn-primary" style={{ textDecoration: "none" }}>
            Start free
          </a>
          <Link
            to="/pricing"
            className="lp-ghost"
            style={{
              textDecoration: "none",
              padding: "10px 18px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              color: C.muted,
              fontSize: 13,
            }}
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

// Main

function LandingPage() {
  const active = useActiveStation(6, 2500);
  const scrolled = useScrolled(56);
  const progress = useScrollProgress();

  return (
    <MachineViewContainer machineContent={MACHINE_CONTENT} title="Cadence">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap"
      />
      <div
        className="lp-page"
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.text,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Scroll-reactive ambient glow: a warm light that drifts down the viewport as you scroll */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            background: `radial-gradient(64% 52% at 50% ${18 + progress * 60}%, rgba(251,113,0,0.06) 0%, rgba(139,92,246,0.035) 38%, transparent 64%)`,
            transition: "background 0.18s linear",
          }}
        />
        {/* Scroll progress bar - premium top-level feedback */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            zIndex: 60,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress * 100}%`,
              background: `linear-gradient(90deg, ${C.ember}, ${C.amber} 55%, ${C.violetBright})`,
              boxShadow: `0 0 10px ${C.emberGlow}`,
              transition: "width 0.12s linear",
            }}
          />
        </div>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            padding: "12px 24px",
            background: scrolled ? "rgba(7,7,15,0.88)" : C.bg,
            backdropFilter: scrolled ? "blur(16px)" : "none",
            borderBottom: `1px solid ${C.divider}`,
            transition: "background 0.3s ease, backdrop-filter 0.3s ease",
          }}
        >
          <div
            style={{
              maxWidth: 1120,
              margin: "0 auto",
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
                gap: 9,
                textDecoration: "none",
              }}
            >
              <NavMark />
              <span
                style={{ fontSize: 14, fontWeight: 550, color: C.text, letterSpacing: "-0.01em" }}
              >
                Cadence
              </span>
            </Link>
            <nav style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Link
              to="/pricing"
              className="lp-nav"
              style={{ fontSize: 13, color: C.faint, textDecoration: "none" }}
            >
              Pricing
            </Link>
            <a
              href="/login"
              className="lp-nav"
              style={{ fontSize: 13, color: C.faint, textDecoration: "none" }}
            >
              Sign in
            </a>
            <MachineViewToggle />
            <a href="/signup" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
              Start free
            </a>
            </nav>
          </div>
        </header>

        <main style={{ flex: 1, position: "relative", zIndex: 1 }}>
          <HeroSection />
          <OrbitSection active={active} />
          <StatsStrip />
          <ManifestoStrip />
          <StationsSection active={active} />
          <AgentInActionSection />
          <LedgerSection />
          <MoatSection />
          <GuerrillaSection />
          <CtaSection />
        </main>

        <footer style={{ padding: "16px 24px", borderTop: `1px solid ${C.divider}` }}>
          <div
            style={{
              maxWidth: 1120,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontFamily: '"IBM Plex Mono", "JetBrains Mono", monospace', fontSize: 9, color: C.faint }}>
              Made with Cadence
            </span>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <Link
                to="/pricing"
                className="lp-nav"
                style={{ fontSize: 11, color: C.faint, textDecoration: "none" }}
              >
                Pricing
              </Link>
              <a
                href="/login"
                className="lp-nav"
                style={{ fontSize: 11, color: C.faint, textDecoration: "none" }}
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
          </div>
        </footer>
      </div>
    </MachineViewContainer>
  );
}
