/**
 * Build (engine: F-STUDIO) shared formatters — pure helpers, no components
 * (components live in studio-ui.tsx so fast refresh stays intact). Screen 9
 * Ember port: the old Tailwind palette maps (statusTone/changesetTone/opTone)
 * are gone — role colors now come from changesetColor + the StatusBadge/
 * StepDot adapters in studio-ui.tsx. Color is role, never decoration:
 * moss = outcome success · indigo = live · ember = needs-human · madder =
 * failure · ink = neutral state.
 */

// agent_runs: queued | running | waiting_approval | completed | halted | failed
// missions:   running | completed | halted
export function statusLabel(s: string): string {
  if (s === "waiting_approval") return "at gate";
  return s;
}

// studio_changesets: staged | committed | pr_open | merged | abandoned
export function changesetColor(s: string): string {
  if (s === "merged") return "var(--emerald)"; // outcome: shipped
  if (s === "pr_open") return "var(--action-blue)"; // live: under review
  if (s === "abandoned") return "var(--ink-faint)";
  return "var(--ink-subtle)"; // staged · committed — neutral ladder states
}

export function changesetLabel(s: string): string {
  if (s === "pr_open") return "PR open";
  return s;
}

/** Cost format per design.md: 4 dp under 1 cent, 2 dp above; explicit zero. */
export function fmtCost(n: number): string {
  if (!Number.isFinite(n)) return "$0.0000";
  return n > 0 && n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

export function fmtCompact(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** One-line, human-readable summary of tool args for timeline + gate cards. */
export function summarizeArgs(args: Record<string, unknown>, max = 160): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(args ?? {})) {
    if (v == null) continue;
    let val: string;
    if (typeof v === "string") val = v.replace(/\s+/g, " ");
    else if (Array.isArray(v)) val = `[${v.length}]`;
    else if (typeof v === "object") val = JSON.stringify(v);
    else val = String(v);
    if (val.length > 60) val = `${val.slice(0, 57)}…`;
    parts.push(`${k}: ${val}`);
  }
  const line = parts.join(" · ");
  return line.length > max ? `${line.slice(0, max - 1)}…` : line || "(no args)";
}
