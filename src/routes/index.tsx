// LANDING-PAGE-V11 — full redesign. Electric violet on near-black.
// Voice: Cadence IS the actor. Show success AND failure recovery.
// Design: one dark canvas, glassmorphism, animated terminal, mock UI screens.
// Guerrilla line: "Product teams don't build anymore. Agents do."
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MachineViewToggle } from "@/components/cadence/MachineViewToggle";
import { MachineViewContainer } from "@/components/machine/MachineViewContainer";
import { CadenceMark } from "@/components/cadence/Primitives";

const TITLE = "Cadence: The AI agent that runs your entire product lifecycle";
const DESC =
  "Cadence is the AI agent that owns your full product lifecycle — from first signal to final outcome. Six stations. One loop. Your team governs what matters. Agents run everything else.";

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

// ─── Design tokens ────────────────────────────────────────────────────────────
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
  text: "#f8fafc",
  muted: "#94a3b8",
  faint: "#475569",
  divider: "rgba(255,255,255,0.06)",
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const STATIONS = [
  {
    id: "sense", num: "01", label: "Sense", icon: "◎",
    kicker: "The signal arrives",
    body: "Cadence watches live sources — usage drops, support spikes, CI failures, market moves. It clusters what relates and surfaces what warrants a decision.",
    live: "3 onboarding complaints clustered. Severity: rising. D+7 activation at risk.",
    color: C.cyan, glow: C.cyanDim,
  },
  {
    id: "decide", num: "02", label: "Decide", icon: "◈",
    kicker: "The call is made",
    body: "Every decision runs against your team's own precedent. What did a similar call produce? Was it right? Cadence proposes the call and waits for your approval.",
    live: "Friction fix ranked #1. Precedent: similar call drove D+14 activation +9%. Confidence 84%.",
    color: C.violetBright, glow: C.violetDim,
  },
  {
    id: "define", num: "03", label: "Define", icon: "◧",
    kicker: "The spec writes itself",
    body: "The spec is grounded in the signal that triggered it — rationale, acceptance criteria, edge cases. Every clause has a source. Nothing is invented.",
    live: "Spec: 4 acceptance criteria. Linked to 6 signals. Approved in 90 seconds.",
    color: C.violetBright, glow: C.violetDim,
  },
  {
    id: "build", num: "04", label: "Build", icon: "◱",
    kicker: "Agents run the execution",
    body: "Specialist agents pick up the spec. Cadence governs: checks their work, approves at the merge gate, escalates what genuinely needs a human.",
    live: "3 commits. CI passing. Queued for your merge approval. ETA to ship: 8 min.",
    color: C.amber, glow: "rgba(251,191,36,0.12)",
  },
  {
    id: "ship", num: "05", label: "Ship", icon: "◮",
    kicker: "Deployed and watching",
    body: "The change deploys. Cadence notifies the team, timestamps the deploy, and immediately begins tracking the outcome signal the decision depends on.",
    live: "Shipped 14:22. Watching activation rate. Signal expected D+7 to D+14.",
    color: C.green, glow: C.greenDim,
  },
  {
    id: "learn", num: "06", label: "Learn", icon: "◉",
    kicker: "The outcome lands",
    body: "D+14 arrives. Cadence records what happened, whether the call was right, and writes a supersession edge — so the next similar signal gets smarter precedent.",
    live: "D+14: activation +8%. Call validated. Supersession written. Brain updated.",
    color: C.green, glow: C.greenDim,
  },
];

type LogEntry = { ts: string; tag: string; msg: string; col: string; brand?: boolean };

const SUCCESS_LOG: LogEntry[] = [
  { ts: "09:14:03", tag: "SENSE",     col: C.cyan,         msg: "Activation drop -4% WoW flagged" },
  { ts: "09:14:03", tag: "CLUSTER",   col: C.muted,        msg: "3 signals linked — onboarding friction pattern" },
  { ts: "09:14:04", tag: "CADENCE",   col: C.violetBright, msg: "Decision proposed: simplify onboarding step 2", brand: true },
  { ts: "09:14:05", tag: "EVIDENCE",  col: C.muted,        msg: "Confidence 84% | similar call: D+14 activation +9%" },
  { ts: "09:15:22", tag: "APPROVE",   col: C.faint,        msg: "You approved (2 seconds)" },
  { ts: "09:15:23", tag: "DEFINE",    col: C.violetBright, msg: "Spec locked: 4 criteria, 6 linked signals", brand: true },
  { ts: "09:15:45", tag: "BUILD",     col: C.amber,        msg: "Agent dispatched: 3 commits" },
  { ts: "09:16:12", tag: "CI",        col: C.green,        msg: "All 14 tests passing" },
  { ts: "09:17:01", tag: "SHIP",      col: C.green,        msg: "Deployed to production 14:22" },
  { ts: "09:17:01", tag: "WATCH",     col: C.faint,        msg: "Monitoring for D+14 outcome signal..." },
  { ts: "D+14",     tag: "LEARN",     col: C.green,        msg: "Activation +8%. Call validated. Memory updated.", brand: true },
];

