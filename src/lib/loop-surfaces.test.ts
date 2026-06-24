import { describe, test, expect } from "bun:test";
import {
  LOOP_SURFACES,
  loopIndexForPath,
  isLoopSurface,
  loopNeighbors,
} from "@/lib/loop-surfaces";

describe("LOOP_SURFACES — the surface-level loop model", () => {
  test("is the seven v11 loop surfaces in order", () => {
    expect(LOOP_SURFACES.map((s) => s.id)).toEqual([
      "today",
      "product",
      "prd",
      "build",
      "missions",
      "brain",
      "trust",
    ]);
  });

  test("every surface has a label, a route, and a forward payload", () => {
    for (const s of LOOP_SURFACES) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.to.startsWith("/")).toBe(true);
      expect(s.produces.length).toBeGreaterThan(0);
    }
  });
});

describe("loopIndexForPath — where the operator currently sits", () => {
  test("matches each surface on its exact route", () => {
    expect(loopIndexForPath("/")).toBe(0);
    expect(loopIndexForPath("/product")).toBe(1);
    expect(loopIndexForPath("/prds")).toBe(2);
    expect(loopIndexForPath("/build")).toBe(3);
    expect(loopIndexForPath("/missions")).toBe(4);
    expect(loopIndexForPath("/knowledge")).toBe(5);
    expect(loopIndexForPath("/trust-ledger")).toBe(6);
  });

  test("matches detail routes via longest-prefix (PRD/Build/Missions detail)", () => {
    expect(loopIndexForPath("/prds/abc-123")).toBe(2);
    expect(loopIndexForPath("/build/m1")).toBe(3);
    expect(loopIndexForPath("/missions/m9")).toBe(4);
  });

  test('"/" (Today) only matches exactly — never as a prefix of every path', () => {
    expect(loopIndexForPath("/settings")).toBe(-1);
    expect(loopIndexForPath("/admin/people")).toBe(-1);
  });

  test("does not false-match a sibling route that shares a label prefix", () => {
    // "/budgets" must not match the Build surface ("/build").
    expect(loopIndexForPath("/budgets")).toBe(-1);
  });

  test("returns -1 for surfaces outside the loop", () => {
    expect(loopIndexForPath("/evals")).toBe(-1);
    expect(loopIndexForPath("/guardrails")).toBe(-1);
    expect(isLoopSurface("/settings")).toBe(false);
    expect(isLoopSurface("/product")).toBe(true);
  });
});

describe("loopNeighbors — the loop wraps (it has no end)", () => {
  test("interior stage has its immediate prev/next", () => {
    const n = loopNeighbors(loopIndexForPath("/product"));
    expect(n?.prev.id).toBe("today");
    expect(n?.next.id).toBe("prd");
  });

  test("Trust's next wraps back to Today; Today's prev wraps to Trust", () => {
    const trust = loopNeighbors(loopIndexForPath("/trust-ledger"));
    expect(trust?.next.id).toBe("today");
    const today = loopNeighbors(loopIndexForPath("/"));
    expect(today?.prev.id).toBe("trust");
  });

  test("an off-loop index fails closed (null)", () => {
    expect(loopNeighbors(-1)).toBeNull();
    expect(loopNeighbors(LOOP_SURFACES.length)).toBeNull();
  });
});
