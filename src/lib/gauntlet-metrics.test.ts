import { describe, expect, test } from "bun:test";
import { trendOf, isMissingRelation } from "./gauntlet-metrics";

describe("trendOf", () => {
  test("rising when current exceeds prior", () => {
    expect(trendOf(0.8, 0.5)).toBe("up");
  });
  test("falling when current is below prior", () => {
    expect(trendOf(0.4, 0.6)).toBe("down");
  });
  test("flat on equality", () => {
    expect(trendOf(0.5, 0.5)).toBe("flat");
    expect(trendOf(0, 0)).toBe("flat");
  });
});

describe("isMissingRelation", () => {
  test("true for the undefined_table code (pre-migration)", () => {
    expect(isMissingRelation({ code: "42P01" })).toBe(true);
  });
  test("true for the undefined_column code", () => {
    expect(isMissingRelation({ code: "42703" })).toBe(true);
  });
  test("true for the PostgREST missing-relation code", () => {
    expect(isMissingRelation({ code: "PGRST205" })).toBe(true);
  });
  test("true when the message names a missing relation/table", () => {
    expect(isMissingRelation({ message: 'relation "public.ritual_sessions" does not exist' })).toBe(
      true,
    );
    expect(
      isMissingRelation({ message: "Could not find the table 'public.ritual_sessions'" }),
    ).toBe(true);
  });
  test("false for a transient/permission error — it must surface, not read as no-data", () => {
    expect(isMissingRelation({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingRelation({ message: "network timeout" })).toBe(false);
  });
  test("false for null/undefined", () => {
    expect(isMissingRelation(null)).toBe(false);
    expect(isMissingRelation(undefined)).toBe(false);
  });
});
