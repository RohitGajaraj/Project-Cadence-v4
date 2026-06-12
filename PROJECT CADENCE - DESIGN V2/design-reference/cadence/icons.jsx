// Lucide-style icon set (stroke 1.75) + small shared primitives.
const I = ({ children, size = 14, ...rest }) =>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
style={{ flexShrink: 0 }} {...rest}>{children}</svg>;


const IcHome = (p) => <I {...p}><path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M9 22V12h6v10"></path></I>;
const IcInbox = (p) => <I {...p}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></I>;
const IcChat = (p) => <I {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></I>;
const IcCompass = (p) => <I {...p}><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88"></polygon></I>;
const IcActivity = (p) => <I {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></I>;
const IcBook = (p) => <I {...p}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></I>;
const IcShield = (p) => <I {...p}><path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></I>;
const IcGauge = (p) => <I {...p}><path d="m12 14 4-4"></path><path d="M3.34 19a10 10 0 1 1 17.32 0"></path></I>;
const IcPlug = (p) => <I {...p}><path d="M12 22v-5"></path><path d="M9 8V2"></path><path d="M15 8V2"></path><path d="M6 8h12v5a6 6 0 0 1-12 0z"></path></I>;
const IcSparkles = (p) => <I {...p}><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"></path></I>;
const IcBot = (p) => <I {...p}><rect x="3" y="8" width="18" height="13" rx="2"></rect><path d="M12 8V4"></path><line x1="8.5" y1="14" x2="8.51" y2="14"></line><line x1="15.5" y1="14" x2="15.51" y2="14"></line></I>;
const IcChevDown = (p) => <I {...p}><polyline points="6 9 12 15 18 9"></polyline></I>;
const IcChevUp = (p) => <I {...p}><polyline points="18 15 12 9 6 15"></polyline></I>;
const IcChevRight = (p) => <I {...p}><polyline points="9 18 15 12 9 6"></polyline></I>;
const IcExternal = (p) => <I {...p}><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></I>;
const IcClock = (p) => <I {...p}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></I>;
const IcCheck = (p) => <I {...p}><path d="M20 6 9 17l-5-5"></path></I>;
const IcX = (p) => <I {...p}><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></I>;
const IcPlus = (p) => <I {...p}><path d="M5 12h14"></path><path d="M12 5v14"></path></I>;
const IcArrowUp = (p) => <I {...p}><path d="M12 19V5"></path><path d="m5 12 7-7 7 7"></path></I>;
const IcTarget = (p) => <I {...p}><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></I>;
const IcFocus = (p) => <I {...p}><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"></circle></I>;
const IcCalendar = (p) => <I {...p}><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></I>;
const IcUsers = (p) => <I {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></I>;
const IcZap = (p) => <I {...p}><polygon points="13 2 3 14 10 14 9 22 21 10 14 10 15 2"></polygon></I>;
const IcCoins = (p) => <I {...p}><circle cx="8" cy="8" r="6"></circle><path d="M18.1 10.4a6 6 0 1 1-7.7 7.7"></path></I>;
const IcBranch = (p) => <I {...p}><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></I>;
const IcSearch = (p) => <I {...p}><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></I>;
const IcSun = (p) => <I {...p}><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.9 4.9 1.4 1.4"></path><path d="m17.7 17.7 1.4 1.4"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.3 17.7-1.4 1.4"></path><path d="m19.1 4.9-1.4 1.4"></path></I>;
const IcMoon = (p) => <I {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"></path></I>;
const IcThumbUp = (p) => <I {...p}><path d="M7 10v12"></path><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z"></path></I>;
const IcThumbDown = (p) => <I {...p}><path d="M17 14V2"></path><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z"></path></I>;
const IcReplay = (p) => <I {...p}><path d="M3 12a9 9 0 1 0 9-9"></path><polyline points="3 4 3 9 8 9"></polyline></I>;
const IcCmd = (p) => <I {...p}><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"></path></I>;

/* CadenceMark — "the butterfly." Two pairs of translucent wings on a
   slender body: lightness, precision, metamorphosis (signal → shipped).
   Drawn flat like a luxury-house motif. Deliberately bilateral, NOT a
   radial flower/asterisk — that territory is Anthropic's. Wings breathe
   in a slow flutter. tile={false} = mono single-ink variant. */
function CadenceMark({ size = 22, tile = true }) {
  const upper = "M 12.9 11.2 C 13.6 7.6 16.4 4.9 19.1 4.9 C 21.2 4.9 21.9 6.6 21.0 8.6 C 20.0 10.8 16.9 12.4 13.4 12.2 Z";
  const lower = "M 13.2 12.9 C 16.1 12.9 18.6 14.3 19.2 16.2 C 19.7 17.9 18.4 19.1 16.5 18.6 C 14.6 18.1 13.1 16.0 12.9 13.4 Z";
  const wing = (d, fill, mirror) => (
    <path d={d} fill={fill} opacity={tile ? 0.78 : 0.42}
    transform={mirror ? "scale(-1 1) translate(-24 0)" : undefined}></path>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <g className="cad-flutter">
        {wing(upper, tile ? "var(--ember)" : "currentColor", false)}
        {wing(lower, tile ? "var(--saffron)" : "currentColor", false)}
      </g>
      <g className="cad-flutter-l">
        {wing(upper, tile ? "var(--ember)" : "currentColor", true)}
        {wing(lower, tile ? "var(--saffron)" : "currentColor", true)}
      </g>
      <path d="M 12 6.8 C 12.35 8.2 12.35 15.8 12 18.0 C 11.65 15.8 11.65 8.2 12 6.8 Z"
      fill={tile ? "var(--primary-ink)" : "currentColor"} opacity={tile ? 0.95 : 0.7}></path>
      <circle cx="12" cy="6.1" r="0.95" fill={tile ? "var(--primary-ink)" : "currentColor"} opacity={tile ? 0.95 : 0.7}></circle>
    </svg>);

}

const IcDrizzle = (p) => <I {...p}><path d="M17.5 17H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 0 1 0 9z"></path><line x1="8" y1="20" x2="8" y2="21"></line><line x1="12" y1="20" x2="12" y2="22"></line><line x1="16" y1="20" x2="16" y2="21"></line></I>;
const IcSliders = (p) => <I {...p}><line x1="3" y1="6" x2="21" y2="6"></line><circle cx="14" cy="6" r="2.4" fill="var(--canvas)"></circle><line x1="3" y1="12" x2="21" y2="12"></line><circle cx="8" cy="12" r="2.4" fill="var(--canvas)"></circle><line x1="3" y1="18" x2="21" y2="18"></line><circle cx="16" cy="18" r="2.4" fill="var(--canvas)"></circle></I>;

/* ---- Shared primitives ---- */

function MonoLabel({ icon: Icon, children, style }) {
  return (
    <div className="mono-label" style={{ display: "flex", alignItems: "center", gap: 6, ...style }}>
      {Icon ? <Icon size={12} /> : null}<span>{children}</span>
    </div>);

}

function StatusBadge({ status }) {
  const map = {
    running: { label: "running", fg: "var(--action-blue)", pulse: true },
    queued: { label: "queued", fg: "var(--ink-subtle)" },
    awaiting_review: { label: "needs you", fg: "var(--coral)", pulse: true },
    gate: { label: "at gate", fg: "var(--coral)", pulse: true },
    completed: { label: "completed", fg: "var(--emerald)" },
    failed: { label: "failed", fg: "var(--rose)" },
    planned: { label: "planned", fg: "var(--ink-faint)" },
    waiting: { label: "waiting", fg: "var(--coral)" },
    idle: { label: "idle", fg: "var(--ink-faint)" }
  };
  const v = map[status] || map.planned;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: "uppercase",
      letterSpacing: "0.1em", fontWeight: 600, color: v.fg,
      border: `1px solid color-mix(in oklab, ${v.fg} 35%, transparent)`,
      borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap"
    }}>
      <span className={`dot ${v.pulse ? "dot-gate" : ""}`} style={{ width: 5, height: 5, background: v.fg }}></span>
      {v.label}
    </span>);

}

function StepDot({ status }) {
  const cls = { running: "dot-running", completed: "dot-completed", planned: "dot-planned", failed: "dot-failed", gate: "dot-gate" }[status] || "dot-planned";
  return <span className={`dot ${cls}`}></span>;
}

function Cite({ n }) {
  const c = window.CADENCE_DATA.citations[n];
  if (!c) return null;
  return (
    <span className="cite">[{n}]
      <span className="cite-pop"><strong style={{ color: "var(--ink)", display: "block", marginBottom: 2 }}>{c.source}</strong>{c.body}</span>
    </span>);

}

Object.assign(window, {
  IcHome, IcInbox, IcChat, IcCompass, IcActivity, IcBook, IcShield, IcGauge, IcPlug,
  IcSparkles, IcBot, IcChevDown, IcChevUp, IcChevRight, IcExternal, IcClock, IcCheck,
  IcX, IcPlus, IcArrowUp, IcTarget, IcFocus, IcCalendar, IcUsers, IcZap, IcCoins,
  IcBranch, IcSearch, IcSun, IcMoon, IcThumbUp, IcThumbDown, IcReplay, IcCmd, CadenceMark, IcDrizzle, IcSliders,
  MonoLabel, StatusBadge, StepDot, Cite
});