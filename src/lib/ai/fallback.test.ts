import { describe, expect, test } from "bun:test";
import { resolveFallbackChain } from "./fallback";

describe("resolveFallbackChain", () => {
  test("back-compat: a single fallbackModel becomes a one-element chain", () => {
    expect(resolveFallbackChain("a/primary", { fallbackModel: "b/backup" })).toEqual(["b/backup"]);
  });

  test("no fallback configured and no auto returns an empty chain (today's no-op)", () => {
    expect(resolveFallbackChain("a/primary", {})).toEqual([]);
  });

  test("excludes the primary model from the chain", () => {
    expect(
      resolveFallbackChain("a/primary", { fallbackModels: ["a/primary", "b/backup"] }),
    ).toEqual(["b/backup"]);
  });

  test("preserves order and de-duplicates the explicit list", () => {
    expect(
      resolveFallbackChain("a/primary", { fallbackModels: ["b/x", "c/y", "b/x", "d/z"] }),
    ).toEqual(["b/x", "c/y", "d/z"]);
  });

  test("fallbackModels takes precedence over fallbackModel when both are set", () => {
    expect(
      resolveFallbackChain("a/primary", {
        fallbackModels: ["b/x", "c/y"],
        fallbackModel: "z/ignored",
      }),
    ).toEqual(["b/x", "c/y"]);
  });

  test("autoFallback is appended AFTER the explicit chain and de-duplicated", () => {
    expect(
      resolveFallbackChain("a/primary", { fallbackModels: ["b/x"], autoFallback: "c/cheap" }),
    ).toEqual(["b/x", "c/cheap"]);
  });

  test("autoFallback equal to the primary or an explicit entry is dropped", () => {
    expect(
      resolveFallbackChain("a/primary", { fallbackModels: ["b/x"], autoFallback: "a/primary" }),
    ).toEqual(["b/x"]);
    expect(
      resolveFallbackChain("a/primary", { fallbackModels: ["b/x"], autoFallback: "b/x" }),
    ).toEqual(["b/x"]);
  });

  test("autoFallback alone (no explicit) yields a one-element chain", () => {
    expect(resolveFallbackChain("a/primary", { autoFallback: "c/cheap" })).toEqual(["c/cheap"]);
  });

  test("null/undefined/empty entries are ignored", () => {
    expect(
      resolveFallbackChain("a/primary", {
        fallbackModels: ["", "b/x"],
        autoFallback: null,
      }),
    ).toEqual(["b/x"]);
  });

  test("an explicitly empty fallbackModels array still yields the autoFallback", () => {
    expect(
      resolveFallbackChain("a/primary", { fallbackModels: [], autoFallback: "c/cheap" }),
    ).toEqual(["c/cheap"]);
  });
});
