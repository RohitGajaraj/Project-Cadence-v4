import { describe, it, expect } from "bun:test";
import { isWorkspaceScopedQueryKey, GLOBAL_QUERY_KEY_ROOTS } from "./workspace-query-scope";

describe("isWorkspaceScopedQueryKey (WM-F8 switch-reset predicate)", () => {
  it("treats workspace-scoped data queries as scoped (cleared on switch)", () => {
    const scoped: readonly unknown[][] = [
      ["signals", "prod-1"],
      ["themes", "prod-1"],
      ["opportunities", "prod-1"],
      ["prds", "ws-1"],
      ["tasks", "prd-1"],
      ["decisions", "ws-1"],
      ["docs", "ws-1"],
      ["missions"],
      ["agents"],
      ["swarm"],
      ["roadmap", "prod-1"],
      ["guardrails"],
      ["reactor"],
      ["drift_overview"],
      ["budget_overview"],
      ["govern-approvals"],
      ["conversations"],
      ["calendar-events", "ws-1"],
      ["products", "ws-1"],
      ["workspace-bindings", "ws-1"],
      ["sync-mappings"],
    ];
    for (const key of scoped) {
      expect(isWorkspaceScopedQueryKey(key)).toBe(true);
    }
  });

  it("preserves every user/account-global query across a switch", () => {
    for (const root of GLOBAL_QUERY_KEY_ROOTS) {
      expect(isWorkspaceScopedQueryKey([root, "x"])).toBe(false);
    }
    expect(isWorkspaceScopedQueryKey(["workspaces"])).toBe(false);
    expect(isWorkspaceScopedQueryKey(["profile", "user-1"])).toBe(false);
  });

  it("never confuses a 'workspace-'-prefixed root with the global 'workspaces' key", () => {
    // exact-match Set membership, not a prefix test
    expect(isWorkspaceScopedQueryKey(["workspace-bindings", "ws-1"])).toBe(true);
    expect(isWorkspaceScopedQueryKey(["workspace-brief", "ws-1"])).toBe(true);
  });

  it("fails safe to workspace-scoped for non-string or empty roots", () => {
    expect(isWorkspaceScopedQueryKey([])).toBe(true);
    expect(isWorkspaceScopedQueryKey([123])).toBe(true);
    expect(isWorkspaceScopedQueryKey([null])).toBe(true);
    expect(isWorkspaceScopedQueryKey([{ a: 1 }])).toBe(true);
  });
});
