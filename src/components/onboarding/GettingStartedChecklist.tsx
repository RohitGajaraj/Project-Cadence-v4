/**
 * WM-S2: Getting Started checklist — shown inline on Today for seeded workspaces.
 *
 * Not a modal. Not a tooltip overlay. An ambient collapsible card that sits
 * above the main Today content and quietly tracks the first five actions that
 * teach the Cadence loop. Dismisses permanently once all steps are checked
 * (or the user explicitly closes it).
 *
 * Progress is stored in localStorage keyed by workspace ID so it survives
 * refreshes without a DB migration. State is workspace-local (right device /
 * right workspace).
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";

type StepId =
  | "explore_product"
  | "review_decision"
  | "check_trust_ledger"
  | "start_build"
  | "check_brain";

interface Step {
  id: StepId;
  label: string;
  description: string;
  to: string;
}

const STEPS: Step[] = [
  {
    id: "explore_product",
    label: "Explore your product brief",
    description: "See the PRDs and opportunities already in your workspace.",
    to: "/product",
  },
  {
    id: "review_decision",
    label: "Review a decision",
    description: "Open the Decision Brain and see how choices are captured.",
    to: "/knowledge",
  },
  {
    id: "check_trust_ledger",
    label: "Read the Trust Ledger",
    description: "See the receipts: what changed, why, and what happened next.",
    to: "/trust-ledger",
  },
  {
    id: "start_build",
    label: "Start a build run",
    description: "Dispatch an agent on a real task and watch it work.",
    to: "/build",
  },
  {
    id: "check_brain",
    label: "Check your Brain",
    description: "See the memory, precedents, and patterns Cadence is building up.",
    to: "/knowledge",
  },
];

function storageKey(workspaceId: string) {
  return `cadence:tour:${workspaceId}`;
}

function loadProgress(workspaceId: string): Set<StepId> {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as StepId[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveProgress(workspaceId: string, done: Set<StepId>) {
  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify([...done]));
  } catch {
    // localStorage unavailable — progress won't persist, which is fine
  }
}

function dismissedKey(workspaceId: string) {
  return `cadence:tour:dismissed:${workspaceId}`;
}

function isDismissed(workspaceId: string): boolean {
  try {
    return localStorage.getItem(dismissedKey(workspaceId)) === "1";
  } catch {
    return false;
  }
}

function setDismissed(workspaceId: string) {
  try {
    localStorage.setItem(dismissedKey(workspaceId), "1");
  } catch {
    // ignore
  }
}

interface Props {
  workspaceId: string | null;
}

export function GettingStartedChecklist({ workspaceId }: Props) {
  const [done, setDone] = useState<Set<StepId>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    if (isDismissed(workspaceId)) return;
    setDone(loadProgress(workspaceId));
    setVisible(true);
  }, [workspaceId]);

  if (!visible || !workspaceId) return null;

  function markStep(id: StepId) {
    if (done.has(id)) return;
    const next = new Set(done);
    next.add(id);
    setDone(next);
    saveProgress(workspaceId!, next);
    if (next.size === STEPS.length) {
      // All done — auto-dismiss after a brief moment so the user sees 5/5
      setTimeout(() => dismiss(), 1800);
    }
  }

  function dismiss() {
    setDismissed(workspaceId!);
    setVisible(false);
  }

  const completedCount = done.size;
  const allDone = completedCount === STEPS.length;

  return (
    <div
      style={{
        border: "1px solid color-mix(in oklab, var(--ink) 10%, transparent)",
        borderRadius: 10,
        background: "var(--surface-elevated, var(--paper))",
        marginBottom: 24,
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          gap: 12,
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        aria-expanded={!collapsed}
        aria-label="Getting started checklist"
      >
        {/* Progress ring (simple text fraction) */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: allDone ? "var(--deep-green)" : "var(--ember)",
            background: allDone
              ? "color-mix(in oklab, var(--deep-green) 12%, transparent)"
              : "color-mix(in oklab, var(--ember) 12%, transparent)",
            borderRadius: 99,
            padding: "2px 8px",
            whiteSpace: "nowrap",
          }}
        >
          {completedCount}/{STEPS.length}
        </span>

        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>
          {allDone ? "You know the loop." : "Get started with Cadence"}
        </span>

        <button
          type="button"
          aria-label="Dismiss getting started guide"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          style={{
            background: "none",
            border: "none",
            padding: 4,
            cursor: "pointer",
            color: "var(--ink-muted)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={13} strokeWidth={1.75} />
        </button>

        <span style={{ color: "var(--ink-muted)", display: "flex" }}>
          {collapsed ? (
            <ChevronDown size={14} strokeWidth={1.75} />
          ) : (
            <ChevronUp size={14} strokeWidth={1.75} />
          )}
        </span>
      </div>

      {/* Steps list */}
      {!collapsed && (
        <div
          style={{
            borderTop: "1px solid color-mix(in oklab, var(--ink) 8%, transparent)",
            padding: "8px 0 12px",
          }}
        >
          {STEPS.map((step) => {
            const isDone = done.has(step.id);
            return (
              <div
                key={step.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "8px 16px",
                  opacity: isDone ? 0.5 : 1,
                }}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  aria-label={isDone ? `${step.label} (done)` : `Mark "${step.label}" as done`}
                  onClick={() => markStep(step.id)}
                  style={{
                    flexShrink: 0,
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: `1.5px solid ${isDone ? "var(--deep-green)" : "color-mix(in oklab, var(--ink) 30%, transparent)"}`,
                    background: isDone
                      ? "color-mix(in oklab, var(--deep-green) 15%, transparent)"
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: isDone ? "default" : "pointer",
                    marginTop: 1,
                  }}
                >
                  {isDone && <Check size={11} strokeWidth={2.5} color="var(--deep-green)" />}
                </button>

                {/* Text + link */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    to={step.to as never}
                    onClick={() => markStep(step.id)}
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: isDone ? "var(--ink-muted)" : "var(--ink)",
                      textDecoration: isDone ? "line-through" : "none",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    {step.label}
                  </Link>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    {step.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