const FAIL_LOG: LogEntry[] = [
  { ts: "11:43:17", tag: "BUILD",      col: C.amber,        msg: "Agent dispatched" },
  { ts: "11:43:22", tag: "CI",         col: C.rose,         msg: "FAILED: 3 tests red — API contract mismatch step 3" },
  { ts: "11:43:22", tag: "CADENCE",    col: C.violetBright, msg: "Diagnosing failure", brand: true },
  { ts: "11:43:23", tag: "ROOT CAUSE", col: C.muted,        msg: "Response schema changed: field 'user_id' -> 'uid'" },
  { ts: "11:43:24", tag: "CADENCE",    col: C.violetBright, msg: "Spec revised automatically", brand: true },
  { ts: "11:43:31", tag: "BUILD",      col: C.amber,        msg: "Rebuild: 1 corrected commit" },
  { ts: "11:43:44", tag: "CI",         col: C.green,        msg: "All 17 tests passing" },
  { ts: "11:43:45", tag: "SHIP",       col: C.green,        msg: "Deployed. Cadence never stopped.", brand: true },
];

const LEDGER_ROWS = [
  { decision: "Simplify onboarding to 3 steps",        outcome: "D+14: activation +11%",    verdict: "Right", col: C.green },
  { decision: "Delay docs rewrite to Q3",              outcome: "D+30: dev signups stalled", verdict: "Wrong", col: C.rose  },
  { decision: "Inline comments before nested threads", outcome: "D+7: session depth +18%",  verdict: "Right", col: C.green },
  { decision: "API surface over mobile app",           outcome: "Q2: enterprise pipeline",   verdict: "Right", col: C.green },
];

const STATS = [
  { n: "6",    label: "stations, one loop"    },
  { n: "0",    label: "handoffs between steps" },
  { n: "D+14", label: "outcome signal, always" },
  { n: "100%", label: "auditable — every call" },
];

const MACHINE_CONTENT = `## Cadence — AI agent for the full product lifecycle

Cadence is the AI agent that owns your entire product lifecycle end to end.
Six stations: Sense, Decide, Define, Build, Ship, Learn.
One governed engine. Zero manual handoffs.

When something breaks, Cadence diagnoses, revises the spec, and recovers — autonomously.

## Agent interfaces
- A2A agent card: /.well-known/agent.json
- MCP server: POST /api/mcp (JSON-RPC 2.0)
- Machine-readable site: /llms.txt

## Get started
Sign in: /login | Start free: /signup | Pricing: /pricing
`;

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  @keyframes fadeIn   { from{opacity:0}               to{opacity:1} }
  @keyframes fadeUp   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeLeft { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
  @keyframes termBlink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes gradShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes connPulse { 0%,100%{opacity:0.1} 50%{opacity:0.5} }
  @keyframes dotGlow   { 0%,100%{box-shadow:0 0 4px currentColor,0 0 10px currentColor} 50%{box-shadow:0 0 10px currentColor,0 0 22px currentColor} }
  @keyframes bgFloat   { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-12px) scale(1.03)} }
  @keyframes mockSlide { 0%{transform:translateX(0)} 33%{transform:translateX(-33.33%)} 66%{transform:translateX(-66.66%)} 100%{transform:translateX(0)} }
  @keyframes cursorBlink { 0%,100%{opacity:1} 49%{opacity:1} 50%{opacity:0} 99%{opacity:0} }
  @keyframes scanLine  { from{transform:translateY(-100%)} to{transform:translateY(400%)} }
  @keyframes numberUp  { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }

  .lp-card {
    transition: border-color 0.25s ease, background 0.25s ease,
                transform 0.22s cubic-bezier(0.23,1,0.32,1), box-shadow 0.25s ease;
  }
  .lp-card:hover { transform:translateY(-3px); box-shadow:0 14px 36px rgba(0,0,0,0.4); }
  .lp-conn { animation: connPulse 2.8s ease-in-out infinite; }
  .glow-dot { animation: dotGlow 2.2s ease-in-out infinite; }
  .bg-float { animation: bgFloat 7s ease-in-out infinite; }

  @media (prefers-reduced-motion: reduce) {
    *,*::before,*::after { animation-duration:0.01ms!important; animation-iteration-count:1!important; transition-duration:0.01ms!important; }
  }
  @media (max-width:720px) { .lp-hero-grid { grid-template-columns:1fr!important; } }
  @media (max-width:640px) { .lp-stats-grid { grid-template-columns:repeat(2,1fr)!important; } }
