/**
 * F-STUDIO shared formatters + status tones (pure helpers, no components —
 * components live in studio-ui.tsx so fast refresh stays intact).
 * Follows the mission cockpit visual language (emerald/cyan/amber/rose).
 */

// agent_runs: queued | running | waiting_approval | completed | halted | failed
// missions:   running | completed | halted
export function statusTone(s: string): string {
  if (s === "completed") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (s === "running") return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
  if (s === "queued" || s === "waiting_approval")
    return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  if (s === "failed" || s === "halted") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  return "bg-muted text-muted-foreground border-border";
}

export function statusLabel(s: string): string {
  if (s === "waiting_approval") return "waiting on you";
  return s;
}

// studio_changesets: staged | committed | pr_open | merged | abandoned
export function changesetTone(s: string): string {
  if (s === "merged") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (s === "pr_open") return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
  if (s === "committed") return "bg-violet-500/15 text-violet-300 border-violet-500/30";
  if (s === "staged") return "bg-amber-500/15 text-amber-300 border-amber-400/30";
  return "bg-muted text-muted-foreground border-border";
}

export function opTone(op: string): string {
  if (op === "create") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (op === "delete") return "bg-rose-500/15 text-rose-300 border-rose-400/30";
  return "bg-sky-500/15 text-sky-300 border-sky-500/30";
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
