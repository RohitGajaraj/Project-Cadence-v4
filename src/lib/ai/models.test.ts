import { describe, expect, test } from "bun:test";
import { activeModelId, type Model } from "./models";

// An injected catalog so the resolver's LOGIC is verified independent of the real
// catalog's state (the real catalog has no deprecated models today, by design).
const cat: Model[] = [
  {
    id: "old/a",
    label: "A",
    provider: "google",
    tier: "fast",
    contextK: 1,
    desc: "",
    live: false,
    deprecated: true,
    replacement: "new/b",
  },
  { id: "new/b", label: "B", provider: "google", tier: "fast", contextK: 1, desc: "", live: true },
  {
    id: "mid/c",
    label: "C",
    provider: "google",
    tier: "fast",
    contextK: 1,
    desc: "",
    live: false,
    deprecated: true,
    replacement: "mid/d",
  },
  {
    id: "mid/d",
    label: "D",
    provider: "google",
    tier: "fast",
    contextK: 1,
    desc: "",
    live: false,
    deprecated: true,
    replacement: "new/b",
  },
  {
    id: "dead/e",
    label: "E",
    provider: "google",
    tier: "fast",
    contextK: 1,
    desc: "",
    live: false,
    deprecated: true,
    replacement: "ghost/x",
  }, // replacement missing
  {
    id: "dead/f",
    label: "F",
    provider: "google",
    tier: "fast",
    contextK: 1,
    desc: "",
    live: false,
    deprecated: true,
    replacement: "stale/z",
  }, // replacement is a non-live dead end
  {
    id: "stale/z",
    label: "Z",
    provider: "google",
    tier: "fast",
    contextK: 1,
    desc: "",
    live: false,
  }, // non-live, not deprecated: a dead end
  {
    id: "loop/g",
    label: "G",
    provider: "google",
    tier: "fast",
    contextK: 1,
    desc: "",
    live: false,
    deprecated: true,
    replacement: "loop/h",
  },
  {
    id: "loop/h",
    label: "H",
    provider: "google",
    tier: "fast",
    contextK: 1,
    desc: "",
    live: false,
    deprecated: true,
    replacement: "loop/g",
  }, // cycle
];

describe("activeModelId", () => {
  test("a current (non-deprecated) model is returned unchanged", () => {
    expect(activeModelId("new/b", cat)).toBe("new/b");
  });

  test("a deprecated model routes to its live replacement", () => {
    expect(activeModelId("old/a", cat)).toBe("new/b");
  });

  test("follows a chain of deprecations to the final live model", () => {
    // mid/c -> mid/d -> new/b
    expect(activeModelId("mid/c", cat)).toBe("new/b");
  });

  test("does not route when the replacement is missing from the catalog", () => {
    expect(activeModelId("dead/e", cat)).toBe("dead/e");
  });

  test("does not route to a non-live replacement (would be unusable)", () => {
    expect(activeModelId("dead/f", cat)).toBe("dead/f");
  });

  test("a deprecation cycle terminates and does not loop forever", () => {
    // loop/g <-> loop/h, neither resolves to a live model: return the original
    expect(activeModelId("loop/g", cat)).toBe("loop/g");
  });

  test("an unknown id is returned unchanged", () => {
    expect(activeModelId("does/not-exist", cat)).toBe("does/not-exist");
  });

  test("defaults to the real catalog when none is injected (no current deprecations -> identity)", () => {
    expect(activeModelId("google/gemini-3-flash-preview")).toBe("google/gemini-3-flash-preview");
  });
});