`;

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useActiveStation(total: number, ms = 2500) {
  const [a, setA] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setA(p => (p + 1) % total), ms);
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

function useTerminalLog(entries: LogEntry[], revealed: boolean, msPerEntry = 320) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!revealed || count >= entries.length) return;
    const id = setTimeout(() => setCount(c => c + 1), count === 0 ? 100 : msPerEntry);
    return () => clearTimeout(id);
  }, [revealed, count, entries.length, msPerEntry]);
  return entries.slice(0, count);
}

// ─── Atomic components ────────────────────────────────────────────────────────

function Brand() {
  return (
    <span style={{
      color: C.violetBright,
      textShadow: `0 0 18px ${C.violetGlow}`,
      borderBottom: `1px solid rgba(167,139,250,0.35)`,
      paddingBottom: 1,
    }}>
      Cadence
    </span>
  );
}

function NavMark() {
  return (
    <span style={{ color: "rgba(255,255,255,0.9)", display: "inline-flex" }}>
      <CadenceMark size={22} tile={false}/>
    </span>
  );
}

function GlowDot({ color, glow, size = 10 }: { color: string; glow: string; size?: number }) {
  return (
    <span className="glow-dot" style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: color,
      color: glow,
      flexShrink: 0,
    }}/>
  );
}

function Tag({ children, col }: { children: React.ReactNode; col: string }) {
  return (
    <span style={{
      fontFamily: "JetBrains Mono, monospace", fontSize: 9,
      letterSpacing: "0.14em", textTransform: "uppercase",
      color: col, display: "block", marginBottom: 12,
    }}>
      {children}
    </span>
  );
}

// ─── Orbit ring ───────────────────────────────────────────────────────────────

function OrbitRing({ active }: { active: number }) {
  const S = 200, cx = 100, cy = 100, r = 75;
  const nodes = STATIONS.map((s, i) => {
    const a = (-90 + i * 60) * (Math.PI / 180);
    return { ...s, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), isActive: i === active };
  });
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ display: "block" }} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth="1" strokeDasharray="3 6"/>
      {nodes.map(n => (
        <line key={`sp-${n.id}`} x1={cx} y1={cy} x2={n.x} y2={n.y}
          stroke={n.isActive ? "rgba(139,92,246,0.22)" : "rgba(255,255,255,0.03)"}
          strokeWidth="0.6" style={{ transition: "stroke 0.5s" }}/>
      ))}
      {nodes.map(n => n.isActive && (
        <circle key={`gr-${n.id}`} cx={n.x} cy={n.y} r={16} fill="rgba(139,92,246,0.1)"/>
      ))}
      {nodes.map(n => (
        <circle key={`dot-${n.id}`} cx={n.x} cy={n.y}
          r={n.isActive ? 7 : 3.5}
          fill={n.isActive ? C.violetBright : "rgba(255,255,255,0.18)"}
          style={{
            transition: "r 0.45s cubic-bezier(0.23,1,0.32,1), fill 0.45s",
            filter: n.isActive ? `drop-shadow(0 0 8px ${C.violetGlow})` : "none",
          }}/>
      ))}
      {nodes.map(n => n.isActive && (
        <text key={`lb-${n.id}`} x={n.x} y={n.y + 21}
          textAnchor="middle" fill={C.violetBright} fontSize="7"
          fontFamily="JetBrains Mono, monospace" letterSpacing="0.1em">
          {n.label.toUpperCase()}
        </text>
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="7"
        fontFamily="JetBrains Mono, monospace" letterSpacing="0.12em">CADENCE</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fill="rgba(255,255,255,0.08)" fontSize="6"
        fontFamily="JetBrains Mono, monospace" letterSpacing="0.1em">LOOP</text>
    </svg>
  );
}

// ─── Station pills ────────────────────────────────────────────────────────────

function StationPills({ active }: { active: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0, justifyContent: "center" }}>
      {STATIONS.map((s, i) => (
        <span key={s.id} style={{ display: "flex", alignItems: "center" }}>
          <span style={{
            fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "4px 12px", borderRadius: 99,
            fontFamily: "JetBrains Mono, monospace",
            border: i === active ? `1px solid rgba(167,139,250,0.55)` : `1px solid ${C.border}`,
            background: i === active ? C.violetDim : "transparent",
            color: i === active ? C.violetBright : C.faint,
            fontWeight: i === active ? 600 : 400,
            transition: "all 0.35s cubic-bezier(0.23,1,0.32,1)",
            boxShadow: i === active ? `0 0 14px rgba(139,92,246,0.28)` : "none",
          }}>
            {s.label}
          </span>
          {i < STATIONS.length - 1 && (
            <span className="lp-conn" style={{
              width: 14, height: 1, background: C.divider, display: "block",
              animationDelay: `${i * 0.4}s`,
            }}/>
          )}
        </span>
      ))}
    </div>
  );
}

// ─── Terminal card ────────────────────────────────────────────────────────────

function TerminalCard({ title, entries, revealed }: {
  title: string; entries: LogEntry[]; revealed: boolean;
}) {
  const visible = useTerminalLog(entries, revealed, 300);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [visible.length]);

  return (
    <div style={{
      background: "rgba(0,0,0,0.6)", border: `1px solid ${C.border}`,
      borderRadius: 14, overflow: "hidden",
    }}>
      {/* Title bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 7, padding: "10px 16px",
        borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)",
      }}>
        {(["#f87171","#fbbf24","#4ade80"] as const).map(c => (
          <span key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c, opacity: 0.65 }}/>
        ))}
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: C.muted, letterSpacing: "0.1em", marginLeft: 6 }}>
          {title}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 8, fontFamily: "JetBrains Mono, monospace", color: C.green, opacity: 0.7 }}>
          LIVE
        </span>
      </div>
      {/* Entries */}
      <div style={{
        padding: "14px 16px", minHeight: 220, maxHeight: 310,
        overflowY: "auto", display: "flex", flexDirection: "column", gap: 5,
        fontFamily: "JetBrains Mono, monospace", fontSize: 11, scrollbarWidth: "none",
      }}>
        {visible.map((e, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", animation: "fadeUp 0.28s ease both" }}>
            <span style={{ color: C.faint, flexShrink: 0, fontSize: 9.5 }}>{e.ts}</span>
            <span style={{
              color: e.col, flexShrink: 0, minWidth: 88,
              fontWeight: 600, letterSpacing: "0.05em",
              textShadow: e.brand ? `0 0 12px ${e.col}` : "none",
            }}>
              {e.tag}
            </span>
            <span style={{ color: e.brand ? e.col : C.muted, lineHeight: 1.5, textShadow: e.brand ? `0 0 8px ${e.col}` : "none" }}>
              {e.msg}
            </span>
          </div>
        ))}
        {visible.length < entries.length && (
          <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}>
            <span style={{ color: C.faint, fontSize: 9 }}>...</span>
            <span style={{
              display: "inline-block", width: 5, height: 13, background: C.violetBright,
              animation: "termBlink 0.9s step-end infinite",
            }}/>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
    </div>
  );
}

// ─── Mock UI screen (animated app screenshot) ─────────────────────────────────

function MockDecisionCard({ revealed }: { revealed: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!revealed) return;
    const id = setInterval(() => setStep(s => (s + 1) % 4), 2200);
    return () => clearInterval(id);
  }, [revealed]);

  const labels = ["Signal detected", "Decision proposed", "You approved", "Agents dispatched"];
  const icons  = [C.cyan, C.violetBright, C.green, C.amber];

  return (
    <div style={{
      background: "rgba(10,10,22,0.85)", border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "16px", backdropFilter: "blur(8px)",
      boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)`,
    }}>
      {/* App chrome header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
        paddingBottom: 12, borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ color: C.violetBright, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}>◎</span>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace" }}>cadence / today</span>
        <span style={{
          marginLeft: "auto", fontSize: 8, fontFamily: "JetBrains Mono, monospace",
          color: C.violetBright, border: `1px solid rgba(167,139,250,0.3)`, borderRadius: 4, padding: "1px 6px",
        }}>
          {step === 0 ? "Sensing" : step === 1 ? "Proposing" : step === 2 ? "Approved" : "Building"}
        </span>
      </div>

      {/* Decision card */}
      <div style={{
        background: step >= 2 ? "rgba(74,222,128,0.06)" : "rgba(139,92,246,0.07)",
        border: `1px solid ${step >= 2 ? "rgba(74,222,128,0.18)" : "rgba(167,139,250,0.2)"}`,
        borderRadius: 8, padding: "12px", transition: "all 0.4s ease",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: icons[step],
            boxShadow: `0 0 8px ${icons[step]}`,
            flexShrink: 0, marginTop: 4,
            transition: "all 0.4s ease",
          }}/>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 9, fontFamily: "JetBrains Mono, monospace",
              color: icons[step], letterSpacing: "0.1em", marginBottom: 5,
              transition: "color 0.4s ease",
            }}>
              {labels[step]}
            </div>
            <p style={{ fontSize: 12, color: C.text, margin: "0 0 8px", lineHeight: 1.4 }}>
              Simplify onboarding step 2
            </p>
            <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.5 }}>
              {step === 0 && "3 signals clustered — friction at step 2 rising."}
              {step === 1 && "Precedent: similar fix → D+14 activation +9%."}
              {step === 2 && "Spec locked. Agents dispatched. ETA: 8 min."}
              {step === 3 && "3 commits. CI passing. Merge queued."}
            </p>
          </div>
          {step === 1 && (
            <button style={{
              padding: "4px 10px", fontSize: 10, borderRadius: 6,
              border: `1px solid rgba(167,139,250,0.4)`,
              background: C.violetDim, color: C.violetBright,
              cursor: "default", fontFamily: "Schibsted Grotesk, sans-serif",
              flexShrink: 0,
            }}>
              Approve
            </button>
          )}
          {step >= 2 && (
            <span style={{
              fontSize: 12, color: C.green,
              textShadow: `0 0 8px ${C.greenGlow}`,
              flexShrink: 0,
            }}>✓</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 12 }}>
        <div style={{ height: 2, background: C.border, borderRadius: 1, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 1,
            background: `linear-gradient(90deg, ${C.violet}, ${C.violetBright})`,
            width: `${(step + 1) * 25}%`,
            transition: "width 0.5s cubic-bezier(0.23,1,0.32,1)",
            boxShadow: `0 0 8px ${C.violetGlow}`,
          }}/>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          {STATIONS.slice(0, 4).map((s, i) => (
            <span key={s.id} style={{
              fontSize: 8, fontFamily: "JetBrains Mono, monospace",
              color: i <= step ? C.violetBright : C.faint,
              transition: "color 0.4s",
            }}>
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
    const id = setInterval(() => setHighlight(h => (h + 1) % LEDGER_ROWS.length), 1800);
    return () => clearInterval(id);
  }, [revealed]);

  return (
    <div style={{
      background: "rgba(10,10,22,0.85)", border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "16px", backdropFilter: "blur(8px)",
      boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
    }}>
      <div style={{
        fontSize: 11, color: C.muted, fontFamily: "JetBrains Mono, monospace",
        marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${C.border}`,
      }}>
        Trust Ledger / 48 calls recorded
      </div>
      {LEDGER_ROWS.map((row, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 0",
          borderBottom: i < LEDGER_ROWS.length - 1 ? `1px solid ${C.divider}` : undefined,
          opacity: highlight === i ? 1 : 0.5,
          transform: highlight === i ? "translateX(2px)" : "translateX(0)",
          transition: "all 0.4s ease",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: row.col, flexShrink: 0,
            boxShadow: highlight === i ? `0 0 8px ${row.col}` : "none",
            transition: "box-shadow 0.4s",
          }}/>
          <span style={{ fontSize: 11, color: C.text, flex: 1, lineHeight: 1.3 }}>{row.decision}</span>
          <span style={{
            fontSize: 9, fontFamily: "JetBrains Mono, monospace",
            color: row.col, border: `1px solid ${row.col}44`,
            borderRadius: 4, padding: "1px 6px", flexShrink: 0,
          }}>
            {row.verdict}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function HeroSection({ active }: { active: number }) {
  const { ref, on } = useReveal(0.01);
  return (
    <section style={{ padding: "80px 24px 72px", borderBottom: `1px solid ${C.divider}` }}>
      <div ref={ref} style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="lp-hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 52, alignItems: "center" }}>
          {/* Left */}
          <div style={{ opacity: on ? 1 : 0, animation: on ? "fadeLeft 0.7s cubic-bezier(0.23,1,0.32,1) 0.05s both" : "none" }}>
            <div style={{
              fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.18em",
              textTransform: "uppercase", color: C.violet, marginBottom: 22,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: C.violet,
                boxShadow: `0 0 8px ${C.violetGlow}`, display: "inline-block",
              }}/>
              AI-native autonomous agent
            </div>

            <h1 style={{
              fontSize: "clamp(32px, 4.5vw, 52px)", lineHeight: 1.06,
              fontWeight: 750, margin: "0 0 6px", color: C.text, letterSpacing: "-0.03em",
            }}>
              Product teams<br/>don't build anymore.
            </h1>
            <h1 style={{
              fontSize: "clamp(32px, 4.5vw, 52px)", lineHeight: 1.06,
              fontWeight: 750, margin: "0 0 28px", letterSpacing: "-0.03em",
              background: `linear-gradient(135deg, ${C.violetBright} 0%, #c4b5fd 45%, ${C.cyan} 100%)`,
              backgroundSize: "200% 200%",
              animation: "gradShift 5s ease infinite",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              Agents do.
            </h1>

            <p style={{ fontSize: 15, lineHeight: 1.72, color: C.muted, margin: "0 0 32px", maxWidth: 440 }}>
              <Brand /> is the AI agent that owns your entire product lifecycle —
              from the first signal to the final outcome. Six stations. One loop.
              You govern the calls that matter. Agents run everything else.
            </p>

            <div style={{ marginBottom: 26 }}>
              <OrbitRing active={active}/>
            </div>
            <div style={{ marginBottom: 28 }}>
              <StationPills active={active}/>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="/signup" className="btn btn-primary" style={{ textDecoration: "none" }}>Start free</a>
              <Link to="/pricing" style={{
                textDecoration: "none", padding: "10px 18px", borderRadius: 8,
                border: `1px solid ${C.border}`, color: C.muted, fontSize: 13,
              }}>
                See pricing
              </Link>
            </div>
          </div>

          {/* Right: Terminal */}
          <div style={{ opacity: on ? 1 : 0, animation: on ? "fadeUp 0.7s cubic-bezier(0.23,1,0.32,1) 0.18s both" : "none" }}>
            <TerminalCard title="cadence — live run" entries={SUCCESS_LOG} revealed={on}/>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsStrip() {
  const { ref, on } = useReveal(0.15);
  return (
    <section ref={ref} style={{ padding: "28px 24px", borderBottom: `1px solid ${C.divider}` }}>
      <div className="lp-stats-grid" style={{ maxWidth: 860, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
        {STATS.map((s, i) => (
          <div key={i} style={{
            textAlign: "center",
            opacity: on ? 0.85 : 0,
            transform: on ? "translateY(0)" : "translateY(12px)",
            transition: `opacity 0.45s ease ${i * 0.07}s, transform 0.45s ease ${i * 0.07}s`,
          }}>
            <div style={{
              fontSize: "clamp(22px,3vw,30px)", fontWeight: 700,
              color: C.violetBright, fontFamily: "JetBrains Mono, monospace",
              textShadow: `0 0 20px ${C.violetGlow}`, lineHeight: 1.1,
            }}>
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
    <section ref={ref} style={{ padding: "72px 24px", borderBottom: `1px solid ${C.divider}` }}>
      <div style={{
        maxWidth: 860, margin: "0 auto",
        opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(18px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}>
        <p style={{ fontSize: "clamp(18px,2.8vw,26px)", lineHeight: 1.5, color: C.text, margin: 0, fontWeight: 440, maxWidth: 700 }}>
          Most tools own one station. Copilots draft specs. Trackers log tasks.
          Build tools ship code.{" "}
          <span style={{ color: C.muted }}>
            <Brand /> owns all six — in sequence — as one governed agent.
            When something breaks, it diagnoses, revises, and recovers. Automatically.
          </span>
        </p>
      </div>
    </section>
  );
}

function StationsSection({ active }: { active: number }) {
  const { ref, on } = useReveal(0.04);
  return (
    <section ref={ref} style={{ padding: "80px 24px", borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{
          marginBottom: 44,
          opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}>
          <Tag col={C.violet}>Six stations</Tag>
          <h2 style={{ fontSize: "clamp(22px,3vw,30px)", fontWeight: 600, margin: "0 0 10px", color: C.text }}>Every station. Owned.</h2>
          <p style={{ fontSize: 14, color: C.muted, maxWidth: 460, margin: 0, lineHeight: 1.65 }}>
            The loop closes end to end. No handoffs. No gaps. No tool-switching.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 12 }}>
          {on && STATIONS.map((s, i) => (
            <div key={s.id} className="lp-card" style={{
              padding: "22px 20px 24px",
              background: i === active ? C.bgCardHot : C.bgCard,
              border: `1px solid ${i === active ? C.borderHot : C.border}`,
              borderRadius: 14, display: "flex", flexDirection: "column", gap: 10,
              animation: `fadeUp 0.5s cubic-bezier(0.23,1,0.32,1) ${i * 0.06}s both`,
              boxShadow: i === active ? `0 0 28px rgba(139,92,246,0.12)` : "none",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: C.faint }}>{s.num}</span>
                <span style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 14,
                  color: i === active ? s.color : C.faint,
                  textShadow: i === active ? `0 0 14px ${s.glow}` : "none",
                  transition: "all 0.35s",
                }}>{s.icon}</span>
              </div>
              <div>
                <div style={{
                  fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                  fontFamily: "JetBrains Mono, monospace",
                  color: i === active ? s.color : C.faint, marginBottom: 6, transition: "color 0.35s",
                }}>
                  {s.label}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 550, margin: 0, lineHeight: 1.22, color: C.text }}>{s.kicker}</h3>
              </div>
              <p style={{ fontSize: 12.5, lineHeight: 1.65, color: C.muted, margin: 0 }}>{s.body}</p>
              <div style={{
                marginTop: 4, padding: "8px 10px",
                background: "rgba(0,0,0,0.3)", border: `1px solid rgba(255,255,255,0.05)`, borderRadius: 8,
              }}>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, color: C.faint, display: "block", marginBottom: 3 }}>Live</span>
                <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.42)", margin: 0, lineHeight: 1.55 }}>{s.live}</p>
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
      <div style={{ maxWidth: 1060, margin: "0 auto" }}>
        <div style={{
          marginBottom: 36,
          opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}>
          <Tag col={C.violet}>Agent in action</Tag>
          <h2 style={{ fontSize: "clamp(22px,3vw,30px)", fontWeight: 600, margin: "0 0 10px", color: C.text }}>The loop in motion.</h2>
          <p style={{ fontSize: 14, color: C.muted, maxWidth: 560, margin: 0, lineHeight: 1.65 }}>
            See what <Brand /> does when a signal lands. Then see what it does when something breaks.
            The second part is the real differentiator.
          </p>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32,
          opacity: on ? 1 : 0, transition: "opacity 0.5s ease 0.1s",
        }}
        className="lp-hero-grid">
          {/* Left: tab + flow */}
          <div>
            <div style={{
              display: "inline-flex", gap: 4, marginBottom: 24, padding: "4px",
              background: "rgba(255,255,255,0.04)", borderRadius: 10, border: `1px solid ${C.border}`,
            }}>
              {(["success","fail"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "6px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                  fontSize: 11.5, fontWeight: 500,
                  background: tab === t
                    ? (t === "success" ? "rgba(74,222,128,0.14)" : "rgba(248,113,113,0.14)")
                    : "transparent",
                  color: tab === t ? (t === "success" ? C.green : C.rose) : C.faint,
                  transition: "all 0.2s",
                }}>
                  {t === "success" ? "Happy path" : "Failure + recovery"}
                </button>
              ))}
            </div>

            <FlowList entries={tab === "success" ? SUCCESS_LOG : FAIL_LOG} revealed={on} key={tab}/>

            {tab === "fail" && on && (
              <p style={{
                marginTop: 18, fontSize: 12.5, lineHeight: 1.65, color: C.muted,
                padding: "12px 14px",
                background: "rgba(248,113,113,0.06)",
                border: `1px solid rgba(248,113,113,0.14)`, borderRadius: 10,
                animation: "fadeUp 0.35s ease both",
              }}>
                <Brand /> never waits for you to diagnose a broken build.
                It reads CI output, finds the root cause, revises the spec, and rebuilds.
                The agent that recovers is worth more than one that only succeeds.
              </p>
            )}
          </div>

          {/* Right: mock UI screens */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <MockDecisionCard revealed={on}/>
            <MockTrustLedger revealed={on}/>
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowList({ entries, revealed }: { entries: LogEntry[]; revealed: boolean }) {
  const visible = useTerminalLog(entries, revealed, 260);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {visible.map((e, i) => (
        <div key={`${i}-${e.ts}`} style={{ display: "flex", gap: 14, alignItems: "stretch", animation: "fadeLeft 0.3s ease both" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 18, flexShrink: 0 }}>
            <div style={{ marginTop: 14 }}>
              <GlowDot color={e.col} glow={`${e.col}55`} size={9}/>
            </div>
            {i < visible.length - 1 && (
              <div style={{ width: 1, flex: 1, minHeight: 16, background: `linear-gradient(to bottom, ${e.col}44, rgba(255,255,255,0.05))` }}/>
            )}
          </div>
          <div style={{ paddingBottom: i < entries.length - 1 ? 14 : 0, paddingTop: 9 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: C.faint }}>{e.ts}</span>
              <span style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 9.5, fontWeight: 600,
                color: e.col, textShadow: e.brand ? `0 0 10px ${e.col}` : "none", letterSpacing: "0.05em",
              }}>
                {e.tag}
              </span>
            </div>
            <p style={{
              fontSize: 13, lineHeight: 1.6,
              color: e.brand ? C.violetBright : C.muted, margin: 0,
              textShadow: e.brand ? `0 0 12px rgba(167,139,250,0.28)` : "none",
            }}>
              {e.msg}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function LedgerSection() {
  const { ref, on } = useReveal(0.08);
  return (
    <section ref={ref} style={{ padding: "80px 24px", borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{
          marginBottom: 40,
          opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}>
          <Tag col={C.violet}>Trust Ledger</Tag>
          <h2 style={{ fontSize: "clamp(22px,3vw,30px)", fontWeight: 600, margin: "0 0 10px", color: C.text }}>What compounds.</h2>
          <p style={{ fontSize: 14, color: C.muted, maxWidth: 500, margin: 0, lineHeight: 1.65 }}>
            Every call: why, on what evidence, who approved, what happened. Eighteen months of this
            cannot be backfilled by any model or competitor.
          </p>
        </div>
        <div style={{
          overflowX: "auto", WebkitOverflowScrolling: "touch",
          opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)",
          transition: "opacity 0.5s ease 0.14s, transform 0.5s ease 0.14s",
        }}>
          <div style={{
            border: `1px solid ${C.border}`, background: C.bgCard, borderRadius: 14,
            overflow: "hidden", minWidth: 520, backdropFilter: "blur(12px)",
          }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 90px",
              padding: "10px 20px", gap: 16, borderBottom: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.025)",
            }}>
              {["Decision","Outcome","Verdict"].map(h => (
                <span key={h} style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                  color: C.faint, letterSpacing: "0.1em", textTransform: "uppercase",
                }}>{h}</span>
              ))}
            </div>
            {LEDGER_ROWS.map((row, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 90px",
                padding: "14px 20px", gap: 16, alignItems: "center",
                borderBottom: i < LEDGER_ROWS.length - 1 ? `1px solid ${C.divider}` : undefined,
                opacity: on ? 1 : 0, transform: on ? "translateX(0)" : "translateX(-10px)",
                transition: `opacity 0.45s ease ${0.22 + i * 0.08}s, transform 0.45s ease ${0.22 + i * 0.08}s`,
              }}>
                <span style={{ fontSize: 13, lineHeight: 1.48, color: C.text }}>{row.decision}</span>
                <span style={{ fontSize: 13, color: C.muted }}>{row.outcome}</span>
                <span style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 9.5,
                  color: row.col, border: `1px solid ${row.col}44`, borderRadius: 99,
                  padding: "2px 9px", display: "inline-block", boxShadow: `0 0 8px ${row.col}22`,
                }}>
                  {row.verdict}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p style={{
          fontSize: 11, color: C.faint, textAlign: "center", marginTop: 10,
          opacity: on ? 0.7 : 0, transition: "opacity 0.45s ease 0.5s",
        }}>
          Illustrative. Your real ledger populates from live calls and outcomes.
        </p>
      </div>
    </section>
  );
}

function GuerrillaSection() {
  const { ref, on } = useReveal(0.12);
  return (
    <section ref={ref} style={{ padding: "96px 24px", borderBottom: `1px solid ${C.divider}`, textAlign: "center" }}>
      <div style={{
        maxWidth: 680, margin: "0 auto",
        opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(22px)",
        transition: "opacity 0.65s ease, transform 0.65s ease",
      }}>
        <p style={{
          fontSize: "clamp(26px,4.8vw,50px)", fontWeight: 780, lineHeight: 1.1,
          letterSpacing: "-0.03em", color: C.text, margin: "0 0 8px",
        }}>
          Your competitors<br/>aren't moving faster.
        </p>
        <p style={{
          fontSize: "clamp(26px,4.8vw,50px)", fontWeight: 780, lineHeight: 1.1,
          letterSpacing: "-0.03em", margin: "0 0 32px",
          background: `linear-gradient(135deg, ${C.violetBright}, ${C.cyan})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Their agents are.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: C.muted, maxWidth: 460, margin: "0 auto 36px" }}>
          Every team that wires <Brand /> now builds a compounding advantage.
          The longer it runs, the smarter it gets. The gap widens with every call.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/signup" className="btn btn-primary" style={{ textDecoration: "none" }}>Start free</a>
          <Link to="/pricing" style={{
            textDecoration: "none", padding: "10px 18px", borderRadius: 8,
            border: `1px solid ${C.border}`, color: C.muted, fontSize: 13,
          }}>See pricing</Link>
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  const { ref, on } = useReveal(0.12);
  return (
    <section ref={ref} style={{ padding: "96px 24px", textAlign: "center" }}>
      <div style={{
        maxWidth: 520, margin: "0 auto",
        opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(22px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: C.violetDim, border: `1px solid ${C.borderHot}`,
          boxShadow: `0 0 24px ${C.violetGlow}`,
          margin: "0 auto 26px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ color: C.violetBright, fontSize: 18, textShadow: `0 0 12px ${C.violetGlow}` }}>↺</span>
        </div>
        <h2 style={{
          fontSize: "clamp(24px,4vw,38px)", fontWeight: 700,
          lineHeight: 1.12, letterSpacing: "-0.02em", color: C.text, margin: "0 0 14px",
        }}>
          The loop is wired.<br/>Put your signal in.
        </h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: C.muted, margin: "0 0 34px" }}>
          Start free. Bring your own signal source or use the webhook.
          The ledger starts compounding from the first call.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/signup" className="btn btn-primary" style={{ textDecoration: "none" }}>Start free</a>
          <Link to="/pricing" style={{
            textDecoration: "none", padding: "10px 18px", borderRadius: 8,
            border: `1px solid ${C.border}`, color: C.muted, fontSize: 13,
          }}>See pricing</Link>
        </div>
      </div>
    </section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function LandingPage() {
  const active = useActiveStation(6, 2500);
  const scrolled = useScrolled(56);

  return (
    <MachineViewContainer machineContent={MACHINE_CONTENT} title="Cadence">
      <style dangerouslySetInnerHTML={{ __html: STYLES }}/>
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", flexDirection: "column" }}>

        <header style={{
          position: "sticky", top: 0, zIndex: 50,
          padding: "12px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: scrolled ? "rgba(7,7,15,0.88)" : C.bg,
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: `1px solid ${C.divider}`,
          transition: "background 0.3s ease, backdrop-filter 0.3s ease",
        }}>
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <NavMark/>
            <span style={{ fontSize: 14, fontWeight: 550, color: C.text, letterSpacing: "-0.01em" }}>Cadence</span>
          </Link>
          <nav style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Link to="/pricing" style={{ fontSize: 13, color: C.faint, textDecoration: "none" }}>Pricing</Link>
            <a href="/login" style={{ fontSize: 13, color: C.faint, textDecoration: "none" }}>Sign in</a>
            <MachineViewToggle/>
            <a href="/signup" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>Start free</a>
          </nav>
        </header>

        <main style={{ flex: 1 }}>
          <HeroSection active={active}/>
          <StatsStrip/>
          <ManifestoStrip/>
          <StationsSection active={active}/>
          <AgentInActionSection/>
          <LedgerSection/>
          <GuerrillaSection/>
          <CtaSection/>
        </main>

        <footer style={{
          padding: "14px 20px", borderTop: `1px solid ${C.divider}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: C.faint }}>Made with Cadence</span>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link to="/pricing" style={{ fontSize: 11, color: C.faint, textDecoration: "none" }}>Pricing</Link>
            <a href="/login" style={{ fontSize: 11, color: C.faint, textDecoration: "none" }}>Sign in</a>
            <a href="/signup" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>Start free</a>
          </div>
        </footer>
      </div>
    </MachineViewContainer>
  );
}
