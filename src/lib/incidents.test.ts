import { expect, test, describe } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getIncidentsInternal,
  logCostIncidentInternal,
  type Incident,
} from "./incidents.functions";

describe("Incidents Log & Cost Incident Detection", () => {
  test("getIncidents merges, sorts, and limits all incident sources", async () => {
    // Mock data for different sources
    const mockFailedApprovals = [
      {
        id: "approval-1",
        tool_name: "search_web",
        agent_slug: "researcher",
        error: "Network timeout",
        status: "failed",
        created_at: "2026-06-20T01:00:00Z",
        trace_id: "trace-123",
      },
    ];

    const mockEvents = [
      {
        id: "event-1",
        event_type: "PRD_GENERATED",
        error: "Database lock",
        created_at: "2026-06-20T01:05:00Z",
      },
    ];

    const mockCostIncidents = [
      {
        id: "cost-1",
        title: "Large single-call spend",
        detail: "Call cost exceeded warning threshold of $0.50",
        created_at: "2026-06-20T01:10:00Z",
        trace_id: "trace-456",
        amount_usd: 0.75,
        window_kind: "day",
      },
    ];

    const mockGuardrails = [
      {
        id: "guard-1",
        rule_name: "injection-shield",
        side: "input",
        created_at: "2026-06-20T01:15:00Z",
      },
    ];

    const mockBudgetAlerts = [
      {
        id: "alert-1",
        kind: "block",
        pct: 100,
        scope: "user",
        surface: "chat",
        usd_cap: 10.0,
        usd_used: 10.05,
        created_at: "2026-06-20T01:20:00Z",
      },
    ];

    const mockSupabase = {
      rpc: async (fn: string) => {
        if (fn === "current_user_default_workspace") {
          return { data: "test-workspace-id", error: null };
        }
        return { data: null, error: null };
      },
      from: (table: string) => {
        return {
          select: (fields: string) => {
            return {
              eq: (col: string, val: unknown) => {
                return {
                  eq: (col2: string, val2: unknown) => {
                    return {
                      order: (col3: string, opts?: unknown) => {
                        return {
                          limit: async (limitVal: number) => {
                            if (table === "agent_approvals") {
                              return { data: mockFailedApprovals, error: null };
                            }
                            if (table === "guardrail_hits") {
                              return { data: mockGuardrails, error: null };
                            }
                            if (table === "ai_budget_alerts") {
                              return { data: mockBudgetAlerts, error: null };
                            }
                            return { data: null, error: null };
                          },
                        };
                      },
                    };
                  },
                  not: (col2: string, op: string, val2: unknown) => {
                    return {
                      order: (col3: string, opts?: unknown) => {
                        return {
                          limit: async (limitVal: number) => {
                            if (table === "event_queue") {
                              return { data: mockEvents, error: null };
                            }
                            return { data: null, error: null };
                          },
                        };
                      },
                    };
                  },
                  order: (col2: string, opts?: unknown) => {
                    return {
                      limit: async (limitVal: number) => {
                        if (table === "cost_incidents") {
                          return { data: mockCostIncidents, error: null };
                        }
                        return { data: null, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const result = await getIncidentsInternal(mockSupabase, "test-user-id");

    expect(result.count).toBe(5);
    const items = result.incidents;

    // Check sorting order (newest first based on created_at / at)
    // alert-1 (01:20) > guard-1 (01:15) > cost-1 (01:10) > event-1 (01:05) > approval-1 (01:00)
    expect(items[0].id).toBe("budget_alert:alert-1");
    expect(items[0].kind).toBe("cost");
    expect(items[0].title).toBe('Budget limit reached for surface "chat"');
    expect(items[0].amountUsd).toBe(10.0);

    expect(items[1].id).toBe("guard:guard-1");
    expect(items[1].kind).toBe("guardrail");

    expect(items[2].id).toBe("cost:cost-1");
    expect(items[2].kind).toBe("cost");
    expect(items[2].title).toContain("Large single-call spend");
    expect(items[2].detail).toContain("Amount: $0.75 for the day");
    expect(items[2].amountUsd).toBe(0.75);
    expect(items[2].windowKind).toBe("day");

    expect(items[3].id).toBe("pipe:event-1");
    expect(items[3].kind).toBe("pipeline");

    expect(items[4].id).toBe("exec:approval-1");
    expect(items[4].kind).toBe("execution");
    expect(items[4].traceId).toBe("trace-123");
  });

  test("logCostIncident inserts successfully", async () => {
    const mockSupabase = {
      rpc: async (fn: string) => {
        if (fn === "current_user_default_workspace") {
          return { data: "test-workspace-id", error: null };
        }
        return { data: null, error: null };
      },
      from: (table: string) => {
        return {
          insert: (values: unknown) => {
            return {
              select: (fields: string) => {
                return {
                  single: async () => {
                    return { data: { id: "new-cost-incident-id" }, error: null };
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const result = await logCostIncidentInternal(mockSupabase, "test-user-id", {
      title: "Test Manual Limit",
      detail: "User reached manually configured threshold",
      amountUsd: 5.0,
      windowKind: "month",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe("new-cost-incident-id");
  });
});
