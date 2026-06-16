// Hand-sketched data marks — founder directive 2026-06-12: graphs of data
// points read like pencil on paper, not system-generated vectors. Two light
// passes of a jittered stroke give the double-line graphite feel; bars get a
// jittered outline with diagonal hatch shading. Jitter is DETERMINISTIC —
// seeded from the data itself — so a chart never wobbles between renders,
// and it collapses to honest geometry: the underlying points are exact.
//
// TUNING IS LAW: the amplitudes/steps/opacities here are founder-approved
// ("calm amplitude: clearly hand-drawn, never cartoon-loose") and documented
// in DESIGN.md "Hand-sketched data marks". Do not retune without a founder
// ruling; new mark types extend this file and reuse these metrics.
import { useMemo } from "react";

/* Tiny seeded PRNG (mulberry32) — stable jitter per data series. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(data: number[], salt: number) {
  let s = salt + data.length * 7919;
  for (let i = 0; i < data.length; i++) s = (s * 31 + Math.round(data[i] * 100) + i) | 0;
  return s;
}

/* Walk a polyline, subdividing each segment into ~`step`px pieces and
   nudging every interior point — the pencil wobble. */
function sketchPath(pts: [number, number][], rnd: () => number, amp: number, step = 7): string {
  let d = "";
  const jig = (a: number) => (rnd() - 0.5) * 2 * a;
  for (let s = 0; s < pts.length - 1; s++) {
    const [x0, y0] = pts[s];
    const [x1, y1] = pts[s + 1];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let i = s === 0 ? 0 : 1; i <= n; i++) {
      const t = i / n;
      let x = x0 + (x1 - x0) * t;
      let y = y0 + (y1 - y0) * t;
      const endpoint = (s === 0 && i === 0) || (s === pts.length - 2 && i === n);
      if (!endpoint) {
        x += jig(amp * 0.5);
        y += jig(amp);
      }
      d += d === "" ? `M${x.toFixed(1)} ${y.toFixed(1)}` : ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  return d;
}

/* SketchLine — drop-in for the old straight Sparkline: no axes, jittered
   double stroke, hand-set dot on the last point. */
export function SketchLine({
  data,
  color = "var(--action-blue)",
  w = 210,
  h = 42,
  baseline,
  animate = false,
}: {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
  /** Optional reference line (eval gate, drift zero). Drawn as a clean
   *  dashed hairline — an instrument, not an observation, so it is the one
   *  mark here the sketch law leaves straight. Rendered only when it falls
   *  inside the data's range (reference Sparkline contract). */
  baseline?: number;
  /** Opt-in: pen the stroke in once on mount (CSS `.sketch-draw`, 260ms).
   *  Off by default so the existing eval/drift charts stay static. Honors
   *  data-motion="off" and reduced-motion (both render it fully drawn). */
  animate?: boolean;
}) {
  const { passA, passB, endX, endY, baseY } = useMemo(() => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const px = (i: number) => 5 + i * ((w - 10) / Math.max(1, data.length - 1));
    const py = (v: number) => h - 6 - ((v - min) / span) * (h - 12);
    const pts: [number, number][] = data.map((v, i) => [px(i), py(v)]);
    return {
      passA: sketchPath(pts, mulberry32(seedOf(data, 1)), 1.7),
      passB: sketchPath(pts, mulberry32(seedOf(data, 2)), 1.1),
      endX: px(data.length - 1),
      endY: py(data[data.length - 1]),
      baseY: baseline != null && baseline >= min && baseline <= max ? py(baseline) : null,
    };
  }, [data, w, h, baseline]);
  if (data.length < 2) return null;
  return (
    <svg width={w} height={h} aria-hidden="true" style={{ display: "block", maxWidth: "100%" }}>
      {baseY != null && (
        <line
          x1="5"
          x2={w - 5}
          y1={baseY}
          y2={baseY}
          stroke="var(--hairline-strong)"
          strokeDasharray="3 3"
        />
      )}
      <path
        d={passA}
        className={animate ? "sketch-draw" : undefined}
        pathLength={animate ? 1 : undefined}
        fill="none"
        stroke={color}
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d={passB}
        className={animate ? "sketch-draw" : undefined}
        pathLength={animate ? 1 : undefined}
        fill="none"
        stroke={color}
        strokeWidth="0.9"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle
        cx={endX + 0.4}
        cy={endY - 0.3}
        r="2.4"
        fill={color}
        className={animate ? "sketch-dot" : undefined}
        opacity="0.9"
      />
    </svg>
  );
}

/* SketchBar — one hand-drawn bar: jittered outline (corners overshoot a
   touch, like pencil strokes crossing) + diagonal hatch shading. Rendered
   in a fixed-unit viewBox; vector-effect keeps strokes uniform when the
   bar stretches. */
export function SketchBar({
  pct,
  color = "var(--ember)",
  seed,
  trackH = 72,
}: {
  /** 0–100 fill height. */
  pct: number;
  color?: string;
  /** Vary per bar so neighbours don't share the same wobble. */
  seed: number;
  trackH?: number;
}) {
  const W = 60; // nominal units; the svg stretches to the flex cell
  const { outline, hatch } = useMemo(() => {
    const rnd = mulberry32((seed * 2654435761) | 0);
    const top = trackH - Math.max(3, (pct / 100) * (trackH - 2));
    const corners: [number, number][] = [
      [2, trackH],
      [2, top],
      [W - 2, top],
      [W - 2, trackH],
    ];
    const outline = sketchPath(corners, rnd, 1.2, 9);
    // Diagonal hatch — bottom-left to top-right, clipped by hand to the bar.
    let hatch = "";
    const gap = 8.5;
    for (let x = 4 - trackH; x < W - 4; x += gap) {
      const x0 = Math.max(3, x);
      const y0 = trackH - 1 - Math.max(0, x0 - x);
      const x1 = Math.min(W - 3, x + (trackH - top));
      const y1 = top + 1 + Math.max(0, x + (trackH - top) - x1);
      if (y0 <= top + 2 || x1 <= x0) continue;
      const j = () => (rnd() - 0.5) * 1.6;
      hatch += `M${(x0 + j()).toFixed(1)} ${(y0 + j()).toFixed(1)} L${(x1 + j()).toFixed(1)} ${(Math.max(top + 1, y1) + j()).toFixed(1)} `;
    }
    return { outline, hatch };
  }, [pct, seed, trackH]);
  return (
    <svg
      width="100%"
      height={trackH}
      viewBox={`0 0 ${W} ${trackH}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d={hatch}
        stroke={color}
        strokeWidth="1"
        opacity="0.38"
        fill="none"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={outline}
        stroke={color}
        strokeWidth="1.4"
        opacity="0.85"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
