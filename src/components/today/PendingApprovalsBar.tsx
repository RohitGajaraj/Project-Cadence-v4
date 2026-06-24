// CORE-UX-FELT (v11, founder ask 2026-06-24) — the Today page must NOT list every
// pending tool-approval gate; that over-populates the home and reads as a
// babysitting queue. Instead, collapse them into ONE calm bar: a glanceable count
// (+ a quiet "needs a closer look" hint when high-blast-radius calls are waiting)
// that opens the full, decide-able detail in Govern → Approvals (where the per-gate
// cards + the per-agent track record already live). Clean front, deep detail on demand.
import { Link } from "@tanstack/react-router";
import { Inbox, ChevronRight, ShieldAlert } from "lucide-react";
import { summarizeGateStakes, type PendingGate } from "@/lib/copilot-brief";

export function PendingApprovalsBar({ gates }: { gates: PendingGate[] }) {
  const count = Array.isArray(gates) ? gates.length : 0;
  if (count === 0) return null;
  // Reuse the brief's stakes math: "needs a closer look" = high blast radius
  // (toolRisk high, which already covers irreversible calls).
  const attention = summarizeGateStakes(gates).highRisk;

  return (
    <Link
      to="/govern"
      search={{ tab: "approvals" }}
      className="lift"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "9px 12px",
        borderRadius: 8,
        border: "1px solid var(--hairline)",
        background: "var(--surface-2)",
        color: "var(--ink-muted)",
        fontSize: 12.5,
        textDecoration: "none",
      }}
    >
      <Inbox size={14} strokeWidth={1.75} style={{ color: "var(--ink-faint)", flexShrink: 0 }} />
      <span style={{ color: "var(--ink)" }}>
        {count} pending approval{count === 1 ? "" : "s"}
      </span>
      {attention > 0 && (
        <span
          className="mono-label"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--rose)", fontSize: 9.5 }}
        >
          <ShieldAlert size={11} strokeWidth={1.9} />
          {attention} need{attention === 1 ? "s" : ""} a closer look
        </span>
      )}
      <span
        className="mono-label"
        style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 2, color: "var(--action-blue)", fontSize: 9.5 }}
      >
        Review <ChevronRight size={12} />
      </span>
    </Link>
  );
}
