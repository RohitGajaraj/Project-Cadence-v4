import { describe, it, expect } from "bun:test";
import {
  isWorkspaceScopedQueryKey,
  GLOBAL_QUERY_KEY_ROOTS,
  USER_GLOBAL_QUERY_KEY_ROOTS,
  ACCOUNT_GLOBAL_QUERY_KEY_ROOTS,
  accountChangedOnSwitch,
  shouldClearOnWorkspaceSwitch,
} from "./workspace-query-scope";

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

  it("the two global tiers partition the global set (union == GLOBAL, disjoint)", () => {
    const union = new Set([...USER_GLOBAL_QUERY_KEY_ROOTS, ...ACCOUNT_GLOBAL_QUERY_KEY_ROOTS]);
    expect(union).toEqual(new Set(GLOBAL_QUERY_KEY_ROOTS));
    for (const r of USER_GLOBAL_QUERY_KEY_ROOTS) {
      expect(ACCOUNT_GLOBAL_QUERY_KEY_ROOTS.has(r)).toBe(false);
    }
  });
});

describe("accountChangedOnSwitch (WM-F8b cross-account detection)", () => {
  const ws = [
    { id: "w1", account_id: "acct-A" },
    { id: "w2", account_id: "acct-A" },
    { id: "w3", account_id: "acct-B" },
    { id: "w4", account_id: null },
    { id: "w5", account_id: "  " },
  ];

  it("preserves (false) ONLY when both workspaces are known and same account", () => {
    expect(accountChangedOnSwitch(ws, "w1", "w2")).toBe(false); // both acct-A
  });

  it("clears (true) on a cross-account switch", () => {
    expect(accountChangedOnSwitch(ws, "w1", "w3")).toBe(true); // A -> B
    expect(accountChangedOnSwitch(ws, "w3", "w1")).toBe(true); // B -> A
  });

  it("clears (true) when either account is unknown, null, blank, or the id is missing", () => {
    expect(accountChangedOnSwitch(ws, "w1", "w4")).toBe(true); // to null
    expect(accountChangedOnSwitch(ws, "w4", "w1")).toBe(true); // from null
    expect(accountChangedOnSwitch(ws, "w1", "w5")).toBe(true); // to blank
    expect(accountChangedOnSwitch(ws, "w1", "missing")).toBe(true); // unknown id
    expect(accountChangedOnSwitch(ws, null, "w1")).toBe(true); // initial set
    expect(accountChangedOnSwitch(ws, "w1", null)).toBe(true); // sign-out / clear
    expect(accountChangedOnSwitch([], "w1", "w2")).toBe(true); // empty list
  });
});

describe("shouldClearOnWorkspaceSwitch (WM-F8b tiered clear predicate)", () => {
  it("never clears a USER-global query, regardless of account change", () => {
    for (const root of USER_GLOBAL_QUERY_KEY_ROOTS) {
      expect(shouldClearOnWorkspaceSwitch([root, "x"], { accountChanged: false })).toBe(false);
      expect(shouldClearOnWorkspaceSwitch([root, "x"], { accountChanged: true })).toBe(false);
    }
  });

  it("clears an ACCOUNT-global query ONLY when the account changed", () => {
    for (const root of ACCOUNT_GLOBAL_QUERY_KEY_ROOTS) {
      expect(shouldClearOnWorkspaceSwitch([root], { accountChanged: false })).toBe(false);
      expect(shouldClearOnWorkspaceSwitch([root], { accountChanged: true })).toBe(true);
    }
  });

  it("always clears a workspace-scoped query (either account state)", () => {
    for (const accountChanged of [false, true]) {
      expect(shouldClearOnWorkspaceSwitch(["meetings", "ws-1"], { accountChanged })).toBe(true);
      expect(shouldClearOnWorkspaceSwitch(["agents"], { accountChanged })).toBe(true);
      expect(shouldClearOnWorkspaceSwitch(["workspace-bindings", "ws-1"], { accountChanged })).toBe(
        true,
      );
    }
  });

  it("fails safe to cleared for non-string / empty roots", () => {
    expect(shouldClearOnWorkspaceSwitch([], { accountChanged: false })).toBe(true);
    expect(shouldClearOnWorkspaceSwitch([123], { accountChanged: false })).toBe(true);
    expect(shouldClearOnWorkspaceSwitch([null], { accountChanged: false })).toBe(true);
  });
});
