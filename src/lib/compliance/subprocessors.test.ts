import { describe, it, expect } from "bun:test";
import {
  allSubprocessors,
  activeSubprocessors,
  modelProviderSubprocessors,
  type SubProcessor,
} from "./subprocessors";
import { MODELS, type Model } from "@/lib/ai/models";

/** A minimal model fixture so the derivation can be tested against an injected catalog. */
function model(provider: Model["provider"], live: boolean): Model {
  return {
    id: `${provider}/test-model`,
    label: "Test",
    provider,
    tier: "fast",
    contextK: 100,
    desc: "test",
    live,
  };
}

function validShape(s: SubProcessor): boolean {
  return (
    typeof s.id === "string" &&
    s.id.length > 0 &&
    typeof s.name === "string" &&
    s.name.length > 0 &&
    (s.category === "ai_gateway" ||
      s.category === "ai_model_provider" ||
      s.category === "infrastructure") &&
    typeof s.purpose === "string" &&
    s.purpose.length > 0 &&
    Array.isArray(s.dataCategories) &&
    s.dataCategories.length > 0 &&
    typeof s.active === "boolean"
  );
}

describe("subprocessor registry shape", () => {
  it("every entry is well-formed (non-empty id/name/purpose, valid category, non-empty dataCategories)", () => {
    for (const s of allSubprocessors()) {
      expect(validShape(s)).toBe(true);
    }
  });

  it("has unique ids across the whole list", () => {
    const ids = allSubprocessors().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists the three infrastructure sub-processors, all active", () => {
    const ids = new Set(allSubprocessors().map((s) => s.id));
    for (const id of ["lovable", "supabase", "cloudflare"]) {
      expect(ids.has(id)).toBe(true);
    }
    const infra = allSubprocessors().filter((s) =>
      ["lovable", "supabase", "cloudflare"].includes(s.id),
    );
    expect(infra.every((s) => s.active)).toBe(true);
  });
});

describe("model-provider derivation (real catalog)", () => {
  it("flags a provider active only when it has a live model", () => {
    const derived = modelProviderSubprocessors();
    const liveProviders = new Set(MODELS.filter((m) => m.live).map((m) => m.provider));
    for (const s of derived) {
      expect(s.active).toBe(liveProviders.has(s.id as Model["provider"]));
    }
  });

  it("never lists ollama (self-hosted is not a third-party sub-processor)", () => {
    expect(allSubprocessors().some((s) => s.id === "ollama")).toBe(false);
  });

  it("has no duplicate provider entries", () => {
    const ids = modelProviderSubprocessors().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("orders active providers before inactive ones", () => {
    const derived = modelProviderSubprocessors();
    const firstInactive = derived.findIndex((s) => !s.active);
    if (firstInactive >= 0) {
      // no active entry may appear after the first inactive one
      expect(derived.slice(firstInactive).some((s) => s.active)).toBe(false);
    }
  });
});

describe("derivation reacts to the catalog (injected)", () => {
  it("marks a provider active when one of its models is live, inactive when none are", () => {
    const catalog: Model[] = [model("anthropic", true), model("deepseek", false)];
    const derived = modelProviderSubprocessors(catalog);
    const anthropic = derived.find((s) => s.id === "anthropic");
    const deepseek = derived.find((s) => s.id === "deepseek");
    expect(anthropic?.active).toBe(true);
    expect(deepseek?.active).toBe(false);
  });

  it("excludes ollama even when it has a live model", () => {
    const catalog: Model[] = [model("ollama", true), model("openai", true)];
    const derived = modelProviderSubprocessors(catalog);
    expect(derived.some((s) => s.id === "ollama")).toBe(false);
    expect(derived.some((s) => s.id === "openai" && s.active)).toBe(true);
  });
});

describe("active vs all", () => {
  it("activeSubprocessors is exactly the active subset of allSubprocessors", () => {
    const all = allSubprocessors();
    const active = activeSubprocessors();
    expect(active).toEqual(all.filter((s) => s.active));
    expect(active.every((s) => s.active)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(active.length);
  });

  it("an all-inactive provider appears in allSubprocessors but not in activeSubprocessors", () => {
    const catalog: Model[] = [model("xai", false)];
    expect(allSubprocessors(catalog).some((s) => s.id === "xai")).toBe(true);
    expect(activeSubprocessors(catalog).some((s) => s.id === "xai")).toBe(false);
  });
});
