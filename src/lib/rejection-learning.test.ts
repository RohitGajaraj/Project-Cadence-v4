import { describe, test, expect } from "bun:test";
import {
  summarizeRejections,
  rejectionCountFor,
  rejectionPatternCount,
  rejectionKey,
  type RejectionRow,
} from "@/lib/rejection-learning";

function row(over: Partial<RejectionRow>): RejectionRow {
  return {
    agent_slug: "scout",
    tool_name: "web.search",
    status: "rejected",
    decision_reason: null,
    decided_at: "2026-06-20T10:00:00.000Z",
    ...over,
  };
}

describe("summarizeRejections", () => {
  test("counts only rejected rows, grouped by (agent, tool)", () => {
    const byKey = summarizeRejections([
      row({}),
      row({}),
      row({ status: "approved" }),
      row({ status: "executed" }),
      row({ status: "failed" }),
      row({ tool_name: "github.commit.append" }),
    ]);
    expect(rejectionCountFor(byKey, "scout", "web.search")).toBe(2);
    expect(rejectionCountFor(byKey, "scout", "github.commit.append")).toBe(1);
    expect(rejectionPatternCount(byKey)).toBe(2);
  });

  test("an absent (agent, tool) has a zero count", () => {
    const byKey = summarizeRejections([row({})]);
    expect(rejectionCountFor(byKey, "strategist", "web.search")).toBe(0);
    expect(rejectionCountFor(byKey, "scout", "deploy.production")).toBe(0);
    expect(rejectionCountFor(null, "scout", "web.search")).toBe(0);
  });

  test("the composite key disambiguates agent vs tool", () => {
    const byKey = summarizeRejections([
      row({ agent_slug: "a", tool_name: "t1" }),
      row({ agent_slug: "b", tool_name: "t1" }),
      row({ agent_slug: "a", tool_name: "t2" }),
    ]);
    expect(rejectionPatternCount(byKey)).toBe(3);
    expect(rejectionCountFor(byKey, "a", "t1")).toBe(1);
    expect(rejectionKey("a", "t1")).not.toBe(rejectionKey("b", "t1"));
    expect(rejectionKey("a", "t1")).not.toBe(rejectionKey("a", "t2"));
  });

  test("keeps the most recent decline reason for a pair", () => {
    const byKey = summarizeRejections([
      row({ decided_at: "2026-06-19T10:00:00.000Z", decision_reason: "too risky" }),
      row({ decided_at: "2026-06-21T10:00:00.000Z", decision_reason: "not now" }),
      row({ decided_at: "2026-06-20T10:00:00.000Z", decision_reason: "wrong target" }),
    ]);
    const p = byKey[rejectionKey("scout", "web.search")];
    expect(p.count).toBe(3);
    expect(p.lastReason).toBe("not now");
    expect(p.lastAt).toBe("2026-06-21T10:00:00.000Z");
  });

  test("blank reasons normalize to null", () => {
    const byKey = summarizeRejections([row({ decision_reason: "   " })]);
    expect(byKey[rejectionKey("scout", "web.search")].lastReason).toBeNull();
  });

  test("tolerates empty / non-array input", () => {
    expect(summarizeRejections([])).toEqual({});
    expect(rejectionPatternCount(summarizeRejections([]))).toBe(0);
  });
});
