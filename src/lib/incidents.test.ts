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

    // Real producer contract: runtime.server.ts only ever writes kind="warn"
    // (a hard cap halts the call by throwing, so no kind="block" row is produced).
    // pct=100 here is the rare single-call overshoot that tips usage to the cap.
    const mockBudgetAlerts = [
      {
        id: "alert-1",
        kind: "warn",
        pct: 100,
        scope: "user",
        surface: "chat",
        window_kind: "day",
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
                            return { data: null, error: null };
                          },
                        };
                      },
                    };
                  },
                  in: (col2: string, vals: unknown) => {
                    return {
                      order: (col3: string, opts?: unknown) => {
                        return {
                          limit: async (limitVal: number) => {
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
    expect(items[0].title).toBe('Budget cap reached for "chat"');
    expect(items[0].amountUsd).toBe(10.0);
    expect(items[0].windowKind).toBe("day");

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

  test("budget-alert detector surfaces real kind='warn' crossings, escalating only at the cap", async () => {
    // The producer (runtime.server.ts) only ever writes kind="warn" when spend
    // crosses the alert threshold; it NEVER writes kind="block". This guards the
    // detector against regressing to a filter that matches no real rows.
    const alerts = [
      {
        id: "warn-80",
        kind: "warn",
        pct: 80,
        surface: null,
        window_kind: "day",
        usd_cap: 10,
        usd_used: 8,
        created_at: "2026-06-20T02:00:00Z",
      },
      {
        id: "cap-100",
        kind: "warn",
        pct: 100,
        surface: "chat",
        window_kind: "month",
        usd_cap: 50,
        usd_used: 50.4,
        created_at: "2026-06-20T03:00:00Z",
      },
    ];
    const mockSupabase = {
      rpc: async (fn: string) =>
        fn === "current_user_default_workspace"
          ? { data: "ws-1", error: null }
          : { data: null, error: null },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({ limit: async () => ({ data: [], error: null }) }),
            }),
            in: () => ({
              order: () => ({
                limit: async () => ({
                  data: table === "ai_budget_alerts" ? alerts : [],
                  error: null,
                }),
              }),
            }),
            not: () => ({
              order: () => ({ limit: async () => ({ data: [], error: null }) }),
            }),
            order: () => ({ limit: async () => ({ data: [], error: null }) }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await getIncidentsInternal(mockSupabase, "u-1");
    const byId: Record<string, Incident> = Object.fromEntries(
      result.incidents.map((i) => [i.id, i]),
    );

    // 80% threshold crossing: honest pct + window, NOT "cap reached".
    const warn = byId["budget_alert:warn-80"];
    expect(warn).toBeDefined();
    expect(warn.kind).toBe("cost");
    expect(warn.title).toBe("Budget alert: 80% of daily cap");
    expect(warn.detail).toContain("reached 80% of the $10.00 cap");
    expect(warn.detail).toContain("used: $8.00");

    // 100% of cap: escalated copy + windowKind passthrough for the badge.
    const capHit = byId["budget_alert:cap-100"];
    expect(capHit).toBeDefined();
    expect(capHit.title).toBe('Budget cap reached for "chat"');
    expect(capHit.detail).toContain("Further AI calls are blocked");
    expect(capHit.windowKind).toBe("month");
  });
});

describe("Incidents Log - runaway mission source (RUNAWAY-DETECT wire-up)", () => {
  // A thenable + chainable mock: every query method returns the builder, and awaiting it resolves
  // to the canned data for that table. Tables not in `canned` resolve to null (empty), so only the
  // runaway source fires here.
  function makeMock(canned: Record<string, unknown[]>): SupabaseClient {
    return {
      rpc: async (fn: string) =>
        fn === "current_user_default_workspace"
          ? { data: "ws-1", error: null }
          : { data: null, error: null },
      from: (table: string) => {
        const builder: Record<string, unknown> = {};
        for (const m of ["select", "eq", "in", "not", "order", "gte", "lte", "limit"]) {
          builder[m] = () => builder;
        }
        (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
          resolve({ data: canned[table] ?? null, error: null });
        return builder;
      },
    } as unknown as SupabaseClient;
  }

  const old = "2026-06-01T00:00:00Z";

  test("a spinning active mission becomes a 'runaway' incident; healthy and terminal ones do not", async () => {
    const mock = makeMock({
      missions: [
        { id: "spin", status: "running", hop_count: 99, created_at: old },
        { id: "ok", status: "running", hop_count: 1, created_at: old },
        { id: "doneSpin", status: "done", hop_count: 99, created_at: old }, // breached but terminal => watch, excluded
      ],
      mission_steps: [{ mission_id: "ok", attempts: 0 }],
      agent_runs: [],
    });

    const { incidents } = await getIncidentsInternal(mock, "user-1");
    const runaways = incidents.filter((i) => i.kind === "runaway");

    expect(runaways).toHaveLength(1);
    expect(runaways[0].id).toBe("runaway:spin");
    expect(runaways[0].title).toBe("Mission is spinning");
    expect(runaways[0].detail).toContain("99 hops");
    expect(runaways[0].at).toBe(old);
  });

  test("no missions -> no runaway incidents", async () => {
    const { incidents } = await getIncidentsInternal(makeMock({}), "user-1");
    expect(incidents.filter((i) => i.kind === "runaway")).toHaveLength(0);
  });
});
