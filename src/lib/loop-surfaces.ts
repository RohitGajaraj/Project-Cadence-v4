// STITCH-LOOP (v11 #9) — the surface-level loop model. The engine is already one
// continuous loop (Sense -> Decide -> Define -> Build -> Ship -> Learn, plus the
// receipts); the SURFACES the operator walks between read as separate screens.
// This pure model names the seven surfaces in loop order, what each hands forward,
// and where the operator currently sits, so a single calm strip (LoopThread) can
// make the one-system continuity felt on every surface.
//
// Pure + dependency-free on purpose: all the matching/neighbour logic is unit-
// tested under bun without a DOM, and the renderer (LoopThread.tsx) stays a thin
// view that cannot drift from this source of truth.

// The loop, in order. It is a CYCLE: Trust's proof feeds back into Today, where
// the next decision re-enters discovery in Product. Neighbours wrap accordingly.
//
// Declared `as const` and used as the source of truth for the types below, so each
// `to` keeps its literal route type — that lets TanStack Router's `<Link to>`
// validate these against the real route tree (a future route rename then fails
// `tsc`, instead of silently dead-linking). Fields: `label` = the name shown in the
// rail; `to` = the route this stage links to (`/prds` resolves to the specs view of
// Product); `produces` = what this stage hands forward (the felt-continuity payload).
export const LOOP_SURFACES = [
  { id: "today", label: "Today", to: "/", produces: "your decision" },
  { id: "product", label: "Product", to: "/product", produces: "a ranked opportunity" },
  { id: "prd", label: "PRD", to: "/prds", produces: "an approved spec" },
  { id: "build", label: "Build", to: "/build", produces: "a working change" },
  { id: "missions", label: "Missions", to: "/missions", produces: "a shipped outcome" },
  { id: "brain", label: "Brain", to: "/knowledge", produces: "a learned precedent" },
  { id: "trust", label: "Trust", to: "/trust-ledger", produces: "proof you can defend" },
] as const;

export type LoopSurface = (typeof LOOP_SURFACES)[number];
export type LoopSurfaceId = LoopSurface["id"];

/**
 * Index of the loop surface the given pathname belongs to, or -1 if the pathname
 * is not a loop surface (settings, admin, evals, ...). Uses longest-prefix match
 * so detail routes resolve correctly (`/prds/abc` -> PRD, `/build/m1` -> Build)
 * and "/" (Today) only ever matches exactly (every path starts with "/").
 */
export function loopIndexForPath(pathname: string): number {
  let best = -1;
  let bestLen = -1;
  for (let i = 0; i < LOOP_SURFACES.length; i++) {
    const to = LOOP_SURFACES[i].to;
    const match =
      to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");
    if (match && to.length > bestLen) {
      best = i;
      bestLen = to.length;
    }
  }
  return best;
}

/** Whether a pathname sits on one of the loop surfaces. */
export function isLoopSurface(pathname: string): boolean {
  return loopIndexForPath(pathname) >= 0;
}

/**
 * The previous and next surfaces around an index, wrapping cyclically (the loop
 * has no end — Trust's next is Today, Today's prev is Trust). Returns null for an
 * out-of-range index so callers fail closed.
 */
export function loopNeighbors(
  index: number,
): { prev: LoopSurface; next: LoopSurface } | null {
  if (index < 0 || index >= LOOP_SURFACES.length) return null;
  const n = LOOP_SURFACES.length;
  return {
    prev: LOOP_SURFACES[(index - 1 + n) % n],
    next: LOOP_SURFACES[(index + 1) % n],
  };
}
