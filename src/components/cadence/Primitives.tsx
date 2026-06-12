// Shared Ember Editorial primitives — ported 1:1 from
// design-reference/cadence/icons.jsx (the design of record). Values are the
// reference's; do not retune here — change the reference first.
import type { CSSProperties, ReactNode } from "react";

/* CadenceMark — "the butterfly." Two pairs of translucent wings on a
   slender body: lightness, precision, metamorphosis (signal → shipped).
   Deliberately bilateral, NOT a radial flower/asterisk. Wings breathe in a
   slow flutter (gated by prefers-reduced-motion via the global CSS).
   tile={false} = mono single-ink variant. */
export function CadenceMark({ size = 22, tile = true }: { size?: number; tile?: boolean }) {
  const upper =
    "M 12.9 11.2 C 13.6 7.6 16.4 4.9 19.1 4.9 C 21.2 4.9 21.9 6.6 21.0 8.6 C 20.0 10.8 16.9 12.4 13.4 12.2 Z";
  const lower =
    "M 13.2 12.9 C 16.1 12.9 18.6 14.3 19.2 16.2 C 19.7 17.9 18.4 19.1 16.5 18.6 C 14.6 18.1 13.1 16.0 12.9 13.4 Z";
  const wing = (d: string, fill: string, mirror: boolean) => (
    <path
      d={d}
      fill={fill}
      opacity={tile ? 0.78 : 0.42}
      transform={mirror ? "scale(-1 1) translate(-24 0)" : undefined}
    />
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      <g className="cad-flutter">
        {wing(upper, tile ? "var(--ember)" : "currentColor", false)}
        {wing(lower, tile ? "var(--saffron)" : "currentColor", false)}
      </g>
      <g className="cad-flutter-l">
        {wing(upper, tile ? "var(--ember)" : "currentColor", true)}
        {wing(lower, tile ? "var(--saffron)" : "currentColor", true)}
      </g>
      <path
        d="M 12 6.8 C 12.35 8.2 12.35 15.8 12 18.0 C 11.65 15.8 11.65 8.2 12 6.8 Z"
        fill={tile ? "var(--primary-ink)" : "currentColor"}
        opacity={tile ? 0.95 : 0.7}
      />
      <circle
        cx="12"
        cy="6.1"
        r="0.95"
        fill={tile ? "var(--primary-ink)" : "currentColor"}
        opacity={tile ? 0.95 : 0.7}
      />
    </svg>
  );
}

/* MonoLabel — uppercase mono metadata row, optional leading icon. The icon
   prop takes a lucide component (production icon set, 1.75 stroke). */
export function MonoLabel({
  icon: Icon,
  children,
  style,
  className,
}: {
  icon?: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`mono-label ${className ?? ""}`}
      style={{ display: "flex", alignItems: "center", gap: 6, ...style }}
    >
      {Icon ? <Icon size={12} strokeWidth={1.75} /> : null}
      <span>{children}</span>
    </div>
  );
}

export type StepStatus = "running" | "completed" | "planned" | "failed" | "gate";

/* StepDot — 7px status dot; color roles per the design contract. */
export function StepDot({ status }: { status: StepStatus | string }) {
  const cls =
    (
      {
        running: "dot-running",
        completed: "dot-completed",
        planned: "dot-planned",
        failed: "dot-failed",
        gate: "dot-gate",
      } as Record<string, string>
    )[status] || "dot-planned";
  return <span className={`dot ${cls}`} />;
}

/* StatusBadge — mono pill + dot. Status vocabulary from the reference. */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; fg: string; pulse?: boolean }> = {
    running: { label: "running", fg: "var(--action-blue)", pulse: true },
    queued: { label: "queued", fg: "var(--ink-subtle)" },
    awaiting_review: { label: "needs you", fg: "var(--coral)", pulse: true },
    gate: { label: "at gate", fg: "var(--coral)", pulse: true },
    completed: { label: "completed", fg: "var(--emerald)" },
    failed: { label: "failed", fg: "var(--rose)" },
    planned: { label: "planned", fg: "var(--ink-faint)" },
    waiting: { label: "waiting", fg: "var(--coral)" },
    idle: { label: "idle", fg: "var(--ink-faint)" },
  };
  const v = map[status] || map.planned;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        fontWeight: 600,
        color: v.fg,
        border: `1px solid color-mix(in oklab, ${v.fg} 35%, transparent)`,
        borderRadius: 99,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      <span
        className={`dot ${v.pulse ? "dot-gate" : ""}`}
        style={{ width: 5, height: 5, background: v.fg }}
      />
      {v.label}
    </span>
  );
}

