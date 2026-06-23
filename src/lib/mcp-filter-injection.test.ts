import { describe, it, expect } from "bun:test";
import { sanitizeIlikeQuery } from "./mcp.functions";

/**
 * Regression guard for SEC-MCP-FILTER-INJECTION (HIGH, flagged 2026-06-24).
 *
 * The INTEROP-V11 read-only MCP search tools interpolate the caller's `query` into a PostgREST
 * `.or(...)` filter STRING. `.or()` is a comma-separated list of `col.op.value` conditions with
 * parenthesized nesting, so a raw comma/paren/backslash could inject an extra OR branch and
 * widen the result set (a SQL-injection variant). `sanitizeIlikeQuery` neutralizes that by
 * stripping the structural metacharacters before interpolation. These tests lock the property
 * in so the fix can never silently regress as new MCP search tools are added.
 */
describe("sanitizeIlikeQuery — SEC-MCP-FILTER-INJECTION regression guard", () => {
  it("strips the PostgREST .or() structural characters (comma, parens, backslash)", () => {
    const out = sanitizeIlikeQuery("a,b(c)d\\e");
    expect(out).toBe("abcde");
    for (const ch of [",", "(", ")", "\\"]) expect(out.includes(ch)).toBe(false);
  });

  it("neutralizes an injected extra OR branch", () => {
    // Attempt: break out of the value and add an always-true condition.
    const injected = "x,id.gte.0";
    const safe = sanitizeIlikeQuery(injected);
    expect(safe.includes(",")).toBe(false);
    // What gets interpolated is now a single literal ilike value, not a new condition.
    expect(`title.ilike.%${safe}%`).toBe("title.ilike.%xid.gte.0%");
  });

  it("neutralizes a parenthesized nested-group injection", () => {
    const safe = sanitizeIlikeQuery("a),or(workspace_id.neq.0");
    expect(safe.includes("(")).toBe(false);
    expect(safe.includes(")")).toBe(false);
    expect(safe.includes(",")).toBe(false);
  });

  it("preserves the intended ilike wildcards (% and _) — they are search syntax, not injection", () => {
    expect(sanitizeIlikeQuery("hello%world_")).toBe("hello%world_");
  });

  it("trims and is null/undefined safe", () => {
    expect(sanitizeIlikeQuery("  spaced  ")).toBe("spaced");
    expect(sanitizeIlikeQuery(null)).toBe("");
    expect(sanitizeIlikeQuery(undefined)).toBe("");
  });

  it("a dot-laden value stays a literal value (no condition break-out via dots)", () => {
    // Dots are allowed (they are part of the value); without commas/parens they cannot start
    // a new condition. PostgREST splits a condition on the first two dots only.
    const safe = sanitizeIlikeQuery("title.ilike.evil");
    expect(safe).toBe("title.ilike.evil");
    expect(safe.includes(",")).toBe(false);
  });
});
