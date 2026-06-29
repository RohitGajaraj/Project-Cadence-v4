import { describe, it, expect } from "bun:test";
import { resolveApprovalMode, type Arc } from "./trust.server";

// BYO-P3 WI3 — the trust-graduated ship ladder. studio.pr.merge composes its
// gate from a `confirm` base through the arc dial when AUTO_SHIP is enabled, so
// this locks the exact ladder that change relies on. Also pins `review`
// stickiness (the reason WI3 cannot reuse the merge's seeded `review` mode).

describe("resolveApprovalMode — ship ladder (confirm base)", () => {
  const ladder: Array<[Arc, string]> = [
    ["observing", "review"],
    ["proving", "confirm"],
    ["trusted", "auto"],
    ["ambient", "auto"],
  ];
  for (const [arc, expected] of ladder) {
    it(`confirm @ ${arc} → ${expected}`, () => {
      expect(resolveApprovalMode("confirm", arc)).toBe(expected);
    });
  }
});

describe("resolveApprovalMode — review is sticky at every arc", () => {
  const arcs: Arc[] = ["observing", "proving", "trusted", "ambient"];
  for (const arc of arcs) {
    it(`review @ ${arc} stays review`, () => {
      expect(resolveApprovalMode("review", arc)).toBe("review");
    });
  }
});

describe("resolveApprovalMode — auto base", () => {
  it("observing forces even auto tools to review", () => {
    expect(resolveApprovalMode("auto", "observing")).toBe("review");
  });
  it("proving raises auto → confirm", () => {
    expect(resolveApprovalMode("auto", "proving")).toBe("confirm");
  });
  it("ambient leaves auto as auto", () => {
    expect(resolveApprovalMode("auto", "ambient")).toBe("auto");
  });
});