/* VerdictChip — founder ruling 2026-06-12: the inline annotation pattern
   (KEEP / CORRECT / ADD NEXT). A mono-caps OUTLINE pill that classifies the
   content it precedes — a rendered judgment, not live state (live state with
   a pulse dot is StatusBadge). No fill, no dot, no icon; the role color IS
   the meaning:
     moss    confirmed / keep / validated / ship
     ember   needs correction / the human's call
     indigo  next action / do this now
     orchid  agent-performed
     saffron highlight / celebrate
     madder  failed / missed / kill
   Full usage rules: DESIGN.md "Inline verdict chips". */
export type VerdictTone = "moss" | "ember" | "indigo" | "orchid" | "saffron" | "madder";

const VERDICT_TONES: Record<VerdictTone, string> = {
  moss: "var(--emerald)",
  ember: "var(--ember)",
  indigo: "var(--action-blue)",
  orchid: "var(--agent)",
  saffron: "var(--saffron)",
  madder: "var(--rose)",
};

export function VerdictChip({
  tone,
  children,
  selected = false,
  style,
}: {
  tone: VerdictTone;
  children: ReactNode;
  /** Picker/selected state — gains a quiet fill of the same role color. */
  selected?: boolean;
  style?: CSSProperties;
}) {
  const fg = VERDICT_TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        fontWeight: 600,
        color: fg,
        border: `1px solid color-mix(in oklab, ${fg} 40%, transparent)`,
        background: selected ? `color-mix(in oklab, ${fg} 10%, transparent)` : "transparent",
        borderRadius: 99,
        padding: "2px 9px",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* SurfaceHeader — the loop-screen header: mono kicker, serif h1, one-line
   sub. Ported 1:1 from design-reference/cadence/loop.jsx (SurfaceHeader). */
export function SurfaceHeader({
  kicker,
  icon,
  title,
  sub,
}: {
  kicker: ReactNode;
  icon?: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  title: ReactNode;
  sub: ReactNode;
}) {
  return (
    <header style={{ marginBottom: 26 }}>
      <MonoLabel icon={icon}>{kicker}</MonoLabel>
      <h1 className="font-display" style={{ fontSize: 26, marginTop: 7, fontWeight: 430 }}>
        {title}
      </h1>
      <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", marginTop: 3, maxWidth: 520 }}>
        {sub}
      </p>
    </header>
  );
}

/* TabRow — hairline tab bar with ember underline + per-tab description line.
   Ported 1:1 from design-reference/cadence/loop.jsx (TabRow). Production
   addition: tabs may be { id, label, badge } so search-param ids and live
   counts (a production affordance the reference lacks) ride the reference
   visuals — the badge renders as a quiet mono tabular count. */
export type TabRowItem = { id: string; label: string; badge?: number };

export function TabRow({
  tabs,
  active,
  onSet,
  desc,
}: {
  tabs: (string | TabRowItem)[];
  active: string;
  onSet: (id: string) => void;
  desc?: Record<string, ReactNode>;
}) {
  const items: TabRowItem[] = tabs.map((t) => (typeof t === "string" ? { id: t, label: t } : t));
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid var(--hairline)",
          flexWrap: "wrap",
        }}
      >
        {items.map((t) => (
          <button
            key={t.id}
            onClick={() => onSet(t.id)}
            style={{
              padding: "7px 13px",
              fontSize: 12.5,
              marginBottom: -1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: active === t.id ? "var(--ink)" : "var(--ink-subtle)",
              borderBottom: `2px solid ${active === t.id ? "var(--ember)" : "transparent"}`,
              fontWeight: active === t.id ? 500 : 400,
            }}
          >
            {t.label}
            {t.badge != null && t.badge > 0 ? (
              <span className="mono-label tabular-nums" style={{ fontSize: 8.5 }}>
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {desc && desc[active] ? (
        <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 8 }}>{desc[active]}</p>
      ) : null}
    </div>
  );
}

/* EmptyState — bento empty slate with icon tile, serif title, single CTA.
   Ported 1:1 from design-reference/cadence/loop.jsx (EmptyState). */
export function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
  onCta,
}: {
  icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  title: ReactNode;
  body: ReactNode;
  cta: ReactNode;
  onCta: () => void;
}) {
  return (
    <div className="bento" style={{ padding: 48, textAlign: "center" }}>
      <span
        style={{
          display: "inline-flex",
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "var(--soft-stone)",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-subtle)",
          marginBottom: 14,
        }}
      >
        <Icon size={18} />
      </span>
      <h3 className="font-display" style={{ fontSize: 19 }}>
        {title}
      </h3>
      <p
        style={{ fontSize: 13, color: "var(--ink-subtle)", margin: "6px auto 16px", maxWidth: 360 }}
      >
        {body}
      </p>
      <button className="btn btn-primary" onClick={onCta}>
        {cta}
      </button>
    </div>
  );
}

