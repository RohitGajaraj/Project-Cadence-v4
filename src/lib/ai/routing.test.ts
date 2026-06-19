import { describe, it, expect } from "bun:test";
import {
  blendedPrice,
  cheapestLiveModel,
  costRoutedModel,
  COST_ROUTABLE_SURFACES,
} from "./routing";

describe("blendedPrice", () => {
  it("is the mean of the in and out per-Mtok rates", () => {
    expect(blendedPrice("google/gemini-2.5-flash-lite")).toBeCloseTo(0.125, 6); // (0.05 + 0.2)/2
    expect(blendedPrice("openai/gpt-5")).toBeCloseTo(10, 6); // (5 + 15)/2
  });

  it("falls back to the neutral default for an unknown model (never NaN)", () => {
    const p = blendedPrice("made/up-model");
    expect(Number.isFinite(p)).toBe(true);
    expect(p).toBeCloseTo(1.0, 6); // (0.5 + 1.5)/2 default
  });
});

describe("cheapestLiveModel", () => {
  it("is the cheapest LIVE catalog model by blended price (gemini-2.5-flash-lite today)", () => {
    expect(cheapestLiveModel()).toBe("google/gemini-2.5-flash-lite");
  });

  it("is genuinely the minimum, no live model is cheaper", () => {
    const floor = blendedPrice(cheapestLiveModel());
    // a few known live models must all be >= the floor
    for (const m of [
      "google/gemini-3-flash-preview",
      "openai/gpt-5-nano",
      "google/gemini-2.5-pro",
    ]) {
      expect(blendedPrice(m)).toBeGreaterThanOrEqual(floor);
    }
  });
});

describe("costRoutedModel", () => {
  it("downgrades a routine surface on a fast/balanced model to the cheapest live model", () => {
    expect(costRoutedModel("brief", "google/gemini-3-flash-preview")).toBe(
      "google/gemini-2.5-flash-lite",
    );
    expect(costRoutedModel("test", "google/gemini-2.5-flash")).toBe("google/gemini-2.5-flash-lite");
  });

  it("never downgrades a deliberate reasoning/premium model, even on a routable surface (tier guard)", () => {
    expect(costRoutedModel("brief", "google/gemini-2.5-pro")).toBe("google/gemini-2.5-pro"); // reasoning
    expect(costRoutedModel("scheduler", "openai/gpt-5")).toBe("openai/gpt-5"); // reasoning
    expect(costRoutedModel("test", "openai/gpt-5.5-pro")).toBe("openai/gpt-5.5-pro"); // premium
  });

  it("never downgrades a HARD / user-facing surface (the quality gate)", () => {
    for (const surface of ["agent", "prd", "copilot", "studio", "chat", "discovery"]) {
      expect(costRoutedModel(surface, "google/gemini-2.5-flash")).toBe("google/gemini-2.5-flash");
    }
  });

  it("never routes the wedge (judge), the benchmark (eval), or embeddings (embed)", () => {
    expect(costRoutedModel("judge", "google/gemini-2.5-flash")).toBe("google/gemini-2.5-flash");
    expect(costRoutedModel("eval", "google/gemini-2.5-flash")).toBe("google/gemini-2.5-flash");
    expect(costRoutedModel("embed", "google/gemini-2.5-flash")).toBe("google/gemini-2.5-flash");
  });

  it("keeps the requested model when it is already the cheapest (no sideways move)", () => {
    expect(costRoutedModel("brief", "google/gemini-2.5-flash-lite")).toBe(
      "google/gemini-2.5-flash-lite",
    );
  });

  it("leaves an unknown model untouched (do not downgrade something not in the catalog)", () => {
    expect(costRoutedModel("brief", "made/up-model")).toBe("made/up-model");
  });

  it("leaves an unknown surface untouched (only the explicit routable set is eligible)", () => {
    expect(costRoutedModel("some-new-surface", "google/gemini-2.5-flash")).toBe(
      "google/gemini-2.5-flash",
    );
  });

  it("the routable set is the narrow safe set; wedge/benchmark/hard surfaces are excluded", () => {
    expect(COST_ROUTABLE_SURFACES.has("brief")).toBe(true);
    expect(COST_ROUTABLE_SURFACES.has("test")).toBe(true);
    for (const s of ["judge", "eval", "embed", "agent", "prd", "discovery"]) {
      expect(COST_ROUTABLE_SURFACES.has(s)).toBe(false);
    }
  });
});
