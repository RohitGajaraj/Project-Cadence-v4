import { describe, it, expect } from "bun:test";
import { workspaceScopeId, applyWorkspaceScope } from "./workspace-scope";

// A minimal builder stub that records every .eq() and returns itself, so we can
// assert the conditional-filter behaviour without a live Supabase client.
function fakeQuery() {
  const calls: Array<[string, string]> = [];
  const q = {
    calls,
    eq(column: string, value: string) {
      calls.push([column, value]);
      return q;
    },
  };
  return q;
}

describe("workspaceScopeId (WM-F9b active-workspace read scope)", () => {
  it("returns null for absent values so the read is NOT filtered (today's behaviour)", () => {
    expect(workspaceScopeId(undefined)).toBeNull();
    expect(workspaceScopeId(null)).toBeNull();
  });

  it("returns null for blank / whitespace-only strings (never collapse a list by accident)", () => {
    expect(workspaceScopeId("")).toBeNull();
    expect(workspaceScopeId("   ")).toBeNull();
    expect(workspaceScopeId("\t\n")).toBeNull();
  });

  it("returns null for non-string inputs (defensive: a stray object never scopes)", () => {
    expect(workspaceScopeId(123)).toBeNull();
    expect(workspaceScopeId({})).toBeNull();
    expect(workspaceScopeId([])).toBeNull();
    expect(workspaceScopeId(true)).toBeNull();
  });

  it("returns the id to scope by for a concrete workspace id", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    expect(workspaceScopeId(id)).toBe(id);
  });

  it("trims surrounding whitespace so a padded id still scopes cleanly", () => {
    expect(workspaceScopeId("  abc  ")).toBe("abc");
  });
});

describe("applyWorkspaceScope (WM-F9b conditional query filter)", () => {
  it("adds .eq('workspace_id', id) exactly once for a concrete id, returning the same builder", () => {
    const q = fakeQuery();
    const out = applyWorkspaceScope(q, "11111111-1111-1111-1111-111111111111");
    expect(q.calls).toEqual([["workspace_id", "11111111-1111-1111-1111-111111111111"]]);
    expect(out).toBe(q);
  });

  it("does NOT touch the query for an absent / blank / non-string id (byte-identical to today)", () => {
    for (const v of [null, undefined, "", "   ", 123, {}]) {
      const q = fakeQuery();
      const out = applyWorkspaceScope(q, v);
      expect(q.calls).toEqual([]);
      expect(out).toBe(q);
    }
  });
});
