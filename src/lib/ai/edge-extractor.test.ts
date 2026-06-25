import { describe, it, expect } from "vitest";
import { classifyOutcomeEdge, buildOutcomeEdge } from "./edge-extractor";

describe("classifyOutcomeEdge", () => {
  it("maps validated → validates", () => {
    expect(classifyOutcomeEdge("validated")).toBe("validates");
  });
  it("maps missed → contradicts", () => {
    expect(classifyOutcomeEdge("missed")).toBe("contradicts");
  });
  it("returns null for mixed", () => {
    expect(classifyOutcomeEdge("mixed")).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(classifyOutcomeEdge("")).toBeNull();
  });
  it("returns null for arbitrary string", () => {
    expect(classifyOutcomeEdge("unknown")).toBeNull();
  });
});

describe("buildOutcomeEdge", () => {
  const base = { prdId: "prd-uuid-1", opportunityId: "opp-uuid-1", verdict: "validated" };

  it("builds a validates edge for a validated outcome", () => {
    const edge = buildOutcomeEdge(base);
    expect(edge).not.toBeNull();
    expect(edge?.relation).toBe("validates");
    expect(edge?.parent_kind).toBe("prd");
    expect(edge?.parent_id).toBe("prd-uuid-1");
    expect(edge?.child_kind).toBe("opportunity");
    expect(edge?.child_id).toBe("opp-uuid-1");
    expect(edge?.created_by_agent).toBe("outcome-edge-extractor");
  });

  it("builds a contradicts edge for a missed outcome", () => {
    const edge = buildOutcomeEdge({ ...base, verdict: "missed" });
    expect(edge).not.toBeNull();
    expect(edge?.relation).toBe("contradicts");
  });

  it("returns null for mixed — no directional edge on ambiguous verdicts", () => {
    expect(buildOutcomeEdge({ ...base, verdict: "mixed" })).toBeNull();
  });

  it("returns null when opportunityId is null", () => {
    expect(buildOutcomeEdge({ ...base, opportunityId: null })).toBeNull();
  });

  it("rationale mentions the verdict", () => {
    const edge = buildOutcomeEdge(base);
    expect(edge?.rationale).toContain("validated");
  });

  it("rationale for missed mentions missed", () => {
    const edge = buildOutcomeEdge({ ...base, verdict: "missed" });
    expect(edge?.rationale).toContain("missed");
  });
});
