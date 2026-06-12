import { StatusBadge, StepDot } from "@/components/cadence/Primitives";
import { changesetColor, changesetLabel, statusLabel } from "./studio-format";

/**
 * Build (engine: F-STUDIO) shared status components — screen 9 Ember port.
 * StatusChip adapts the studio status vocabulary onto the canonical
 * StatusBadge (live-state law: badge + pulse, never a VerdictChip);
 * `waiting_approval` maps to the badge's `gate` state (an approval IS a
 * gate — ember, pulsing). `halted` has no badge state and Primitives is
 * frozen across parallel sessions, so it renders the same pill anatomy
 * file-locally in madder — LOGGED for consolidation into StatusBadge.
 * StatusIcon is the screen-4 mission-row StepDot.
 */

const BADGE_STATE: Record<string, string> = {
  waiting_approval: "gate",
  running: "running",
  queued: "queued",
  completed: "completed",
  failed: "failed",
};

export function StatusChip({ status }: { status: string }) {
  const mapped = BADGE_STATE[status];
  if (mapped) return <StatusBadge status={mapped} />;
  // halted (kill switch / engine stop) — madder pill, no pulse.
  const c = status === "halted" ? "var(--rose)" : "var(--ink-faint)";
  return (
    <span
      className="mono-label"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10,
        fontWeight: 600,
        color: c,
        border: `1px solid color-mix(in oklab, ${c} 35%, transparent)`,
        borderRadius: 99,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      <span className="dot" style={{ width: 5, height: 5, background: c }} />
      {statusLabel(status)}
    </span>
  );
}

const DOT_STATE: Record<string, string> = {
  completed: "completed",
  running: "running",
  queued: "planned",
  waiting_approval: "gate",
  failed: "failed",
  halted: "failed",
};

export function StatusIcon({ s }: { s: string }) {
  return <StepDot status={DOT_STATE[s] ?? "planned"} />;
}

/** Changeset ladder chip — staged · committed · PR open (live, indigo) ·
 *  merged (outcome, moss) · abandoned. Mono outline pill, no dot. */
export function ChangesetChip({ status, fileCount }: { status: string; fileCount?: number }) {
  const c = changesetColor(status);
  return (
    <span
      className="mono-label tabular-nums"
      style={{
        fontSize: 9,
        color: c,
        border: `1px solid color-mix(in oklab, ${c} 35%, transparent)`,
        borderRadius: 99,
        padding: "1px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {changesetLabel(status)}
      {fileCount != null ? ` · ${fileCount} file${fileCount === 1 ? "" : "s"}` : ""}
    </span>
  );
}