/* RiskTag — low / medium / high risk grade on approval cards. Ported 1:1
   from design-reference/cadence/loop.jsx (RiskTag). */
export function RiskTag({ risk }: { risk: string }) {
  const map: Record<string, [string, string]> = {
    low: ["var(--emerald)", "low risk"],
    medium: ["var(--ember)", "medium risk"],
    high: ["var(--rose)", "high risk"],
  };
  const [c, label] = map[risk] || map.medium;
  return (
    <span
      className="mono-label"
      style={{
        fontSize: 8.5,
        color: c,
        border: `1px solid color-mix(in oklab, ${c} 45%, transparent)`,
        borderRadius: 99,
        padding: "1px 7px",
      }}
    >
      {label}
    </span>
  );
}

/* DrillHeader — drill-down screen header: blue mono back link, kicker,
   serif 21 title, optional right-slot action. Ported 1:1 from
   design-reference/cadence/govern-detail.jsx (DrillHeader); used by BOTH the
   loop-detail and govern-detail drill-downs (screens 6 + 7). */
export function DrillHeader({
  onBack,
  backLabel,
  kicker,
  title,
  right,
}: {
  onBack: () => void;
  backLabel: ReactNode;
  kicker: ReactNode;
  title: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        className="mono-label"
        style={{ color: "var(--action-blue)", marginBottom: 10 }}
        onClick={onBack}
      >
        ← {backLabel}
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <MonoLabel>{kicker}</MonoLabel>
          <div className="font-display" style={{ fontSize: 21, marginTop: 2 }}>
            {title}
          </div>
        </div>
        {right || null}
      </div>
    </div>
  );
}

/* SubTabs — pill-row sub-navigation inside a drill-down (Runs / Failing
   cases / Config). Ported 1:1 from design-reference/cadence/govern-detail.jsx
   (SubTabs); active pill fills primary-ink with canvas text. */
export function SubTabs({
  tabs,
  active,
  onSet,
}: {
  tabs: string[];
  active: string;
  onSet: (tab: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onSet(t)}
          className="mono-label"
          style={{
            padding: "5px 11px",
            borderRadius: 99,
            fontSize: 9.5,
            color: t === active ? "var(--canvas)" : "var(--ink-subtle)",
            background: t === active ? "var(--primary-ink)" : "transparent",
            border: `1px solid ${t === active ? "transparent" : "var(--hairline)"}`,
            transition: "background var(--dur-fast), color var(--dur-fast)",
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* Cite — [n] chip with hover evidence card. Production passes the evidence
   in (source name + verbatim quote) instead of the prototype's window data. */
export function Cite({ n, source, body }: { n: number | string; source?: string; body?: string }) {
  return (
    <span className="cite">
      [{n}]
      {source ? (
        <span className="cite-pop">
          <strong style={{ color: "var(--ink)", display: "block", marginBottom: 2 }}>
            {source}
          </strong>
          {body}
        </span>
      ) : null}
    </span>
  );
}
