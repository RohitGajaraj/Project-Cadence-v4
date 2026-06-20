import { describe, it, expect } from "bun:test";
import {
  summarizeErasure,
  isErasureComplete,
  RIGHT_TO_ERASURE,
  type WorkspaceErasureResult,
  type AccountErasureResult,
} from "./erasure";

const ws = (overrides: Partial<WorkspaceErasureResult> = {}): WorkspaceErasureResult => ({
  workspace_id: "w1",
  tables: { signals: 3, opportunities: 2, agent_memory: 5 },
  workspaces: 1,
  ...overrides,
});

describe("summarizeErasure", () => {
  it("reports a dormant no-op without claiming any deletion", () => {
    const r = summarizeErasure({ skipped: "dormant" });
    expect(r.dormant).toBe(true);
    expect(r.totalRows).toBe(0);
    expect(r.workspacesErased).toBe(0);
    expect(r.accountsErased).toBe(0);
    expect(r.byTable).toEqual({});
  });

  it("sums a workspace erase (content rows exclude the workspace row count)", () => {
    const r = summarizeErasure(ws());
    expect(r.dormant).toBe(false);
    expect(r.totalRows).toBe(10); // 3 + 2 + 5
    expect(r.workspacesErased).toBe(1);
    expect(r.accountsErased).toBe(0);
    expect(r.byTable.agent_memory).toBe(5);
  });

  it("explicitly counts the SET-NULL agent-moat tables as erased (not orphaned)", () => {
    // The whole point of the cascade: agent_* rows are deleted, not left with a null fk.
    const r = summarizeErasure(ws({ tables: { agent_memory: 4, agents: 2, agent_runs: 7 } }));
    expect(r.byTable.agent_memory).toBe(4);
    expect(r.byTable.agents).toBe(2);
    expect(r.byTable.agent_runs).toBe(7);
    expect(r.totalRows).toBe(13);
  });

  it("folds an account erase across all its workspaces + account-scoped tables", () => {
    const acct: AccountErasureResult = {
      account_id: "a1",
      workspaces: [
        ws({ workspace_id: "w1", tables: { signals: 3 }, workspaces: 1 }),
        ws({ workspace_id: "w2", tables: { signals: 1, tasks: 4 }, workspaces: 1 }),
      ],
      account_tables: { credit_ledger: 9, account_members: 2 },
      accounts: 1,
    };
    const r = summarizeErasure(acct);
    expect(r.workspacesErased).toBe(2);
    expect(r.accountsErased).toBe(1);
    expect(r.byTable.signals).toBe(4); // 3 + 1 merged across workspaces
    expect(r.byTable.tasks).toBe(4);
    expect(r.byTable.credit_ledger).toBe(9);
    expect(r.totalRows).toBe(3 + 1 + 4 + 9 + 2);
  });

  it("ignores non-finite / negative counts defensively (never inflates the receipt)", () => {
    const r = summarizeErasure(
      ws({ tables: { signals: 2, bad: Number.NaN, neg: -5 } as Record<string, number> }),
    );
    expect(r.totalRows).toBe(2);
    expect(r.byTable.bad).toBeUndefined();
    expect(r.byTable.neg).toBeUndefined();
  });
});

describe("isErasureComplete", () => {
  it("is true only when not dormant AND residue is empty", () => {
    const done = summarizeErasure(ws());
    expect(isErasureComplete(done, {})).toBe(true);
  });

  it("is false when residue rows remain (erase did not fully clear the tenant)", () => {
    const done = summarizeErasure(ws());
    expect(isErasureComplete(done, { signals: 2 })).toBe(false);
  });

  it("is false for a dormant result even with empty residue (never count dormant as done)", () => {
    const dormant = summarizeErasure({ skipped: "dormant" });
    expect(isErasureComplete(dormant, {})).toBe(false);
  });

  it("treats null/undefined residue as empty (jsonb '{}' can deserialize to null)", () => {
    const done = summarizeErasure(ws());
    expect(isErasureComplete(done, null)).toBe(true);
    expect(isErasureComplete(done, undefined)).toBe(true);
  });
});

describe("account/workspace discrimination", () => {
  it("does not misread a malformed object with a numeric `workspaces` as an account", () => {
    // A shape TS forbids but a deserialized jsonb could present: account_id + a
    // numeric workspaces. isAccount must be structural, so this folds as a workspace
    // result (no crash from iterating a number) rather than as an account.
    const malformed = { account_id: "a1", workspaces: 1, tables: { signals: 2 } } as never;
    const r = summarizeErasure(malformed);
    expect(r.dormant).toBe(false);
    expect(r.totalRows).toBe(2);
    expect(r.accountsErased).toBe(0);
  });
});

describe("RIGHT_TO_ERASURE registry", () => {
  it("names the dormant flag and the three SQL functions", () => {
    expect(RIGHT_TO_ERASURE.enabledFlag).toBe("right_to_erasure_enabled");
    expect(RIGHT_TO_ERASURE.forgetWorkspaceFn).toBe("forget_workspace");
    expect(RIGHT_TO_ERASURE.forgetAccountFn).toBe("forget_account");
    expect(RIGHT_TO_ERASURE.residueFn).toBe("erasure_residue");
  });
});
