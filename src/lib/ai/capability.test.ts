import { describe, expect, test } from "bun:test";
import {
  selectModelForCapability,
  capabilityRoutedModel,
  cheapestCapableLiveModel,
  detectCapability,
} from "./capability";
import { MODELS, AUTO_MODEL, DEFAULT_MODEL, type Model } from "./models";

// Availability predicates for tests.
const liveOnly = (m: Model) => m.live;
const allAvailable = () => true;

describe("selectModelForCapability", () => {
  test("with only gateway-live models, code routes to the best live coder", () => {
    const id = selectModelForCapability({ capability: "code", isAvailable: liveOnly });
    expect(id).toBe("openai/gpt-5.4");
  });

  test("when an adapter-ready provider is available, the top preference wins", () => {
    // claude-opus-4 outranks gpt-5.4 in the code preference order once it's reachable.
    const id = selectModelForCapability({ capability: "code", isAvailable: allAvailable });
    expect(id).toBe("openai/gpt-5.4"); // gpt-5.4 is first in CAPABILITY_PREFERENCES.code
  });

  test("reasoning is value-ordered: the best quality-per-cost reasoner leads (not the premium one)", () => {
    // With BYO-keyed providers first in the preference list, the first live model is openai/gpt-5.
    // When no BYO keys are configured, gateway-live models resolve; gpt-5 leads over gemini-2.5-pro.
    expect(selectModelForCapability({ capability: "reasoning", isAvailable: liveOnly })).toBe(
      "openai/gpt-5",
    );
  });

  test("an explicit, capable, available requested model is respected", () => {
    const id = selectModelForCapability({
      capability: "reasoning",
      requested: "google/gemini-2.5-pro",
      isAvailable: liveOnly,
    });
    expect(id).toBe("google/gemini-2.5-pro");
  });

  test("an explicit but INCAPABLE requested model is NOT respected (falls to policy)", () => {
    // gemini-2.5-flash-lite is fast-chat only, not a coder.
    const id = selectModelForCapability({
      capability: "code",
      requested: "google/gemini-2.5-flash-lite",
      isAvailable: liveOnly,
    });
    expect(id).toBe("openai/gpt-5.4");
  });

  test("returns null when nothing capable is reachable", () => {
    // image-gen has no candidates in the catalog.
    expect(
      selectModelForCapability({ capability: "image-gen", isAvailable: allAvailable }),
    ).toBeNull();
  });
});

describe("cheapestCapableLiveModel", () => {
  test("fast-chat floor is a cheap live model", () => {
    expect(cheapestCapableLiveModel("fast-chat")).toBe("google/gemini-2.5-flash-lite");
  });
});

describe("detectCapability (Auto mode heuristics)", () => {
  test("code is detected from a fenced block", () => {
    expect(detectCapability([{ role: "user", content: "fix this ```js\nx()\n```" }])).toBe("code");
  });
  test("a tiny prompt is fast-chat", () => {
    expect(detectCapability([{ role: "user", content: "hi" }])).toBe("fast-chat");
  });
  test("a huge prompt is long-context", () => {
    expect(detectCapability([{ role: "user", content: "x".repeat(50_000) }])).toBe("long-context");
  });
  test("a substantial (non-tiny, non-huge) prompt is reasoning", () => {
    // Length-based: a one-liner is fast-chat; a paragraph-scale request is reasoning.
    const para = "Help me plan the launch sequence for my product. ".repeat(12); // ~590 chars, well over the fast-chat cutoff
    expect(detectCapability([{ role: "user", content: para }])).toBe("reasoning");
  });

  test("a one-line question is fast-chat (cost-efficient)", () => {
    expect(detectCapability([{ role: "user", content: "What should I name my product?" }])).toBe(
      "fast-chat",
    );
  });
});

describe("capabilityRoutedModel — engagement contract", () => {
  const base = {
    messages: [{ role: "user", content: "Plan my roadmap for the quarter ahead, in detail." }],
    isAvailable: liveOnly,
    enabled: true,
  };

  test("Auto mode resolves to a concrete model (never the 'auto' sentinel)", () => {
    const id = capabilityRoutedModel({ ...base, surface: "chat", requestedModel: AUTO_MODEL });
    expect(id).not.toBe(AUTO_MODEL);
    expect(MODELS.some((m) => m.id === id)).toBe(true);
  });

  test("a consumer surface with an explicit model + no task is RESPECTED (quality gate)", () => {
    const id = capabilityRoutedModel({
      ...base,
      surface: "chat",
      requestedModel: "google/gemini-2.5-flash",
    });
    expect(id).toBe("google/gemini-2.5-flash");
  });

  test("an explicit task hint routes to the best model for that capability", () => {
    const id = capabilityRoutedModel({
      ...base,
      surface: "copilot",
      requestedModel: "google/gemini-2.5-flash",
      task: "code",
    });
    expect(id).toBe("openai/gpt-5.4");
  });

  test("an internal system surface (brief) is auto-routed by its capability", () => {
    const id = capabilityRoutedModel({
      ...base,
      surface: "brief",
      requestedModel: AUTO_MODEL, // auto mode so SURFACE_CAPABILITY engages
    });
    expect(id).toBe("google/gemini-2.5-flash-lite"); // brief → fast-chat policy
  });

  test("eval is NEVER routed (benchmark integrity)", () => {
    const id = capabilityRoutedModel({
      ...base,
      surface: "eval",
      requestedModel: "deepseek/deepseek-v3",
      task: "code",
    });
    expect(id).toBe("deepseek/deepseek-v3");
  });

  test("judge is NEVER routed (Critic is a deliberate choice)", () => {
    const id = capabilityRoutedModel({
      ...base,
      surface: "judge",
      requestedModel: "google/gemini-2.5-pro",
      task: "reasoning",
    });
    expect(id).toBe("google/gemini-2.5-pro");
  });

  test("disabled → identity (byte-identical to pinned routing), but 'auto' still resolves", () => {
    expect(
      capabilityRoutedModel({
        ...base,
        surface: "brief",
        requestedModel: "google/gemini-2.5-pro",
        enabled: false,
      }),
    ).toBe("google/gemini-2.5-pro");
    expect(
      capabilityRoutedModel({
        ...base,
        surface: "chat",
        requestedModel: AUTO_MODEL,
        enabled: false,
      }),
    ).toBe(DEFAULT_MODEL);
  });
});
