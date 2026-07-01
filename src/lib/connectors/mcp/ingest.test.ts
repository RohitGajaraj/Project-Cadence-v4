import { describe, it, expect } from "bun:test";
import { hashText, blocksToCandidates } from "./ingest.server";

describe("hashText", () => {
  it("is deterministic — same input produces the same hash", () => {
    expect(hashText("hello world")).toBe(hashText("hello world"));
  });

  it("produces a different hash for different input", () => {
    expect(hashText("hello world")).not.toBe(hashText("goodbye world"));
  });

  it("returns a hex string", () => {
    expect(hashText("anything")).toMatch(/^[0-9a-f]+$/);
  });

  it("handles empty input without throwing", () => {
    expect(() => hashText("")).not.toThrow();
  });
});

describe("blocksToCandidates", () => {
  it("maps a block to a SignalCandidate with untrusted:true and sourceKind mcp_source", () => {
    const cands = blocksToCandidates("linear-mcp", [
      { type: "text", text: "Customer wants dark mode" },
    ]);
    expect(cands.length).toBe(1);
    expect(cands[0].sourceKind).toBe("mcp_source");
    expect(cands[0].untrusted).toBe(true);
    expect(cands[0].source).toBe("mcp:linear-mcp");
    expect(cands[0].title).toBe("Customer wants dark mode");
    expect(cands[0].content).toBe("Customer wants dark mode");
    expect(cands[0].url).toBeNull();
  });

  it("derives the externalId from hashText, stably", () => {
    const text = "Recurring complaint about export speed";
    const cands = blocksToCandidates("gong", [{ type: "text", text }]);
    expect(cands[0].externalId).toBe(`mcp:gong:${hashText(text)}`);
  });

  it("two different serverIds with the same text produce DIFFERENT externalIds", () => {
    const text = "Same transcript excerpt";
    const a = blocksToCandidates("gong", [{ type: "text", text }]);
    const b = blocksToCandidates("granola", [{ type: "text", text }]);
    expect(a[0].externalId).not.toBe(b[0].externalId);
  });

  it("truncates title to the first line, capped at 300 chars", () => {
    const longLine = "x".repeat(400);
    const text = `${longLine}\nsecond line`;
    const cands = blocksToCandidates("enterpret", [{ type: "text", text }]);
    expect(cands[0].title.length).toBe(300);
    expect(cands[0].title).toBe(longLine.slice(0, 300));
  });

  it("truncates content to 1500 chars", () => {
    const long = "y".repeat(3000);
    const cands = blocksToCandidates("enterpret", [{ type: "text", text: long }]);
    expect(cands[0].content.length).toBe(1500);
  });

  it("skips blocks with empty or whitespace-only text", () => {
    const cands = blocksToCandidates("linear-mcp", [
      { type: "text", text: "" },
      { type: "text", text: "   \n  " },
      { type: "text" },
      { type: "text", text: "real content" },
    ]);
    expect(cands.length).toBe(1);
    expect(cands[0].content).toBe("real content");
  });

  it("falls back to the full trimmed text as title when there is no newline", () => {
    const cands = blocksToCandidates("linear-mcp", [{ type: "text", text: "  one liner  " }]);
    expect(cands[0].title).toBe("one liner");
  });
});
