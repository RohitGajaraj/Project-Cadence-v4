// STITCH-LOOP (v11 #9) — the felt-continuity strip. A thin, calm rail under the
// TopBar (and on the PRD detail) that shows the seven loop surfaces in order, where
// the operator currently sits, and what this stage hands to the next — so walking
// between screens reads as one continuous autonomous loop, not separate apps.
//
// Route-derived (useRouterState), so the position can never be passed wrong by a
// page; renders nothing off the loop (settings, admin, evals, ...). All matching/
// neighbour logic lives in the unit-tested pure model `@/lib/loop-surfaces`.
//
// Engine-Room: this is calm chrome over the existing engine loop — it names the
// outcome of each stage, not the mechanism, and reveals the path forward.

import { Fragment } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, RotateCw } from "lucide-react";
import {
  LOOP_SURFACES,
  loopIndexForPath,
  loopNeighbors,
} from "@/lib/loop-surfaces";

export function LoopThread() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const idx = loopIndexForPath(pathname);
  if (idx < 0) return null;

  const neighbors = loopNeighbors(idx);
  const current = LOOP_SURFACES[idx];

  return (
    <nav
      aria-label="The loop"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 28px",
        height: 30,
        flexShrink: 0,
        borderBottom: "1px solid var(--hairline)",
        background: "var(--canvas)",
        overflow: "hidden",
        fontSize: 11.5,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" }}
      >
        {LOOP_SURFACES.map((s, i) => {
          const cls =
            i === idx
              ? "text-[color:var(--ink)] font-semibold"
              : s.id === neighbors?.next.id
                ? "text-[color:var(--action-blue)] font-medium hover:opacity-80"
                : "text-[color:var(--ink-faint)] hover:text-[color:var(--ink)]";
          return (
            <Fragment key={s.id}>
              {i > 0 && (
                <ChevronRight
                  size={11}
                  strokeWidth={1.75}
                  style={{ color: "var(--ink-faint)", flexShrink: 0 }}
                  aria-hidden
                />
              )}
              <Link
                to={s.to}
                title={`${s.label} — hands off ${s.produces}`}
                className={`whitespace-nowrap no-underline transition-colors ${cls}`}
                aria-current={i === idx ? "page" : undefined}
              >
                {s.label}
              </Link>
            </Fragment>
          );
        })}
        <span title="The loop runs continuously" style={{ display: "inline-flex", flexShrink: 0 }}>
          <RotateCw
            size={11}
            strokeWidth={1.75}
            style={{ color: "var(--ink-faint)", marginLeft: 2 }}
            aria-hidden
          />
        </span>
      </div>

      {neighbors && (
        <span
          className="mono-label hidden md:inline-flex"
          style={{
            marginLeft: "auto",
            alignItems: "center",
            gap: 6,
            color: "var(--ink-faint)",
            fontSize: 9.5,
            whiteSpace: "nowrap",
          }}
        >
          {current.produces}
          <ChevronRight size={10} strokeWidth={1.75} aria-hidden />
          {neighbors.next.label}
        </span>
      )}
    </nav>
  );
}
